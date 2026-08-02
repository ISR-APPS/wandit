import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	CHECKOUT_PURPOSE,
	type CreateDomainOrderBody,
	type CreateOrderResponse,
	DOMAIN_REGISTRATION_USD_CENTS,
	type PaymentOrder,
	uuidSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type Stripe from "stripe";

import { BillingCustomerService } from "../../../billing/application/services/billing-customer.service";
import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
} from "../../../billing/domain/ports/payment-provider.port";
import type {
	CheckoutSessionOrderOutcome,
	PaymentIntentOrderOutcome,
	WebhookOrderReconciler,
} from "../../../billing/domain/ports/webhook-order-reconciler.port";
import { BillingCustomersRepository } from "../../../billing/infrastructure/persistence/billing-customers.repository";
import { DomainsService } from "../../../domains/application/services/domains.service";
import {
	DomainAlreadyExistsError,
	PremiumDomainBlockedError,
} from "../../../domains/domain/errors/domain.errors";
import { DomainsRepository } from "../../../domains/infrastructure/persistence/domains.repository";
import { OrderInvariantViolationError } from "../../domain/errors/payment-order.errors";
import {
	domainRegistrationOrderMetadataSchema,
	type PaymentOrderRow,
} from "../../domain/payment-order.types";
import {
	ORDER_REFUND_DISPATCHER,
	type OrderRefundDispatcher,
} from "../../domain/ports/order-refund-dispatcher.port";
import {
	PaymentOrdersRepository,
	type PaymentOrderTransaction,
} from "../../infrastructure/persistence/payment-orders.repository";
import { OrderFulfillmentRegistry } from "./order-fulfillment.registry";
import { OrderRefundsService } from "./order-refunds.service";

type ReconcileResult = {
	inspectCharge: boolean;
	order: PaymentOrderRow;
	shouldFulfill: boolean;
	shouldRefund: boolean;
};

type StripeFinancialReversal =
	| {
			chargeId: string;
			kind: "dispute";
	  }
	| {
			amountCaptured: number;
			amountRefunded: number;
			chargeId: string;
			kind: "refund";
	  };

@Injectable()
export class OrdersService implements WebhookOrderReconciler {
	constructor(
		@Inject(PaymentOrdersRepository)
		private readonly paymentOrdersRepository: PaymentOrdersRepository,
		@Inject(DomainsService)
		private readonly domainsService: DomainsService,
		@Inject(DomainsRepository)
		private readonly domainsRepository: DomainsRepository,
		@Inject(BillingCustomerService)
		private readonly billingCustomerService: BillingCustomerService,
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(PAYMENT_PROVIDER)
		private readonly paymentProvider: PaymentProvider,
		@Inject(OrderFulfillmentRegistry)
		private readonly fulfillmentRegistry: OrderFulfillmentRegistry,
		@Inject(OrderRefundsService)
		private readonly orderRefundsService: OrderRefundsService,
		@Inject(ORDER_REFUND_DISPATCHER)
		private readonly orderRefundDispatcher: OrderRefundDispatcher,
	) {}

