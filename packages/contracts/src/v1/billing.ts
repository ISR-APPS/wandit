import { z } from "zod";
import { creditBalanceResponseSchema } from "./credits";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const billingPlanIds = ["pro", "business"] as const;

export const billingPlanIdSchema = z.enum(billingPlanIds);

export type BillingPlanId = z.infer<typeof billingPlanIdSchema>;

export const billingIntervals = ["month", "year"] as const;

export const billingIntervalSchema = z.enum(billingIntervals);

export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const CREDIT_TIERS = [
	100, 200, 400, 800, 1200, 2000, 3000, 4000, 5000, 7500, 10000,
] as const;

export type CreditTier = (typeof CREDIT_TIERS)[number];

export const creditTierSchema = z.union([
	z.literal(100),
	z.literal(200),
	z.literal(400),
	z.literal(800),
	z.literal(1200),
	z.literal(2000),
	z.literal(3000),
	z.literal(4000),
	z.literal(5000),
	z.literal(7500),
	z.literal(10000),
]);

export const topupPackIds = ["topup_500", "topup_1000", "topup_2500"] as const;

export const topupPackIdSchema = z.enum(topupPackIds);

export type TopupPackId = z.infer<typeof topupPackIdSchema>;

export const TOPUP_PACKS = {
	topup_500: { credits: 500, usd: 15 },
	topup_1000: { credits: 1000, usd: 28 },
	topup_2500: { credits: 2500, usd: 65 },
} as const;

export const BILLING_CATALOG = {
	creditTiers: CREDIT_TIERS,
	topupPacks: TOPUP_PACKS,
	plans: {
		pro: { basePer100Usd: 25 },
		business: { basePer100Usd: 50 },
	},
	annualDiscount: 0.2,
	volumeDiscounts: [
		{ minCredits: 0, maxCredits: 400, discount: 0 },
		{ minCredits: 800, maxCredits: 2000, discount: 0.05 },
		{ minCredits: 3000, maxCredits: 5000, discount: 0.1 },
		{ minCredits: 7500, maxCredits: 10000, discount: 0.15 },
	],
} as const;

function volumeDiscountFor(tierCredits: CreditTier) {
	const volumeDiscount = BILLING_CATALOG.volumeDiscounts.find(
		(discount) =>
			tierCredits >= discount.minCredits && tierCredits <= discount.maxCredits,
	);

	return volumeDiscount?.discount ?? 0;
}

export function priceUsdFor(
	plan: BillingPlanId,
	tierCredits: CreditTier,
	interval: BillingInterval,
) {
	const basePer100Usd = BILLING_CATALOG.plans[plan].basePer100Usd;
	const monthlyPriceUsd = Math.ceil(
		basePer100Usd * (tierCredits / 100) * (1 - volumeDiscountFor(tierCredits)),
	);

	if (interval === "month") {
		return monthlyPriceUsd;
	}

	return (
		Math.round(
			monthlyPriceUsd * 12 * (1 - BILLING_CATALOG.annualDiscount) * 100,
		) / 100
	);
}

export function priceLookupKey(
	plan: BillingPlanId,
	tierCredits: CreditTier,
	interval: BillingInterval,
) {
	return `${plan}_${tierCredits}_${interval}`;
}

export type ParsedPriceLookupKey = {
	interval: BillingInterval;
	plan: BillingPlanId;
	tierCredits: CreditTier;
};

export function parsePriceLookupKey(
	lookupKey: string,
): ParsedPriceLookupKey | null {
	const [plan, tierCreditsValue, interval, unexpected] = lookupKey.split("_");

	if (unexpected || !plan || !tierCreditsValue || !interval) {
		return null;
	}

	if (!isBillingPlanId(plan) || !isBillingInterval(interval)) {
		return null;
	}

	const tierCredits = Number(tierCreditsValue);

	if (!Number.isInteger(tierCredits) || !isCreditTier(tierCredits)) {
		return null;
	}

	return {
		interval,
		plan,
		tierCredits,
	};
}

