import { Inject, Injectable, Optional } from "@nestjs/common";
import { CHECKOUT_PURPOSE } from "@wandit/contracts";
import type Stripe from "stripe";

import {
	type CheckoutSessionOrderOutcome,
	WEBHOOK_ORDER_RECONCILER,
	type WebhookOrderReconciler,
} from "../../domain/ports/webhook-order-reconciler.port";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import type { SubscriptionRow } from "../../infrastructure/persistence/subscriptions.repository";
import { PaymentRefundsService } from "./payment-refunds.service";
import { StripeSubscriptionSyncService } from "./stripe-subscription-sync.service";
import { SubscriptionCreditsService } from "./subscription-credits.service";

export type StripeEventRouteResult =
	| {
			mirroredSubscriptions?: SubscriptionRow[];
			status: "processed";
	  }
	| { reason: string; status: "skipped" };

const PROCESSED = { status: "processed" } as const;

@Injectable()
export class StripeEventRouter {
	constructor(
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(StripeSubscriptionSyncService)
		private readonly subscriptionSyncService: StripeSubscriptionSyncService,
		@Inject(SubscriptionCreditsService)
		private readonly subscriptionCreditsService: SubscriptionCreditsService,
		@Inject(PaymentRefundsService)
		private readonly paymentRefundsService: PaymentRefundsService,
		@Optional()
		@Inject(WEBHOOK_ORDER_RECONCILER)
		private readonly orderReconciler?: WebhookOrderReconciler,
	) {}

	async route(event: Stripe.Event): Promise<StripeEventRouteResult> {
		switch (event.type) {
			case "checkout.session.completed":
				return this.routeSuccessfulCheckout(event.data.object, "completed");
			case "checkout.session.async_payment_succeeded":
				return this.routeSuccessfulCheckout(
					event.data.object,
					"async_payment_succeeded",
				);
			case "checkout.session.expired":
				return this.routeExpiredCheckout(event.data.object);
			case "checkout.session.async_payment_failed":
				return this.routeFailedCheckout(event.data.object);
			case "customer.subscription.created":
			case "customer.subscription.updated":
			case "customer.subscription.paused":
			case "customer.subscription.resumed":
			case "customer.subscription.pending_update_applied":
			case "customer.subscription.pending_update_expired":
			case "customer.subscription.trial_will_end":
				return this.routeSubscriptionSync(event.data.object);
			case "customer.subscription.deleted":
				return this.routeDeletedSubscription(event.data.object);
			case "invoice.paid":
				return this.routePaidInvoice(event.data.object);
			case "invoice.payment_failed":
			case "invoice.payment_action_required":
			case "invoice.marked_uncollectible":
			case "invoice.upcoming":
				return this.routeInvoiceSync(event.data.object);
			case "payment_intent.succeeded":
				return this.routePaymentIntentToOrderReconciler(
					event.data.object,
					"succeeded",
				);
			case "payment_intent.payment_failed":
				return this.routePaymentIntentToOrderReconciler(
					event.data.object,
					"failed",
				);
			case "payment_intent.canceled":
				return this.routePaymentIntentToOrderReconciler(
					event.data.object,
					"canceled",
				);
			case "charge.refunded":
				return this.routeChargeRefunded(event.data.object);
			case "charge.refund.updated":
			case "refund.updated":
			case "refund.failed":
				return this.routeRefundUpdated(event.data.object);
			case "charge.dispute.created":
				return this.routeChargeDisputeCreated(event.data.object);
			default:
				return this.skipped(
					`Stripe event type ${event.type} is not allowlisted`,
				);
		}
	}