	async createDomainOrder(
		user: AuthUser,
		body: CreateDomainOrderBody,
	): Promise<CreateOrderResponse> {
		const prepared = await this.domainsService.preparePurchase(
			user.id,
			body.domain,
			body.projectId,
		);
		const amountCents = DOMAIN_REGISTRATION_USD_CENTS[prepared.tld];

		// Never contact Stripe for a purchase that would lose money: the retail
		// charge must stay above the registrar's live wholesale quote.
		if (prepared.quotedWholesaleUsd * 100 >= amountCents) {
			throw new PremiumDomainBlockedError(prepared.name);
		}

		const customer = await this.billingCustomerService.ensureCustomer(user);
		const order = await this.paymentOrdersRepository.insert({
			amountCents,
			currency: "usd",
			kind: "domain_registration",
			metadata: {
				domain: prepared.name,
				priceSnapshot: {
					chargedAmountCents: amountCents,
					chargedCurrency: "usd",
					quotedWholesaleUsd: prepared.quotedWholesaleUsd,
					tld: prepared.tld,
					wholesaleCeilingUsd: prepared.wholesaleCeilingUsd,
				},
				...(body.projectId ? { projectId: body.projectId } : {}),
				registrant: body.registrant,
				tld: prepared.tld,
				// WHOIS privacy is a separate paid registrar add-on with no line
				// item in the charge, so it is never enabled implicitly.
				whoisPrivacy: body.whoisPrivacy ?? false,
			},
			userId: user.id,
		});
		const checkout = await this.paymentProvider.createOrderCheckout({
			amountCents,
			cancelUrl: `${env.CORS_ORIGIN}/billing/cancel`,
			currency: "usd",
			customerId: customer.providerCustomerId,
			kind: order.kind,
			orderId: order.id,
			productName: `Domain registration: ${prepared.name}`,
			successUrl: `${env.CORS_ORIGIN}/billing/success?purpose=order&session_id={CHECKOUT_SESSION_ID}`,
			userId: user.id,
		});
		const attached = await this.paymentOrdersRepository.attachCheckoutSession(
			order.id,
			checkout.id,
		);

		if (!attached) {
			throw new OrderInvariantViolationError(
				`Payment order ${order.id} could not attach checkout session ${checkout.id}`,
			);
		}

		return {
			checkoutUrl: checkout.url,
			order: await this.toPaymentOrder(attached, checkout.url),
		};
	}

	async reconcileBySession(
		sessionId: string,
		outcome?: CheckoutSessionOrderOutcome,
	): Promise<void> {
		await this.reconcileSession(sessionId, outcome);
	}

	async reconcileByPaymentIntent(
		paymentIntentId: string,
		outcome?: PaymentIntentOrderOutcome,
		providerPaymentStatus?: string,
	): Promise<boolean> {
		const order =
			await this.paymentOrdersRepository.findByPaymentIntentId(paymentIntentId);

		if (!order) {
			return false;
		}

		if (outcome === "failed" || outcome === "canceled") {
			const sessionId = order.providerCheckoutSessionId;

			if (!sessionId) {
				throw new OrderInvariantViolationError(
					`Payment order ${order.id} has no checkout session`,
				);
			}

			const session =
				await this.paymentProvider.retrieveCheckoutSession(sessionId);

			if (session.status === "complete" && session.payment_status === "paid") {
				await this.reconcileSession(sessionId);

				return true;
			}

			const isTerminal =
				session.status === "expired" ||
				(session.status === "complete" && session.payment_status === "unpaid");

			if (!isTerminal) {
				await this.paymentOrdersRepository.withLockedById(
					order.id,
					async (lockedOrder, tx) => {
						if (lockedOrder.status !== "pending") {
							return;
						}

						await this.paymentOrdersRepository.recordPaymentState(
							order.id,
							{
								paymentIntentId,
								paymentStatus: providerPaymentStatus ?? outcome,
								sessionId,
							},
							tx,
						);
					},
				);

				return true;
			}

			const terminalOutcome =
				session.status === "expired" ? "canceled" : outcome;
			await this.paymentOrdersRepository.markPendingTerminal(
				order.id,
				terminalOutcome,
				{
					fulfillmentError:
						terminalOutcome === "failed"
							? "Payment could not be completed"
							: null,
					paymentIntentId,
					paymentStatus: providerPaymentStatus ?? outcome,
					sessionId,
				},
			);

			return true;
		}

		if (!order.providerCheckoutSessionId) {
			throw new OrderInvariantViolationError(
				`Payment order ${order.id} has no checkout session`,
			);
		}

		await this.reconcileSession(order.providerCheckoutSessionId);

		return true;
	}

	async reconcileSessionForUser(
		userId: string,
		sessionId: string,
	): Promise<PaymentOrder> {
		await this.paymentOrdersRepository.findBySessionIdForUser(
			sessionId,
			userId,
		);
		const reconciled = await this.reconcileSession(sessionId);

		if (reconciled.userId !== userId) {
			throw new OrderInvariantViolationError(
				"Checkout session does not belong to the authenticated user",
			);
		}

		return this.toPaymentOrder(reconciled);
	}