function isBillingPlanId(value: string): value is BillingPlanId {
	return (billingPlanIds as readonly string[]).includes(value);
}

function isBillingInterval(value: string): value is BillingInterval {
	return (billingIntervals as readonly string[]).includes(value);
}

function isCreditTier(value: number): value is CreditTier {
	return (CREDIT_TIERS as readonly number[]).includes(value);
}

export const subscriptionSchema = z.object({
	id: uuidSchema,
	userId: z.string(),
	organizationId: z.string().nullable(),
	provider: z.string(),
	providerSubscriptionId: z.string(),
	plan: billingPlanIdSchema,
	tierCredits: creditTierSchema,
	interval: billingIntervalSchema,
	status: z.string(),
	priceLookupKey: z.string(),
	currentPeriodStart: isoDateTimeSchema,
	currentPeriodEnd: isoDateTimeSchema,
	cancelAtPeriodEnd: z.boolean(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const billingTierPriceSchema = z.object({
	annualLookupKey: z.string(),
	annualUsd: z.number(),
	monthlyLookupKey: z.string(),
	monthlyUsd: z.number(),
	tierCredits: creditTierSchema,
});

export type BillingTierPrice = z.infer<typeof billingTierPriceSchema>;

export const billingPlanCatalogItemSchema = z.object({
	basePer100Usd: z.number(),
	features: z.object({
		seats: z.boolean(),
		teamWorkspace: z.boolean(),
	}),
	id: billingPlanIdSchema,
	tiers: z.array(billingTierPriceSchema),
});

export type BillingPlanCatalogItem = z.infer<
	typeof billingPlanCatalogItemSchema
>;

export const billingTopupPackSchema = z.object({
	credits: z.int(),
	id: topupPackIdSchema,
	lookupKey: z.string(),
	usd: z.number(),
});

export type BillingTopupPack = z.infer<typeof billingTopupPackSchema>;

export const billingPlansResponseSchema = z.object({
	plans: z.array(billingPlanCatalogItemSchema),
	topupPacks: z.array(billingTopupPackSchema),
});

export type BillingPlansResponse = z.infer<typeof billingPlansResponseSchema>;

export const billingSubscriptionViewResponseSchema = z.object({
	balance: creditBalanceResponseSchema,
	subscription: subscriptionSchema.nullable(),
});

export type BillingSubscriptionViewResponse = z.infer<
	typeof billingSubscriptionViewResponseSchema
>;

export const createBillingCheckoutBodySchema = z.object({
	plan: billingPlanIdSchema,
	tierCredits: creditTierSchema,
	interval: billingIntervalSchema,
});

export type CreateBillingCheckoutBody = z.infer<
	typeof createBillingCheckoutBodySchema
>;

export const createBillingTopupBodySchema = z.object({
	packId: topupPackIdSchema,
});

export type CreateBillingTopupBody = z.infer<
	typeof createBillingTopupBodySchema
>;

export const changeBillingSubscriptionBodySchema = z.object({
	tierCredits: creditTierSchema,
	interval: billingIntervalSchema,
});

export type ChangeBillingSubscriptionBody = z.infer<
	typeof changeBillingSubscriptionBodySchema
>;

export const billingCheckoutResponseSchema = z.object({
	url: z.url(),
});

export type BillingCheckoutResponse = z.infer<
	typeof billingCheckoutResponseSchema
>;

export const billingPortalResponseSchema = z.object({
	url: z.url(),
});

export type BillingPortalResponse = z.infer<typeof billingPortalResponseSchema>;

export const billingRoutes = {
	plans: "/api/v1/billing/plans",
	subscription: "/api/v1/billing/subscription",
	checkout: "/api/v1/billing/checkout",
	topup: "/api/v1/billing/topup",
	portal: "/api/v1/billing/portal",
	change: "/api/v1/billing/change",
	cancel: "/api/v1/billing/cancel",
	resume: "/api/v1/billing/resume",
	webhook: "/api/webhooks/stripe",
} as const;
