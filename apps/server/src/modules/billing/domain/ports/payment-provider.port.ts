/**
 * Port between billing services and the payment provider, with its param and result types.
 * Billing services and the orders service inject it by the PAYMENT_PROVIDER token.
 * billing-payments.module.ts binds the token to StripeProvider.
 */
import type { PaymentOrderKind } from "@wandit/contracts";
import type Stripe from "stripe";

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

/** Session id and hosted URL of a new Stripe Checkout Session. */
export type CreateCheckoutSessionResult = {
	id: string;
	url: string;
};

export type CreateOrderCheckoutParams = {
	amountCents: number;
	cancelUrl: string;
	currency: string;
	customerId: string;
	kind: PaymentOrderKind;
	orderId: string;
	productName: string;
	successUrl: string;
	userId: string;
};

export type CreateRefundParams = {
	idempotencyKey: string;
	paymentIntentId: string;
};

/**
 * Input of a wallet top-up Checkout Session. BillingService builds it from the
 * persisted attempt row, so a replay sends the same bytes for the same idempotency key.
 */
export type CreateTopupCheckoutParams = {
	/** Id of the `billing_checkout_attempts` row. Part of the Stripe idempotency key. */
	attemptId: string;
	/** UNIT: USD cents. The `amount_usd_cents` column of the attempt row. */
	amountUsdCents: number;
	/** Whole credits at the base rate, before the bonus. Only the Stripe page text shows it. */
	baseCredits: number;
	/** Whole credits of the volume bonus. 0 below the first tier. Only the Stripe page text shows it. */
	bonusCredits: number;
	customerId: string;
	/** Set for team top-ups: the pool that receives the credits. */
	organizationId: string | null;
	userId: string;
};

/** Input of the v6 price switch. Only `scripts/migrate-subscriptions-v6.ts` calls it, on StripeProvider. */
export type SwitchSubscriptionPriceWithoutProrationParams = {
	currentPriceLookupKey: string;
	idempotencyKey: string;
	newPriceLookupKey: string;
	providerSubscriptionId: string;
};

/** Input of the v6 downgrade schedule. Only `scripts/migrate-subscriptions-v6.ts` calls it, on StripeProvider. */
export type ScheduleSubscriptionDowngradeParams = {
	/** Recover only a schedule stamped with this same idempotency key and target. */
	allowSameIntentRecovery?: boolean;
	currentPriceLookupKey: string;
	expectedScheduleTarget: string | null;
	idempotencyKey: string;
	newPriceLookupKey: string;
	providerSubscriptionId: string;
};

export interface PaymentProvider {
	createOrderCheckout(
		params: CreateOrderCheckoutParams,
	): Promise<CreateCheckoutSessionResult>;
	createPortalSession(customerId: string): Promise<string>;
	createRefund(params: CreateRefundParams): Promise<Stripe.Refund>;
	createTopupCheckout(
		params: CreateTopupCheckoutParams,
	): Promise<CreateCheckoutSessionResult>;
	ensureCustomer(
		userId: string,
		email: string,
		affiliateCode?: string | null,
	): Promise<string>;
	ensureOrganizationCustomer(params: {
		affiliateCode?: string | null;
		attributionUserId: string;
		billingEmail: string;
		createdByUserId: string;
		organizationId: string;
		organizationName: string;
	}): Promise<string>;
	expireCheckoutSession(
		sessionId: string,
	): Promise<Stripe.Checkout.Session["status"]>;
	listSubscriptionsForCustomer(
		providerCustomerId: string,
	): Promise<Stripe.Subscription[]>;
	retrieveCharge(chargeId: string): Promise<Stripe.Charge>;
	retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>;
	retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
}
