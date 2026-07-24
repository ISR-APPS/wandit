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
	credits: number;
	customerId: string;
	packId: TopupPackId;
	userId: string;
};

export interface PaymentProvider {
	changeSubscription(
		providerSubscriptionId: string,
		newPriceLookupKey: string,
	): Promise<void>;
	createOrderCheckout(
		params: CreateOrderCheckoutParams,
	): Promise<CreateOrderCheckoutResult>;
	createPortalSession(customerId: string): Promise<string>;
	createRefund(params: CreateRefundParams): Promise<Stripe.Refund>;
	createSubscriptionCheckout(
		params: CreateSubscriptionCheckoutParams,
	): Promise<CreateSubscriptionCheckoutResult>;
	createTopupCheckout(params: CreateTopupCheckoutParams): Promise<string>;
	ensureCustomer(userId: string, email: string): Promise<string>;
	expireCheckoutSession(sessionId: string): Promise<void>;
	listSubscriptionsForCustomer(
		providerCustomerId: string,
	): Promise<Stripe.Subscription[]>;
	retrieveCharge(chargeId: string): Promise<Stripe.Charge>;
	retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>;
	retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
	setCancelAtPeriodEnd(
		providerSubscriptionId: string,
		flag: boolean,
	): Promise<void>;
}