	private async routeSuccessfulCheckout(
		session: Stripe.Checkout.Session,
		outcome: "async_payment_succeeded" | "completed",
	): Promise<StripeEventRouteResult> {
		const purpose = session.metadata?.purpose;

		if (purpose !== undefined) {
			switch (purpose) {
				case CHECKOUT_PURPOSE.order:
					return this.routeCheckoutSessionToOrderReconciler(session, outcome);
				case CHECKOUT_PURPOSE.topup:
					return this.routeTopupCheckout(session);
				case CHECKOUT_PURPOSE.subscription:
					return this.routeSubscriptionCheckout(session);
				default:
					return this.skipped(
						`Stripe checkout session ${session.id} has unknown purpose ${purpose}`,
					);
			}
		}

		if (session.mode === "subscription") {
			return this.routeSubscriptionCheckout(session);
		}

		if (
			session.mode === "payment" &&
			(session.metadata?.packId !== undefined ||
				session.metadata?.credits !== undefined)
		) {
			return this.routeTopupCheckout(session);
		}

		return this.skipped(
			`Stripe checkout session ${session.id} has no recognized purpose`,
		);
	}

	private async routeExpiredCheckout(
		session: Stripe.Checkout.Session,
	): Promise<StripeEventRouteResult> {
		if (session.metadata?.purpose === CHECKOUT_PURPOSE.order) {
			return this.routeCheckoutSessionToOrderReconciler(session, "expired");
		}

		if (
			session.metadata?.purpose === CHECKOUT_PURPOSE.subscription ||
			(session.metadata?.purpose === undefined &&
				session.mode === "subscription")
		) {
			await this.billingCustomersRepository.clearOpenCheckoutSessionId(
				session.id,
			);

			return PROCESSED;
		}

		return this.skipped(
			`Stripe checkout session ${session.id} expiration is not subscription or order-related`,
		);
	}

	private routeFailedCheckout(
		session: Stripe.Checkout.Session,
	): Promise<StripeEventRouteResult> {
		if (session.metadata?.purpose === CHECKOUT_PURPOSE.order) {
			return this.routeCheckoutSessionToOrderReconciler(
				session,
				"async_payment_failed",
			);
		}

		return Promise.resolve(
			this.skipped(
				`Stripe checkout session ${session.id} failure is not order-related`,
			),
		);
	}

	private async routeTopupCheckout(
		session: Stripe.Checkout.Session,
	): Promise<StripeEventRouteResult> {
		if (session.mode !== "payment") {
			throw new Error(
				`Stripe top-up checkout session ${session.id} must use payment mode`,
			);
		}

		if (typeof session.payment_status !== "string") {
			throw new Error(
				`Stripe checkout session ${session.id} payment_status must be a string`,
			);
		}

		if (session.payment_status !== "paid") {
			return this.skipped(
				`Stripe top-up checkout session ${session.id} is not paid`,
			);
		}

		await this.subscriptionCreditsService.grantTopup(session);

		return PROCESSED;
	}

	private async routeSubscriptionCheckout(
		session: Stripe.Checkout.Session,
	): Promise<StripeEventRouteResult> {
		if (session.mode !== "subscription") {
			throw new Error(
				`Stripe subscription checkout session ${session.id} must use subscription mode`,
			);
		}

		const userId = this.requiredString(
			session.client_reference_id ?? session.metadata?.userId,
			`checkout session ${session.id} user`,
		);
		const providerCustomerId = this.requiredCustomerId(
			session.customer,
			`checkout session ${session.id}`,
		);

		await this.billingCustomersRepository.upsertByUserId({
			provider: "stripe",
			providerCustomerId,
			userId,
		});
		await this.billingCustomersRepository.clearOpenCheckoutSessionId(
			session.id,
		);
		const mirroredSubscriptions =
			await this.subscriptionSyncService.syncFromStripe(providerCustomerId);

		return { mirroredSubscriptions, status: "processed" };
	}

	private async routeSubscriptionSync(
		subscription: Stripe.Subscription,
	): Promise<StripeEventRouteResult> {
		const providerCustomerId = this.requiredCustomerId(
			subscription.customer,
			`subscription ${subscription.id}`,
		);

		await this.subscriptionSyncService.syncFromStripe(providerCustomerId);

		return PROCESSED;
	}