	async getOrderForUser(
		userId: string,
		orderId: string,
	): Promise<PaymentOrder> {
		const order = await this.paymentOrdersRepository.findByIdForUser(
			orderId,
			userId,
		);

		return this.toPaymentOrder(order);
	}

	private async reconcileSession(
		sessionId: string,
		outcome?: CheckoutSessionOrderOutcome,
	): Promise<PaymentOrderRow> {
		const session =
			await this.paymentProvider.retrieveCheckoutSession(sessionId);

		if (session.id !== sessionId) {
			throw new OrderInvariantViolationError(
				`Stripe returned checkout session ${session.id} for requested session ${sessionId}`,
			);
		}

		const orderId = this.orderIdFromSession(session);
		const initialOrder = await this.paymentOrdersRepository.findById(orderId);

		if (!initialOrder) {
			throw new OrderInvariantViolationError(
				`Checkout session ${session.id} references an unknown payment order`,
			);
		}

		const customer = await this.billingCustomersRepository.findByUserId(
			initialOrder.userId,
		);

		if (!customer) {
			throw new OrderInvariantViolationError(
				`Payment order ${initialOrder.id} has no billing customer`,
			);
		}
		this.assertSessionInvariants(
			initialOrder,
			session,
			customer.providerCustomerId,
		);

		const result = await this.paymentOrdersRepository.withLockedById(
			orderId,
			async (order, tx) =>
				this.reconcileLockedOrder(
					order,
					session,
					customer.providerCustomerId,
					tx,
					outcome,
				),
		);

		if (result.shouldRefund) {
			await this.orderRefundDispatcher.triggerRefund({
				failureReason:
					result.order.fulfillmentError ?? "Domain registration failed",
				orderId: result.order.id,
			});
		} else if (result.inspectCharge) {
			const paymentIntentId = result.order.providerPaymentIntentId;

			if (!paymentIntentId) {
				throw new OrderInvariantViolationError(
					`Paid payment order ${result.order.id} has no payment intent`,
				);
			}
			/*
			 * The PI mapping is committed before this fresh Stripe read. A refund
			 * or dispute racing after the read can therefore resolve the order and
			 * compete with domain creation through the shared advisory lock.
			 */
			const financialReversal =
				await this.financialReversalForPaymentIntent(paymentIntentId);

			if (financialReversal) {
				const handled =
					financialReversal.kind === "dispute"
						? await this.orderRefundsService.markRefundedByPaymentIntent({
								cause: "dispute",
								chargeId: financialReversal.chargeId,
								paymentIntentId,
							})
						: await this.orderRefundsService.handleChargeRefundedByPaymentIntent(
								{
									amountCaptured: financialReversal.amountCaptured,
									amountRefunded: financialReversal.amountRefunded,
									chargeId: financialReversal.chargeId,
									paymentIntentId,
								},
							);

				if (!handled) {
					throw new OrderInvariantViolationError(
						`Financially reversed Stripe charge ${financialReversal.chargeId} could not reconcile payment order ${result.order.id}`,
					);
				}
			} else if (result.shouldFulfill) {
				await this.fulfillPaidOrder(result.order);
			}
		} else if (result.shouldFulfill) {
			await this.fulfillPaidOrder(result.order);
		}

		return (
			(await this.paymentOrdersRepository.findById(orderId)) ?? result.order
		);
	}

