import { z } from "zod";
import { creditBalanceResponseSchema } from "./credits";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const CHECKOUT_PURPOSE = {
	subscription: "subscription",
	topup: "topup",
	order: "order",
} as const;

export type CheckoutPurpose =
	(typeof CHECKOUT_PURPOSE)[keyof typeof CHECKOUT_PURPOSE];

export const billingPlanIds = ["pro", "business"] as const;

export const billingPlanIdSchema = z.enum(billingPlanIds);

export type BillingPlanId = z.infer<typeof billingPlanIdSchema>;

export const billingIntervals = ["month", "year"] as const;

export const billingIntervalSchema = z.enum(billingIntervals);

export type BillingInterval = z.infer<typeof billingIntervalSchema>;

// Only these Stripe states grant subscription entitlement. In particular,
// `past_due` keeps previously granted credits but does not bypass credit checks.
export const ENTITLED_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export type EntitledSubscriptionStatus =
	(typeof ENTITLED_SUBSCRIPTION_STATUSES)[number];

// The purchasable unit is 200 credits ($30 Pro / $60 Business). Tiers double
// from there Lovable-style, with the same volume-discount curve as before
// (2% / 4% / 6% / 8% / 10% off linear on the top five tiers).
export const CREDIT_TIERS = [
	200, 400, 800, 1600, 2400, 4000, 6000, 8000, 10000,
] as const;

export type CreditTier = (typeof CREDIT_TIERS)[number];

export const creditTierSchema = z.union([
	z.literal(200),
	z.literal(400),
	z.literal(800),
	z.literal(1600),
	z.literal(2400),
	z.literal(4000),
	z.literal(6000),
	z.literal(8000),
	z.literal(10000),
]);

export const topupPackIds = ["topup_200", "topup_1000", "topup_2000"] as const;

export const topupPackIdSchema = z.enum(topupPackIds);

export type TopupPackId = z.infer<typeof topupPackIdSchema>;

// Top-ups sell at the base retail rate ($0.15/credit), no volume discount.
export const TOPUP_PACKS = {
	topup_200: { credits: 200, usd: 30 },
	topup_1000: { credits: 1000, usd: 150 },
	topup_2000: { credits: 2000, usd: 300 },
} as const;

export const BILLING_CATALOG = {
	creditTiers: CREDIT_TIERS,
	plans: {
		pro: {
			basePer100Usd: 15,
			features: { seats: false, teamWorkspace: false },
			monthlyPricesUsd: {
				200: 30,
				400: 60,
				800: 120,
				1600: 240,
				2400: 353,
				4000: 576,
				6000: 846,
				8000: 1104,
				10000: 1350,
			},
		},
		// Org workspaces: exactly 2× Pro per tier, unlimited seats — the POOL is
		// what's priced. Purchasable only with org workspace scope (pairing rule).
		business: {
			basePer100Usd: 30,
			features: { seats: true, teamWorkspace: true },
			monthlyPricesUsd: {
				200: 60,
				400: 120,
				800: 240,
				1600: 480,
				2400: 706,
				4000: 1152,
				6000: 1692,
				8000: 2208,
				10000: 2700,
			},
		},
	},
	topupPacks: TOPUP_PACKS,
	yearlyPriceMultiplier: 10,
} as const;

export function priceUsdFor(
	plan: BillingPlanId,
	tierCredits: CreditTier,
	interval: BillingInterval,
) {
	const monthlyPriceUsd =
		BILLING_CATALOG.plans[plan].monthlyPricesUsd[tierCredits];

	if (interval === "month") {
		return monthlyPriceUsd;
	}

	return monthlyPriceUsd * BILLING_CATALOG.yearlyPriceMultiplier;
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
	entitled: z.boolean(),
	id: uuidSchema,
	userId: z.string(),
	organizationId: z.string().nullable(),
	provider: z.string(),
	providerSubscriptionId: z.string(),
	plan: billingPlanIdSchema,
	tierCredits: creditTierSchema,
	pendingTierCredits: creditTierSchema.nullable(),
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

export const billingSubscriptionChangeTargetSchema = z.object({
	interval: billingIntervalSchema,
	plan: billingPlanIdSchema.optional(),
	tierCredits: creditTierSchema,
});

export type BillingSubscriptionChangeTarget = z.infer<
	typeof billingSubscriptionChangeTargetSchema
>;

export const previewBillingSubscriptionChangeBodySchema =
	billingSubscriptionChangeTargetSchema;

export type PreviewBillingSubscriptionChangeBody = z.infer<
	typeof previewBillingSubscriptionChangeBodySchema
>;

export const billingSubscriptionChangePreviewResponseSchema = z.object({
	intentId: uuidSchema,
	amountDueMinor: z.int(),
	currency: z.string().min(1),
	creditsDelta: z.int(),
	expiresAt: isoDateTimeSchema,
});

export type BillingSubscriptionChangePreviewResponse = z.infer<
	typeof billingSubscriptionChangePreviewResponseSchema
>;

export const changeBillingSubscriptionBodySchema = z.object({
	intentId: uuidSchema,
});

export type ChangeBillingSubscriptionBody = z.infer<
	typeof changeBillingSubscriptionBodySchema
>;

export const billingSubscriptionChangeOutcomeResponseSchema = z.object({
	outcome: z.enum(["applied", "payment_required", "failed"]),
	hostedInvoiceUrl: z.url().optional(),
	pendingExpiresAt: isoDateTimeSchema.optional(),
	subscription: subscriptionSchema,
	balance: creditBalanceResponseSchema,
});

export type BillingSubscriptionChangeOutcomeResponse = z.infer<
	typeof billingSubscriptionChangeOutcomeResponseSchema
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
	changePreview: "/api/v1/billing/change/preview",
	change: "/api/v1/billing/change",
	cancel: "/api/v1/billing/cancel",
	resume: "/api/v1/billing/resume",
	sync: "/api/v1/billing/sync",
	webhook: "/api/webhooks/stripe",
} as const;
