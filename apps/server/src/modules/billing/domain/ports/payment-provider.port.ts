import type {
	BillingInterval,
	BillingPlanId,
	CreditTier,
	PaymentOrderKind,
	TopupPackId,
} from "@wandit/contracts";
import type Stripe from "stripe";

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

export type CreateSubscriptionCheckoutParams = {
	attemptId: string;
	customerId: string;
	email: string;
	interval: BillingInterval;
	plan: BillingPlanId;
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
	credits: number;
	customerId: string;
	packId: TopupPackId;
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

export type ScheduleSubscriptionDowngradeParams = {
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
}