	private async reconcileLockedOrder(
		order: PaymentOrderRow,
		session: Stripe.Checkout.Session,
		providerCustomerId: string,
		tx: PaymentOrderTransaction,
		outcome?: CheckoutSessionOrderOutcome,
	): Promise<ReconcileResult> {
		this.assertSessionInvariants(order, session, providerCustomerId);

		const paymentStatus = this.requiredString(
			session.payment_status,
			`Checkout session ${session.id} payment status`,
		);
		const paymentIntentId = this.paymentIntentId(session.payment_intent);

		if (session.status === "expired" || outcome === "expired") {
			const canceled = await this.paymentOrdersRepository.markPendingTerminal(
				order.id,
				"canceled",
				{
					fulfillmentError: null,
					paymentIntentId,
					paymentStatus,
					sessionId: session.id,
				},
				tx,
			);

			return {
				inspectCharge: false,
				order: canceled ?? order,
				shouldFulfill: false,
				shouldRefund: false,
			};
		}

		if (outcome === "async_payment_failed" && paymentStatus !== "paid") {
			const failed = await this.paymentOrdersRepository.markPendingTerminal(
				order.id,
				"failed",
				{
					fulfillmentError: "Payment could not be completed",
					paymentIntentId,
					paymentStatus,
					sessionId: session.id,
				},
				tx,
			);

			return {
				inspectCharge: false,
				order: failed ?? order,
				shouldFulfill: false,
				shouldRefund: false,
			};
		}

		if (paymentStatus !== "paid") {
			const recorded = await this.paymentOrdersRepository.recordPaymentState(
				order.id,
				{
					paymentIntentId,
					paymentStatus,
					sessionId: session.id,
				},
				tx,
			);

			return {
				inspectCharge: false,
				order: recorded ?? order,
				shouldFulfill: false,
				shouldRefund: false,
			};
		}

		if (!paymentIntentId) {
			throw new OrderInvariantViolationError(
				`Paid checkout session ${session.id} has no payment intent`,
			);
		}

		const paid = await this.paymentOrdersRepository.markPaid(
			order.id,
			{
				paymentIntentId,
				paymentStatus,
				sessionId: session.id,
			},
			tx,
		);
		const current = paid ?? order;
		const shouldRefund = current.status === "failed";

		return {
			inspectCharge: !shouldRefund,
			order: current,
			shouldFulfill: paid !== null || order.status === "paid",
			shouldRefund,
		};
	}

	private async financialReversalForPaymentIntent(
		paymentIntentId: string,
	): Promise<StripeFinancialReversal | null> {
		const paymentIntent =
			await this.paymentProvider.retrievePaymentIntent(paymentIntentId);
		const chargeReference = paymentIntent.latest_charge;

		if (!chargeReference) {
			throw new OrderInvariantViolationError(
				`Paid payment intent ${paymentIntentId} has no latest charge`,
			);
		}

		const charge =
			typeof chargeReference === "string"
				? await this.paymentProvider.retrieveCharge(chargeReference)
				: chargeReference;
		const chargePaymentIntentId =
			typeof charge.payment_intent === "string"
				? charge.payment_intent
				: charge.payment_intent?.id;

		if (chargePaymentIntentId && chargePaymentIntentId !== paymentIntentId) {
			throw new OrderInvariantViolationError(
				`Stripe charge ${charge.id} does not belong to payment intent ${paymentIntentId}`,
			);
		}

		if (charge.disputed) {
			return { chargeId: charge.id, kind: "dispute" };
		}

		if (
			!Number.isSafeInteger(charge.amount_refunded) ||
			charge.amount_refunded < 0
		) {
			throw new OrderInvariantViolationError(
				`Stripe charge ${charge.id} has an invalid refunded amount`,
			);
		}

		if (charge.amount_refunded > 0 || charge.refunded) {
			if (
				!Number.isSafeInteger(charge.amount_captured) ||
				charge.amount_captured <= 0 ||
				charge.amount_refunded <= 0 ||
				charge.amount_refunded > charge.amount_captured
			) {
				throw new OrderInvariantViolationError(
					`Stripe charge ${charge.id} has inconsistent captured and refunded amounts`,
				);
			}

			return {
				amountCaptured: charge.amount_captured,
				amountRefunded: charge.amount_refunded,
				chargeId: charge.id,
				kind: "refund",
			};
		}

		return null;
	}

	private async fulfillPaidOrder(order: PaymentOrderRow): Promise<void> {
		if (order.status !== "paid") {
			return;
		}

		try {
			await this.fulfillmentRegistry.forKind(order.kind).fulfill(order);
		} catch (error) {
			if (!(error instanceof DomainAlreadyExistsError)) {
				throw error;
			}

			const failureReason = this.httpErrorMessage(error);
			await this.orderRefundDispatcher.triggerRefund({
				failureReason,
				orderId: order.id,
			});
			await this.paymentOrdersRepository.markFailed(order.id, failureReason);

			return;
		}

		await this.paymentOrdersRepository.markFulfilling(order.id);
	}

