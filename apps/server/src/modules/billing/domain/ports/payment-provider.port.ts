import type {
	BillingInterval,
	BillingPlanId,
	CreditTier,
	TopupPackId,
} from "@wandit/contracts";

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

export type CreateSubscriptionCheckoutParams = {
	customerId: string;
	email: string;
	interval: BillingInterval;
	plan: BillingPlanId;
	tierCredits: CreditTier;
	userId: string;
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
	createPortalSession(customerId: string): Promise<string>;
	createSubscriptionCheckout(
		params: CreateSubscriptionCheckoutParams,
	): Promise<string>;
	createTopupCheckout(params: CreateTopupCheckoutParams): Promise<string>;
	ensureCustomer(userId: string, email: string): Promise<string>;
	setCancelAtPeriodEnd(
		providerSubscriptionId: string,
		flag: boolean,
	): Promise<void>;
}
