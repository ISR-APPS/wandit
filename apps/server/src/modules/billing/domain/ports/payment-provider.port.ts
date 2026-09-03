import type {
	BillingInterval,
	BillingPlanId,
	CreditTier,
	PaymentOrderKind,
	PersistedTopupPackId,
} from "@wandit/contracts";
import type Stripe from "stripe";

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

export type CreateSubscriptionCheckoutParams = {
	attemptId: string;
	customerId: string;
	email: string;
	interval: BillingInterval;
	/** Set for org (Business) checkouts: the paying pool's identity. */
	organizationId?: string | null;
	plan: BillingPlanId;
	/**
	 * WHOLE display credits (Stripe-boundary unit): tier identity embedded in
	 * price lookup keys and session metadata — never centi-credits.
	 */
	tierCredits: CreditTier;
	userId: string;
};

export type CreateSubscriptionCheckoutResult = {
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

export type CreateOrderCheckoutResult = {
	id: string;
	url: string;
};

export type CreateRefundParams = {
	idempotencyKey: string;
	paymentIntentId: string;
};

export type CreateTopupCheckoutParams = {
	attemptId: string;
	/**
	 * WHOLE display credits (Stripe-boundary unit): the pack's credit count as
	 * stamped into session metadata — never centi-credits. The grant path
	 * converts x100 once when writing the ledger.
	 */
	credits: number;
	customerId: string;
	/** Set for org top-ups: the pool that receives the credits. */
	organizationId?: string | null;
	// Internal recovery can replay a checkout attempt written before a pack was
	// retired. Public request schemas still accept only current TopupPackId ids.
	packId: PersistedTopupPackId;
	userId: string;
};

export type PreviewSubscriptionChangeParams = {
	billingCycleAnchorNow: boolean;
	newPriceLookupKey: string;
	prorationDate: Date;
	providerSubscriptionId: string;
};

export type ApplySubscriptionChangeParams = PreviewSubscriptionChangeParams & {
	idempotencyKey: string;
};

export type SubscriptionChangeProviderResult = {
	hostedInvoiceUrl?: string;
	outcome: "applied" | "failed" | "payment_required";
	pendingExpiresAt?: Date;
};

export type SwitchSubscriptionPriceWithoutProrationParams = {
	currentPriceLookupKey: string;
	idempotencyKey: string;
	newPriceLookupKey: string;
	providerSubscriptionId: string;
};

export type ScheduleSubscriptionDowngradeParams = {
	/** Recover only a schedule stamped with this same idempotency key and target. */
	allowSameIntentRecovery?: boolean;
	currentPriceLookupKey: string;
	expectedScheduleTarget: string | null;
	idempotencyKey: string;
	newPriceLookupKey: string;
	providerSubscriptionId: string;
};

export type SubscriptionChangePreviewProviderResult = {
	amountDueMinor: number;
	currency: string;
};

export interface PaymentProvider {
	cancelScheduledSubscriptionDowngrade(
		providerSubscriptionId: string,
		idempotencyKey: string,
	): Promise<void>;
	changeSubscription(
		params: ApplySubscriptionChangeParams,
	): Promise<SubscriptionChangeProviderResult>;
	createOrderCheckout(
		params: CreateOrderCheckoutParams,
	): Promise<CreateOrderCheckoutResult>;
	createPortalSession(customerId: string): Promise<string>;
	createRefund(params: CreateRefundParams): Promise<Stripe.Refund>;
	createSubscriptionCheckout(
		params: CreateSubscriptionCheckoutParams,
	): Promise<CreateSubscriptionCheckoutResult>;
	createTopupCheckout(
		params: CreateTopupCheckoutParams,
	): Promise<CreateSubscriptionCheckoutResult>;
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
	hasPendingSubscriptionUpdate(
		providerSubscriptionId: string,
	): Promise<boolean>;
	previewSubscriptionChange(
		params: PreviewSubscriptionChangeParams,
	): Promise<SubscriptionChangePreviewProviderResult>;
	retrieveCharge(chargeId: string): Promise<Stripe.Charge>;
	retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>;
	retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
	scheduleSubscriptionDowngrade(
		params: ScheduleSubscriptionDowngradeParams,
	): Promise<string>;
	setCancelAtPeriodEnd(
		providerSubscriptionId: string,
		flag: boolean,
	): Promise<void>;
	switchSubscriptionPriceWithoutProration(
		params: SwitchSubscriptionPriceWithoutProrationParams,
	): Promise<void>;
}