	private async routeDeletedSubscription(
		subscription: Stripe.Subscription,
	): Promise<StripeEventRouteResult> {
		const providerCustomerId = this.requiredCustomerId(
			subscription.customer,
			`subscription ${subscription.id}`,
		);

		await this.subscriptionSyncService.syncFromStripe(providerCustomerId);
		await this.subscriptionCreditsService.expireForDeletedSubscription(
			subscription,
		);

		return PROCESSED;
	}

	private async routePaidInvoice(
		invoice: Stripe.Invoice,
	): Promise<StripeEventRouteResult> {
		await this.syncInvoiceCustomer(invoice);
		await this.subscriptionCreditsService.grantForPaidInvoice(invoice);

		return PROCESSED;
	}

	private async routeInvoiceSync(
		invoice: Stripe.Invoice,
	): Promise<StripeEventRouteResult> {
		await this.syncInvoiceCustomer(invoice);

		return PROCESSED;
	}

	private async syncInvoiceCustomer(invoice: Stripe.Invoice): Promise<void> {
		const providerCustomerId = this.requiredCustomerId(
			invoice.customer,
			`invoice ${invoice.id}`,
		);

		await this.subscriptionSyncService.syncFromStripe(providerCustomerId);
	}

	private async routeChargeRefunded(
		charge: Stripe.Charge,
	): Promise<StripeEventRouteResult> {
		const handled =
			await this.paymentRefundsService.handleChargeRefunded(charge);

		return handled
			? PROCESSED
			: this.skipped(
					`Stripe charge ${charge.id} has no matching payment order or purchased credits`,
				);
	}

	private async routeChargeDisputeCreated(
		dispute: Stripe.Dispute,
	): Promise<StripeEventRouteResult> {
		const handled =
			await this.paymentRefundsService.handleChargeDisputeCreated(dispute);

		return handled
			? PROCESSED
			: this.skipped(
					`Stripe dispute ${dispute.id} has no purchased credits to revoke`,
				);
	}

	private async routeRefundUpdated(
		refund: Stripe.Refund,
	): Promise<StripeEventRouteResult> {
		const handled =
			await this.paymentRefundsService.handleRefundUpdated(refund);

		return handled
			? PROCESSED
			: this.skipped(
					`Stripe refund ${refund.id} has no matching payment order`,
				);
	}

	private async routeCheckoutSessionToOrderReconciler(
		session: Stripe.Checkout.Session,
		outcome: CheckoutSessionOrderOutcome,
	): Promise<StripeEventRouteResult> {
		const sessionId = this.requiredString(session.id, "checkout session id");

		if (!this.orderReconciler) {
			return this.skipped(
				`Payment-order reconciliation for checkout session ${sessionId} is deferred to Phase I3`,
			);
		}

		await this.orderReconciler.reconcileBySession(sessionId, outcome);

		return PROCESSED;
	}

	private async routePaymentIntentToOrderReconciler(
		paymentIntent: Stripe.PaymentIntent,
		outcome: "canceled" | "failed" | "succeeded",
	): Promise<StripeEventRouteResult> {
		const paymentIntentId = this.requiredString(
			paymentIntent.id,
			"payment intent id",
		);

		if (!this.orderReconciler) {
			return this.skipped(
				`Payment-order lookup for payment intent ${paymentIntentId} is deferred to Phase I3`,
			);
		}

		const reconciled = await this.orderReconciler.reconcileByPaymentIntent(
			paymentIntentId,
			outcome,
			typeof paymentIntent.status === "string" ? paymentIntent.status : outcome,
		);

		return reconciled
			? PROCESSED
			: this.skipped(
					`No payment order matches Stripe payment intent ${paymentIntentId}`,
				);
	}

	private requiredCustomerId(value: unknown, owner: string): string {
		if (typeof value !== "string" || value.length === 0) {
			throw new Error(`Stripe ${owner} customer must be a string`);
		}

		return value;
	}

	private requiredString(value: unknown, label: string): string {
		if (typeof value !== "string" || value.length === 0) {
			throw new Error(`Stripe ${label} must be a non-empty string`);
		}

		return value;
	}

	private skipped(reason: string): StripeEventRouteResult {
		return { reason, status: "skipped" };
	}
}
