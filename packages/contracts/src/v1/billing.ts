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

// The purchasable unit is 250 credits ($25 Pro / $50 Business) — 1 credit
// retails at exactly $0.10. Tiers double from there Lovable-style, with the
// same volume-discount curve as before (2% / 4% / 6% / 8% / 10% off linear on
// the top five tiers).
export const CREDIT_TIERS = [
	250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500,
] as const;

export type CreditTier = (typeof CREDIT_TIERS)[number];

export const creditTierSchema = z.union([
	z.literal(250),
	z.literal(500),
	z.literal(1000),
	z.literal(2000),
	z.literal(3000),
	z.literal(5000),
	z.literal(7500),
	z.literal(10000),
	z.literal(12500),
]);

export const topupPackIds = ["topup_250", "topup_1000", "topup_2500"] as const;

export const topupPackIdSchema = z.enum(topupPackIds);

export type TopupPackId = z.infer<typeof topupPackIdSchema>;

// Top-ups sell at the base retail rate ($0.10/credit), no volume discount.
export const TOPUP_PACKS = {
	topup_250: { credits: 250, usd: 25 },
	topup_1000: { credits: 1000, usd: 100 },
	topup_2500: { credits: 2500, usd: 250 },
} as const;

export const BILLING_CATALOG = {
	creditTiers: CREDIT_TIERS,
	plans: {
		pro: {
			basePer100Usd: 10,
			features: { seats: false, teamWorkspace: false },
			monthlyPricesUsd: {
				250: 25,
				500: 50,
				1000: 100,
				2000: 200,
				3000: 294,
				5000: 480,
				7500: 705,
				10000: 920,
				12500: 1125,
			},
		},
		// Org workspaces: exactly 2× Pro per tier, unlimited seats — the POOL is
		// what's priced. Purchasable only with org workspace scope (pairing rule).
		business: {
			basePer100Usd: 20,
			features: { seats: true, teamWorkspace: true },
			monthlyPricesUsd: {
				250: 50,
				500: 100,
				1000: 200,
				2000: 400,
				3000: 588,
				5000: 960,
				7500: 1410,
				10000: 1840,
				12500: 2250,
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
	// Decimal credits: computed against the centi-credit plan balance, so a
	// monthly->yearly preview can carry a fractional expiry remainder.
	creditsDelta: z.number(),
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

export const cancellationReasonCodeSchema = z.enum([
	"too_expensive",
	"not_using_enough",
	"missing_features",
	"technical_issues",
	"switching_provider",
	"temporary_pause",
	"other",
]);

export type CancellationReasonCode = z.infer<
	typeof cancellationReasonCodeSchema
>;

export const billingCancelRequestSchema = z
	.object({
		reason: cancellationReasonCodeSchema,
		details: z.string().trim().min(1).max(1000).optional(),
	})
	.superRefine((request, context) => {
		if (request.reason === "other" && request.details === undefined) {
			context.addIssue({
				code: "custom",
				message: "details is required when reason is other",
				path: ["details"],
			});
		}
	});

export type BillingCancelRequest = z.infer<typeof billingCancelRequestSchema>;

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
