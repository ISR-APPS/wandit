/**
 * Refunds the last paid Stripe plan payment of a user and ends that Stripe subscription now.
 * AdminUserRefundsController calls it for the admin "Refund last plan payment" action.
 * Reads invoice and receipt rows through Drizzle repositories. Calls Stripe through StripeProvider.
 * It never writes credits: the charge.refunded webhook revokes the credits of the refunded charge.
 */
import {
	BadGatewayException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type {
	AdminUserRefundInput,
	AdminUserRefundPayment,
	AdminUserRefundPreview,
	AdminUserRefundResult,
} from "@wandit/contracts";
import Stripe from "stripe";

import type { CreateRefundParams } from "../../domain/ports/payment-provider.port";
import { BillingTopupReceiptsRepository } from "../../infrastructure/persistence/billing-topup-receipts.repository";
import {
	type InvoiceApplicationRow,
	SubscriptionCreditsRepository,
} from "../../infrastructure/persistence/subscription-credits.repository";
import {
	type SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import { StripeProvider } from "../../infrastructure/stripe/stripe.provider";

/**
 * The Stripe calls of an admin refund. StripeProvider implements them.
 * Each result keeps only the fields this service reads, so the spec fakes stay small.
 */
export type AdminRefundStripeClient = {
	cancelSubscriptionNow(
		providerSubscriptionId: string,
		idempotencyKey: string,
	): Promise<void>;
	createRefund(
		params: CreateRefundParams,
	): Promise<Pick<Stripe.Refund, "amount" | "currency" | "id" | "status">>;
	/** Only the paid payments of the invoice. StripeProvider asks Stripe for status "paid". */
	listInvoicePayments(
		invoiceId: string,
	): Promise<Pick<Stripe.InvoicePayment, "payment">[]>;
	/** StripeProvider expands `latest_charge`, so it is an object when the intent has a charge. */
	retrievePaymentIntent(paymentIntentId: string): Promise<{
		latest_charge:
			| string
			| Pick<Stripe.Charge, "amount_captured" | "amount_refunded" | "currency">
			| null;
	}>;
	retrieveSubscription(
		providerSubscriptionId: string,
	): Promise<Pick<Stripe.Subscription, "status">>;
};

/** The one Stripe charge that paid an invoice, with its live amounts in minor units of `currency`. */
type InvoiceCharge = {
	paymentIntentId: string;
	amountCapturedMinor: number;
	amountRefundedMinor: number;
	currency: string;
};

/** 409: Stripe data that this action cannot refund safely. The admin uses the Stripe dashboard. */
class RefundInStripeDashboardError extends ConflictException {
	constructor(stripeInvoiceId: string, reason: string, cause?: unknown) {
		super(
			{
				code: "ADMIN_REFUND_NEEDS_STRIPE_DASHBOARD",
				message: `Invoice ${stripeInvoiceId} ${reason}. Refund this invoice in the Stripe dashboard.`,
			},
			{ cause },
		);
	}
}

/** Needs billing:manage (see the controller). Writes no credits: the charge.refunded webhook does that. */
@Injectable()
export class AdminUserRefundsService {
	private readonly logger = new Logger(AdminUserRefundsService.name);

	constructor(
		@Inject(SubscriptionCreditsRepository)
		private readonly invoices: Pick<
			SubscriptionCreditsRepository,
			"findInvoiceApplication" | "findLatestPaidPersonalStripeInvoice"
		>,
		@Inject(SubscriptionsRepository)
		private readonly subscriptions: Pick<SubscriptionsRepository, "findById">,
		@Inject(BillingTopupReceiptsRepository)
		private readonly receipts: Pick<
			BillingTopupReceiptsRepository,
			"findLatestPersonalOfflinePaidAt"
		>,
		@Inject(StripeProvider)
		private readonly stripe: AdminRefundStripeClient,
	) {}

	/** Reads what a refund would do. It writes nothing. */
	async preview(userId: string): Promise<AdminUserRefundPreview> {
		const [latest, offlinePaidAt] = await Promise.all([
			this.invoices.findLatestPaidPersonalStripeInvoice(userId),
			this.receipts.findLatestPersonalOfflinePaidAt(userId),
		]);
		// Old invoice rows have no paid_at. The apply time is close to the payment time.
		const stripePaidAt = latest
			? (latest.invoice.paidAt ?? latest.invoice.appliedAt)
			: null;
		const paidOffline =
			offlinePaidAt !== null &&
			(stripePaidAt === null || offlinePaidAt > stripePaidAt);

		// Product rule: when the newest payment is a SlickPay or offline top-up, the admin
		// gets only the refund instruction. The Stripe plan payment is an older payment.
		if (!latest || paidOffline) {
			return { paidOffline, payment: null };
		}

		return {
			paidOffline,
			payment: await this.livePayment(latest.invoice, latest.subscription),
		};
	}

	/**
	 * Refunds the full remaining amount of the invoice, then ends its Stripe subscription.
	 * A retry after a partial failure is safe: both Stripe writes skip work that is done.
	 */
	async refund(
		adminUserId: string,
		userId: string,
		input: AdminUserRefundInput,
	): Promise<AdminUserRefundResult> {
		const invoice = await this.invoices.findInvoiceApplication(
			input.stripeInvoiceId,
		);
		const subscription = invoice
			? await this.subscriptions.findById(invoice.subscriptionId)
			: null;

		// Security: the route names one user. The invoice of another user or of a team must not pass.
		if (
			!invoice ||
			!subscription ||
			subscription.userId !== userId ||
			subscription.organizationId !== null ||
			subscription.provider !== "stripe"
		) {
			throw new NotFoundException({
				code: "NOT_FOUND",
				message: "This user has no Stripe plan payment with this invoice",
			});
		}

		const charge = await this.invoiceCharge(invoice.stripeInvoiceId);
		// A retry after a partial failure finds the charge refunded and skips to the cancel.
		const refund =
			charge.amountRefundedMinor < charge.amountCapturedMinor
				? await this.createRefund(
						invoice.stripeInvoiceId,
						charge.paymentIntentId,
					)
				: null;

		// Logged before the cancel, so a cancel failure does not hide the money movement.
		this.logger.log(
			`admin_refund admin=${adminUserId} target=${userId} invoice=${invoice.stripeInvoiceId} refund=${refund?.id ?? "none"} status=${refund?.status ?? "none"}`,
		);
		// Product rule: every refund ends the plan now, so Stripe does not charge again.
		try {
			await this.stripe.cancelSubscriptionNow(
				subscription.providerSubscriptionId,
				`admin-refund-cancel:${subscription.id}`,
			);
		} catch (error) {
			// The money moved already. The admin must know that the plan still charges.
			this.logger.error(
				`admin_refund_cancel_failed admin=${adminUserId} target=${userId} invoice=${invoice.stripeInvoiceId} refund=${refund?.id ?? "none"}`,
			);
			throw new BadGatewayException(
				{
					code: "ADMIN_REFUND_CANCEL_FAILED",
					message:
						"The payment is refunded, but the Stripe subscription is still active. Try again, or cancel it in the Stripe dashboard.",
				},
				{ cause: error },
			);
		}

		return {
			refund: refund
				? {
						amountMinor: refund.amount,
						currency: refund.currency,
						id: refund.id,
						status: refund.status,
					}
				: null,
			subscriptionCanceled: true,
		};
	}

	// With no amount, Stripe refunds the full remaining amount of the payment intent.
	private async createRefund(
		stripeInvoiceId: string,
		paymentIntentId: string,
	): Promise<Pick<Stripe.Refund, "amount" | "currency" | "id" | "status">> {
		try {
			// The key replays the same Stripe refund on a second click or a second admin.
			return await this.stripe.createRefund({
				idempotencyKey: `admin-refund:${stripeInvoiceId}`,
				paymentIntentId,
			});
		} catch (error) {
			// A 400 from Stripe (a disputed or too old charge) moved no money. Other errors stay 500.
			if (error instanceof Stripe.errors.StripeInvalidRequestError) {
				throw new RefundInStripeDashboardError(
					stripeInvoiceId,
					`cannot be refunded here (${error.message})`,
					error,
				);
			}

			throw error;
		}
	}

	private async livePayment(
		invoice: InvoiceApplicationRow,
		subscription: SubscriptionRow,
	): Promise<AdminUserRefundPayment> {
		const [charge, stripeSubscription] = await Promise.all([
			this.invoiceCharge(invoice.stripeInvoiceId),
			this.stripe.retrieveSubscription(subscription.providerSubscriptionId),
		]);

		return {
			amountPaidMinor: charge.amountCapturedMinor,
			amountRefundedMinor: charge.amountRefundedMinor,
			currency: charge.currency,
			interval: subscription.interval,
			paidAt: invoice.paidAt?.toISOString() ?? null,
			plan: subscription.plan,
			stripeInvoiceId: invoice.stripeInvoiceId,
			subscriptionCanceled:
				stripeSubscription.status === "canceled" ||
				stripeSubscription.status === "incomplete_expired",
		};
	}

	/**
	 * Finds the one payment intent that paid the invoice and reads its charge.
	 * Same rule as SubscriptionCreditsService: refuse an invoice with more than one paid source.
	 */
	private async invoiceCharge(stripeInvoiceId: string): Promise<InvoiceCharge> {
		const payments = await this.stripe.listInvoicePayments(stripeInvoiceId);
		const paymentIntentIds = new Set(
			payments.map(({ payment }) =>
				typeof payment.payment_intent === "string"
					? payment.payment_intent
					: (payment.payment_intent?.id ?? null),
			),
		);

		if (paymentIntentIds.size > 1) {
			throw new RefundInStripeDashboardError(
				stripeInvoiceId,
				"has more than one paid payment source",
			);
		}

		const [paymentIntentId] = paymentIntentIds;

		// A refund goes through a payment intent. A legacy charge or a payment record has none.
		if (!paymentIntentId) {
			throw new RefundInStripeDashboardError(
				stripeInvoiceId,
				"has no paid payment intent",
			);
		}

		const paymentIntent =
			await this.stripe.retrievePaymentIntent(paymentIntentId);
		const charge = paymentIntent.latest_charge;

		if (typeof charge !== "object" || charge === null) {
			throw new RefundInStripeDashboardError(
				stripeInvoiceId,
				"has no readable charge",
			);
		}

		return {
			amountCapturedMinor: charge.amount_captured,
			amountRefundedMinor: charge.amount_refunded,
			currency: charge.currency,
			paymentIntentId,
		};
	}
}