	private assertSessionInvariants(
		order: PaymentOrderRow,
		session: Stripe.Checkout.Session,
		providerCustomerId: string,
	): void {
		if (session.mode !== "payment") {
			throw new OrderInvariantViolationError(
				`Checkout session ${session.id} must use payment mode`,
			);
		}

		if (session.metadata?.purpose !== CHECKOUT_PURPOSE.order) {
			throw new OrderInvariantViolationError(
				`Checkout session ${session.id} is not an order checkout`,
			);
		}

		if (
			order.providerCheckoutSessionId !== null &&
			order.providerCheckoutSessionId !== session.id
		) {
			throw new OrderInvariantViolationError(
				`Checkout session ${session.id} does not match payment order ${order.id}`,
			);
		}

		const sessionCustomerId = this.customerId(session.customer);

		if (sessionCustomerId !== providerCustomerId) {
			throw new OrderInvariantViolationError(
				`Checkout session ${session.id} customer does not match payment order ${order.id}`,
			);
		}

		if (session.amount_total !== order.amountCents) {
			throw new OrderInvariantViolationError(
				`Checkout session ${session.id} amount does not match payment order ${order.id}`,
			);
		}

		if (session.currency !== order.currency) {
			throw new OrderInvariantViolationError(
				`Checkout session ${session.id} currency does not match payment order ${order.id}`,
			);
		}
	}

	private orderIdFromSession(session: Stripe.Checkout.Session): string {
		const orderId = session.metadata?.orderId;
		const parsed = uuidSchema.safeParse(orderId);

		if (!parsed.success) {
			throw new OrderInvariantViolationError(
				`Checkout session ${session.id} has no valid order id`,
			);
		}

		return parsed.data;
	}

	private customerId(customer: Stripe.Checkout.Session["customer"]): string {
		if (typeof customer !== "string" || customer.length === 0) {
			throw new OrderInvariantViolationError(
				"Checkout session customer must be a string",
			);
		}

		return customer;
	}

	private paymentIntentId(
		paymentIntent: Stripe.Checkout.Session["payment_intent"],
	): string | null {
		if (typeof paymentIntent === "string") {
			return paymentIntent.length > 0 ? paymentIntent : null;
		}

		if (
			paymentIntent &&
			typeof paymentIntent === "object" &&
			"id" in paymentIntent &&
			typeof paymentIntent.id === "string" &&
			paymentIntent.id.length > 0
		) {
			return paymentIntent.id;
		}

		return null;
	}

	private requiredString(value: unknown, label: string): string {
		if (typeof value !== "string" || value.length === 0) {
			throw new OrderInvariantViolationError(
				`${label} must be a non-empty string`,
			);
		}

		return value;
	}

	private httpErrorMessage(error: DomainAlreadyExistsError): string {
		const response = error.getResponse();

		if (
			typeof response === "object" &&
			response !== null &&
			"message" in response &&
			typeof response.message === "string"
		) {
			return response.message;
		}

		return error.message;
	}

	private async toPaymentOrder(
		order: PaymentOrderRow,
		checkoutUrl?: string,
	): Promise<PaymentOrder> {
		const domain = await this.domainsRepository.findByPaymentOrderId(order.id);

		return {
			amountCents: order.amountCents,
			...(checkoutUrl ? { checkoutUrl } : {}),
			createdAt: order.createdAt.toISOString(),
			currency: order.currency,
			...(domain ? { domainId: domain.id } : {}),
			error: order.fulfillmentError,
			fulfilledAt: order.fulfilledAt?.toISOString() ?? null,
			id: order.id,
			kind: order.kind,
			paidAt: order.paidAt?.toISOString() ?? null,
			// Before fulfillment no domain row exists yet, so fall back to the
			// project frozen into the order metadata at checkout time.
			projectId: domain?.projectId ?? this.orderProjectId(order),
			refundStatus: order.refundStatus,
			status: order.status,
		};
	}

	private orderProjectId(order: PaymentOrderRow): string | null {
		if (order.kind !== "domain_registration") {
			return null;
		}

		const metadata = domainRegistrationOrderMetadataSchema.safeParse(
			order.metadata,
		);

		return metadata.success ? (metadata.data.projectId ?? null) : null;
	}
}
