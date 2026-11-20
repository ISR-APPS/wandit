/**
 * Defines billing payloads for API handlers and app clients.
 * Uses Zod and shared primitives to validate billing data.
 */
import { z } from "zod";
import { creditBalanceResponseSchema } from "./credits";
import { dzdPerUsdRateSchema } from "./settings";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const CHECKOUT_PURPOSE = {
	subscription: "subscription",
	topup: "topup",
	order: "order",
} as const;

export type CheckoutPurpose =
	(typeof CHECKOUT_PURPOSE)[keyof typeof CHECKOUT_PURPOSE];

export const billingPlanIds = ["starter", "pro", "business"] as const;

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

// Pricing v7 (1 credit = $0.032 of AI) restores the 250-credit Pro/Business
// ladder and a 60-credit Starter; the v6 tiers (50, 175 ... 8750) stay as
// legacy Stripe tier identities. Pricing v6 separated tiers offered to new
// buyers from legacy identities. CREDIT_TIERS is the parse/validation universe; purchase flows
// must use PLAN_TIERS or isPurchasableTier so legacy subscriptions keep
// working without retired tiers returning to the plan picker.
export const LEGACY_CREDIT_TIERS = [
	50, 175, 350, 700, 1400, 2100, 3500, 5250, 7000, 8750,
] as const;

export const CREDIT_TIERS = [
	50, 60, 175, 250, 350, 500, 700, 1000, 1400, 2000, 2100, 3000, 3500, 5000,
	5250, 7000, 7500, 8750, 10000, 12500,
] as const;

export type CreditTier = (typeof CREDIT_TIERS)[number];

export type LegacyCreditTier = (typeof LEGACY_CREDIT_TIERS)[number];

export const creditTierSchema = z.literal(CREDIT_TIERS);

export const PLAN_TIERS = {
	starter: [60],
	pro: [250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500],
	business: [250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500],
} as const satisfies Record<BillingPlanId, readonly CreditTier[]>;

/**
 * Plans a workspace can start a new subscription on.
 * Starter is not here: it is a retention offer for a current subscriber.
 * The cancel dialog on /billing schedules it at renewal through the change flow.
 */
export function isNewSubscriptionPlan(plan: BillingPlanId): boolean {
	return plan !== "starter";
}

export function purchasableTiersFor(
	plan: BillingPlanId,
): readonly CreditTier[] {
	return PLAN_TIERS[plan];
}

export function isPurchasableTier(
	plan: BillingPlanId,
	tierCredits: number,
): tierCredits is CreditTier {
	return (PLAN_TIERS[plan] as readonly number[]).includes(tierCredits);
}

export function isLegacyTier(
	tierCredits: number,
): tierCredits is LegacyCreditTier {
	return (LEGACY_CREDIT_TIERS as readonly number[]).includes(tierCredits);
}

export function isKnownTier(tierCredits: number): tierCredits is CreditTier {
	return (CREDIT_TIERS as readonly number[]).includes(tierCredits);
}

export const topupPackIds = ["topup_250", "topup_1000", "topup_2500"] as const;

export const topupPackIdSchema = z.enum(topupPackIds);

export type TopupPackId = z.infer<typeof topupPackIdSchema>;

// Old ids are stored in checkout attempts, receipts, Stripe metadata, and
// credit-ledger metadata. Historical readers accept both sets; new checkout
// requests and the public catalog use topupPackIdSchema/topupPackIds only.
export const LEGACY_TOPUP_PACK_IDS = [
	"topup_175",
	"topup_700",
	"topup_1750",
] as const;

export type LegacyTopupPackId = (typeof LEGACY_TOPUP_PACK_IDS)[number];

export const persistedTopupPackIds = [
	...topupPackIds,
	...LEGACY_TOPUP_PACK_IDS,
] as const;

export const persistedTopupPackIdSchema = z.enum(persistedTopupPackIds);

export type PersistedTopupPackId = z.infer<typeof persistedTopupPackIdSchema>;

// Pricing v7 packs. Pricing v8 sells an amount in USD, not a pack. For one
// release POST /billing/topup still accepts a pack id from a cached web bundle.
// The API then charges `usd` of the pack and grants topupCreditsForUsd(usd), bonus included.
export const TOPUP_PACKS = {
	topup_250: { credits: 250, usd: 25 },
	topup_1000: { credits: 1000, usd: 100 },
	topup_2500: { credits: 2500, usd: 250 },
} as const;

// v6 packs: persisted in receipts/metadata; never purchasable again.
export const LEGACY_TOPUP_PACKS = {
	topup_175: { credits: 175, usd: 25 },
	topup_700: { credits: 700, usd: 100 },
	topup_1750: { credits: 1750, usd: 250 },
} as const;

export const PERSISTED_TOPUP_PACKS = {
	...TOPUP_PACKS,
	...LEGACY_TOPUP_PACKS,
} as const satisfies Record<
	PersistedTopupPackId,
	{ readonly credits: number; readonly usd: number }
>;

/** Pricing v8.1 wallet top-up presets, in whole USD. The web shows one button for each. */
export const TOPUP_PRESET_AMOUNTS_USD = [10, 20, 40, 100, 200] as const;

/** Smallest top-up of one payment, in whole USD. */
export const TOPUP_MIN_AMOUNT_USD = 10;

// LIMIT: the maximum is for one payment, not for one owner per day. Upgrade: a daily sum from `billing_topup_receipts`.
/** Largest top-up of one payment, in whole USD. */
export const TOPUP_MAX_AMOUNT_USD = 1000;

/** Base rate of pricing v8: whole credits for 1 USD, before the bonus. Same for personal and team wallets. */
export const TOPUP_CREDITS_PER_USD = 10;

/** One step of the volume bonus. A top-up of `minAmountUsd` whole USD or more gets `bonusPercent` of its base credits. */
export type TopupBonusTier = {
	readonly minAmountUsd: number;
	readonly bonusPercent: number;
};

/**
 * Volume bonus of pricing v8.1, in ascending `minAmountUsd` order. It reverses founder decision D4 ("no volume bonus").
 * An empty list gives the flat rate again, and the web then hides the bonus track.
 */
export const TOPUP_BONUS_TIERS: readonly TopupBonusTier[] = [
	{ minAmountUsd: 40, bonusPercent: 5 },
	{ minAmountUsd: 100, bonusPercent: 10 },
	{ minAmountUsd: 200, bonusPercent: 15 },
];

/** The credits of one top-up. All counts are whole credits. `topupQuoteForUsd` makes it. */
export type TopupQuote = {
	/** Whole USD of the top-up. */
	amountUsd: number;
	/** `amountUsd * TOPUP_CREDITS_PER_USD`. */
	baseCredits: number;
	/** Percent of the tier that the amount reaches. 0 below the first tier. */
	bonusPercent: number;
	/** `baseCredits * bonusPercent / 100`, rounded down. */
	bonusCredits: number;
	/** `baseCredits + bonusCredits`. The webhook grants this number. */
	credits: number;
	/** First tier above the amount that one payment can reach. Null at the top tier. The web shows it as a nudge. */
	nextTier: TopupBonusTier | null;
};

/**
 * Whole USD of one top-up (Stripe, SlickPay, offline request). The server parses every body with it.
 * Integer only, so the credit math below never gives a fraction of a credit.
 */
export const topupAmountUsdSchema = z
	.int()
	.min(TOPUP_MIN_AMOUNT_USD)
	.max(TOPUP_MAX_AMOUNT_USD);

/**
 * Base, bonus, and total whole credits of a top-up of `amountUsd` whole USD.
 * It accepts each positive safe integer, also below the minimum and above the maximum: the offline path needs it.
 * Throws a RangeError on other values, so a bug cannot grant a fraction or a negative amount.
 */
export function topupQuoteForUsd(amountUsd: number): TopupQuote {
	if (!Number.isSafeInteger(amountUsd) || amountUsd <= 0) {
		throw new RangeError(
			`Top-up amount must be a positive whole USD amount, got ${amountUsd}`,
		);
	}
	// The tier of the amount is the last tier that it reaches. The list is in ascending order.
	const tier = TOPUP_BONUS_TIERS.filter(
		(candidate) => candidate.minAmountUsd <= amountUsd,
	).at(-1);
	const nextTier =
		TOPUP_BONUS_TIERS.find(
			(candidate) =>
				candidate.minAmountUsd > amountUsd &&
				candidate.minAmountUsd <= TOPUP_MAX_AMOUNT_USD,
		) ?? null;
	const baseCredits = amountUsd * TOPUP_CREDITS_PER_USD;
	const bonusPercent = tier?.bonusPercent ?? 0;
	// Round down, so the bonus never grants a fraction of a credit.
	const bonusCredits = Math.floor((baseCredits * bonusPercent) / 100);
	return {
		amountUsd,
		baseCredits,
		bonusPercent,
		bonusCredits,
		credits: baseCredits + bonusCredits,
		nextTier,
	};
}

/**
 * Whole credits, bonus included, that a top-up of `amountUsd` whole USD buys.
 * The Stripe, SlickPay, offline, and admin paths call it. The server multiplies the result by 100 for the ledger.
 * Throws the RangeError of `topupQuoteForUsd`.
 */
export function topupCreditsForUsd(amountUsd: number): number {
	return topupQuoteForUsd(amountUsd).credits;
}

/**
 * Smallest whole USD, from TOPUP_MIN_AMOUNT_USD to TOPUP_MAX_AMOUNT_USD, whose credits cover `shortfallCredits`.
 * The shortfall is in decimal display credits. The web uses the result as the default amount after a 402 answer.
 * Returns TOPUP_MAX_AMOUNT_USD when no amount covers the shortfall.
 */
export function smallestTopupCovering(shortfallCredits: number): number {
	for (
		let amountUsd = TOPUP_MIN_AMOUNT_USD;
		amountUsd < TOPUP_MAX_AMOUNT_USD;
		amountUsd++
	) {
		if (topupCreditsForUsd(amountUsd) >= shortfallCredits) {
			return amountUsd;
		}
	}
	return TOPUP_MAX_AMOUNT_USD;
}

export const BILLING_CATALOG = {
	creditTiers: CREDIT_TIERS,
	plans: {
		starter: {
			basePer100Usd: 15,
			features: { seats: false, teamWorkspace: false },
			monthlyPricesUsd: {
				50: 9,
				60: 9,
			},
		},
		pro: {
			basePer100Usd: (25 / 250) * 100,
			features: { seats: false, teamWorkspace: false },
			monthlyPricesUsd: {
				175: 25,
				250: 25,
				350: 50,
				500: 50,
				700: 100,
				1000: 100,
				1400: 200,
				2000: 200,
				2100: 294,
				3000: 294,
				3500: 480,
				5000: 480,
				5250: 705,
				7000: 920,
				7500: 705,
				8750: 1125,
				10000: 920,
				12500: 1125,
			},
		},
		// Org workspaces: exactly 2× Pro per tier, unlimited seats — the POOL is
		// what's priced. Purchasable only with org workspace scope (pairing rule).
		business: {
			basePer100Usd: (50 / 250) * 100,
			features: { seats: true, teamWorkspace: true },
			monthlyPricesUsd: {
				175: 50,
				250: 50,
				350: 100,
				500: 100,
				700: 200,
				1000: 200,
				1400: 400,
				2000: 400,
				2100: 588,
				3000: 588,
				3500: 960,
				5000: 960,
				5250: 1410,
				7000: 1840,
				7500: 1410,
				8750: 2250,
				10000: 1840,
				12500: 2250,
			},
		},
	},
	topupPacks: TOPUP_PACKS,
	yearlyPriceMultiplier: 10,
} as const;

/**
 * The purchasable tier of `plan` that costs the same per month as a legacy
 * tier (175 -> 250, 350 -> 500, starter 50 -> 60). Null when the tier is not
 * legacy or no purchasable tier carries that price.
 */
export function purchasableTierForLegacy(
	plan: BillingPlanId,
	tierCredits: number,
): CreditTier | null {
	if (!isLegacyTier(tierCredits)) return null;
	const prices = BILLING_CATALOG.plans[plan].monthlyPricesUsd as Partial<
		Record<CreditTier, number>
	>;
	const legacyPrice = prices[tierCredits];
	if (legacyPrice === undefined) return null;
	return (
		(PLAN_TIERS[plan] as readonly CreditTier[]).find(
			(tier) => prices[tier] === legacyPrice,
		) ?? null
	);
}

export function priceUsdFor(
	plan: BillingPlanId,
	tierCredits: CreditTier,
	interval: BillingInterval,
): number {
	const priceUsd = tryPriceUsdFor(plan, tierCredits, interval);

	if (priceUsd === null) {
		throw new Error(
			`No billing price for plan "${plan}" at ${tierCredits} credits`,
		);
	}

	return priceUsd;
}

export function tryPriceUsdFor(
	plan: BillingPlanId,
	tierCredits: number,
	interval: BillingInterval,
): number | null {
	const prices = BILLING_CATALOG.plans[plan].monthlyPricesUsd as Readonly<
		Partial<Record<CreditTier, number>>
	>;
	const monthlyPriceUsd = prices[tierCredits as CreditTier];

	if (monthlyPriceUsd === undefined) {
		return null;
	}

	return interval === "month"
		? monthlyPriceUsd
		: monthlyPriceUsd * BILLING_CATALOG.yearlyPriceMultiplier;
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

	if (
		!Number.isInteger(tierCredits) ||
		!isKnownTier(tierCredits) ||
		tryPriceUsdFor(plan, tierCredits, "month") === null
	) {
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

export const subscriptionSchema = z.object({
	entitled: z.boolean(),
	id: uuidSchema,
	userId: z.string(),
	organizationId: z.string().nullable(),
	provider: z.string(),
	providerSubscriptionId: z.string(),
	plan: billingPlanIdSchema,
	tierCredits: creditTierSchema,
	// Optional for older API responses; same-plan pending tiers use the live plan.
	pendingPlan: billingPlanIdSchema.nullable().optional(),
	pendingInterval: billingIntervalSchema.nullable().optional(),
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

/**
 * Body of POST billingRoutes.topup. The new web sends `{ amountUsd }`.
 * `{ packId }` comes from a cached pricing v7 web bundle, for one release only.
 * Strict objects: a body with both keys, or an unknown key, is a 400.
 */
export const createBillingTopupBodySchema = z.union([
	z.strictObject({ amountUsd: topupAmountUsdSchema }),
	z.strictObject({ packId: topupPackIdSchema }),
]);

export type CreateBillingTopupBody = z.infer<
	typeof createBillingTopupBodySchema
>;

/**
 * Answer of GET billingRoutes.wallet for the active workspace. Each member can read it.
 * The web wallet page and the top-up dialog read it. The API computes every credit count.
 */
export const billingWalletResponseSchema = z.object({
	// Decimal display credits. Clients show `settledBalance` as the one wallet number.
	balance: creditBalanceResponseSchema,
	// True when the pool has a top-up ledger row, or had a subscription.
	isPaidOwner: z.boolean(),
	// True when the pool has a Stripe customer, so the portal shows old invoices.
	hasStripeCustomer: z.boolean(),
	// Decimal display credits: net consumption of this wallet in the last 30 days (consume minus refunds).
	spentLast30DaysCredits: z.number().nonnegative(),
	topup: z.object({
		// The `topups_enabled` product setting. False hides the card top-up.
		enabled: z.boolean(),
		// Whole USD. Copies of the TOPUP_* constants, so the web never hard-codes them.
		presetAmountsUsd: z.array(z.int().positive()),
		minAmountUsd: z.int().positive(),
		maxAmountUsd: z.int().positive(),
		// Base rate, before the bonus. Use topupQuoteForUsd for the credits of an amount.
		creditsPerUsd: z.int().positive(),
	}),
});

export type BillingWalletResponse = z.infer<typeof billingWalletResponseSchema>;

/**
 * Query of GET billingRoutes.topupStatus. The web return page sends the Stripe Checkout Session id.
 * Stripe session ids start with "cs_". The pattern refuses any other text before the database read.
 */
export const billingTopupStatusQuerySchema = z.object({
	sessionId: z
		.string()
		.max(255)
		.regex(/^cs_[A-Za-z0-9_]+$/, "Invalid checkout session id"),
});

export type BillingTopupStatusQuery = z.infer<
	typeof billingTopupStatusQuerySchema
>;

/**
 * Answer of GET billingRoutes.topupStatus. "credited" means the receipt of the session exists for the caller.
 * The return page polls while the status is "pending".
 */
export const billingTopupStatusResponseSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("pending") }),
	z.object({
		status: z.literal("credited"),
		// Decimal credits that the receipt granted, bonus included. Null for an old pack receipt with an unknown pack id.
		credits: z.number().nonnegative().nullable(),
	}),
]);

export type BillingTopupStatusResponse = z.infer<
	typeof billingTopupStatusResponseSchema
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

// ---------------------------------------------------------------------------
// Offline / manual billing ("cash on delivery", wire transfer, CCP…).
//
// Pricing v8: a user who cannot pay by card files an offline REQUEST for a
// top-up amount. An admin calls the contact, collects the money outside
// Stripe, and records a top-up in the admin app. That writes one receipt in
// `billing_topup_receipts` and approves the request. Requests and manual
// subscriptions from before v8 keep their plan columns for history.
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_PROVIDERS = {
	manual: "manual",
	stripe: "stripe",
} as const;

export type SubscriptionProvider =
	(typeof SUBSCRIPTION_PROVIDERS)[keyof typeof SUBSCRIPTION_PROVIDERS];

export function isManualSubscription(
	subscription: Pick<Subscription, "provider"> | null | undefined,
): boolean {
	return subscription?.provider === SUBSCRIPTION_PROVIDERS.manual;
}

/**
 * Ways to pay for a manual subscription. Equals the pgEnum manual_payment_method in packages/db.
 * The API records "slickpay" after a SlickPay card payment. An admin can also pick it to resolve a payment by hand.
 */
export const manualPaymentMethods = [
	"cash_on_delivery",
	"bank_transfer",
	"ccp",
	"baridimob",
	"slickpay",
	"other",
] as const;

export const manualPaymentMethodSchema = z.enum(manualPaymentMethods);

export type ManualPaymentMethod = z.infer<typeof manualPaymentMethodSchema>;

/**
 * Methods a customer can name as "preferred" on an offline request.
 * "slickpay" is not in the list: SlickPay has its own checkout, not an offline call.
 */
export const preferredPaymentMethodSchema = manualPaymentMethodSchema.exclude([
	"slickpay",
]);

export type PreferredPaymentMethod = z.infer<
	typeof preferredPaymentMethodSchema
>;

/**
 * Values of `billing_topup_receipts.provider`. The db column is text with a check of the same list.
 * offline: an admin recorded the money with "Record top-up".
 */
export const topupReceiptProviders = ["stripe", "slickpay", "offline"] as const;

export const topupReceiptProviderSchema = z.enum(topupReceiptProviders);

export type TopupReceiptProvider = z.infer<typeof topupReceiptProviderSchema>;

/** One row of GET billingRoutes.payments: one receipt of the wallet, any provider. */
export const billingWalletPaymentSchema = z.object({
	// Id of the row in `billing_topup_receipts`.
	id: uuidSchema,
	provider: topupReceiptProviderSchema,
	// Null for a Stripe or SlickPay receipt. The admin picks it for an offline receipt.
	method: manualPaymentMethodSchema.nullable(),
	// Money received, in the minor unit of `currency` (USD cents, DZD centimes).
	amountMinor: z.int().min(0),
	// ISO 4217 code in lower case ("usd", "dzd").
	currency: z.string(),
	// USD value that set the credits, in cents. Null for a receipt from before pricing v8.
	amountUsdCents: z.int().positive().nullable(),
	// Decimal display credits granted. Null for a receipt from before pricing v8.
	credits: z.number().positive().nullable(),
	paidAt: isoDateTimeSchema,
	// Decimal display credits that a Stripe refund or dispute took back. Null when the receipt has no charge id.
	revokedCredits: z.number().nullable(),
	// Set when an admin reversed a SlickPay or offline receipt.
	reversedAt: isoDateTimeSchema.nullable(),
});

export type BillingWalletPayment = z.infer<typeof billingWalletPaymentSchema>;

/** Answer of GET billingRoutes.payments: the last 50 receipts of the pool, newest first. */
export const billingPaymentsResponseSchema = z.object({
	items: z.array(billingWalletPaymentSchema),
});

export type BillingPaymentsResponse = z.infer<
	typeof billingPaymentsResponseSchema
>;

// no_answer: the customer does not answer the call. call_back: the customer asks for another call, or the admin plans one.
// wrong_number: the phone number does not reach the customer.
// awaiting_payment: the customer agrees and the admin waits for the money.
export const manualSubscriptionRequestStatuses = [
	"pending",
	"contacted",
	"no_answer",
	"call_back",
	"wrong_number",
	"awaiting_payment",
	"approved",
	"rejected",
	"canceled",
] as const;

export const manualSubscriptionRequestStatusSchema = z.enum(
	manualSubscriptionRequestStatuses,
);

export type ManualSubscriptionRequestStatus = z.infer<
	typeof manualSubscriptionRequestStatusSchema
>;

/** These requests still need admin action and can fund a grant or renewal. */
export const OPEN_MANUAL_REQUEST_STATUSES = [
	"pending",
	"contacted",
	"no_answer",
	"call_back",
	"wrong_number",
	"awaiting_payment",
] as const;

export const manualBillingCountries = ["DZ", "TN", "MA", "OTHER"] as const;

export const manualBillingCountrySchema = z.enum(manualBillingCountries);

export type ManualBillingCountry = z.infer<typeof manualBillingCountrySchema>;

// Loose international phone check: leading + or digit, then digits with the usual separators.
// The admin calls the number, or SlickPay shows it on the invoice. The check rejects only bad input.
const phoneSchema = z
	.string()
	.trim()
	.min(6)
	.max(32)
	.regex(/^[+\d][\d\s().-]{5,}$/, "Enter a valid phone number")
	// The admin calls this number by hand — separators alone must not pass.
	.refine(
		(value) => (value.match(/\d/g)?.length ?? 0) >= 6,
		"Enter a valid phone number",
	);

/**
 * Body of POST billingRoutes.manualRequest: an offline request for a top-up of `amountUsd` whole USD.
 * A plan body from a pricing v7 web bundle has no `amountUsd`, so it fails with a 400.
 */
export const createManualSubscriptionRequestBodySchema = z.object({
	amountUsd: topupAmountUsdSchema,
	fullName: z.string().trim().min(2).max(120),
	phone: phoneSchema,
	company: z.string().trim().min(1).max(120).optional(),
	country: manualBillingCountrySchema,
	city: z.string().trim().min(1).max(120).optional(),
	preferredPaymentMethod: preferredPaymentMethodSchema.optional(),
	notes: z.string().trim().min(1).max(1000).optional(),
});

export type CreateManualSubscriptionRequestBody = z.infer<
	typeof createManualSubscriptionRequestBodySchema
>;

/**
 * One offline request, as the web and the admin app read it.
 * A pricing v8 request has `amountUsd` and null plan fields. An older request has the plan fields and a null `amountUsd`.
 */
export const manualSubscriptionRequestSchema = z.object({
	id: uuidSchema,
	status: manualSubscriptionRequestStatusSchema,
	organizationId: z.string().nullable(),
	// Whole USD the customer asks to top up. From `amount_usd_cents / 100`.
	amountUsd: z.number().positive().nullable(),
	plan: billingPlanIdSchema.nullable(),
	// Plain positive int (not creditTierSchema) so a request filed against a
	// retired tier still renders.
	tierCredits: z.int().positive().nullable(),
	interval: billingIntervalSchema.nullable(),
	fullName: z.string(),
	phone: z.string(),
	company: z.string().nullable(),
	country: z.string(),
	city: z.string().nullable(),
	preferredPaymentMethod: manualPaymentMethodSchema.nullable(),
	notes: z.string().nullable(),
	subscriptionId: uuidSchema.nullable(),
	handledAt: isoDateTimeSchema.nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export type ManualSubscriptionRequest = z.infer<
	typeof manualSubscriptionRequestSchema
>;

/** The caller's most recent OPEN request for the active workspace, if any. */
export const manualSubscriptionRequestViewResponseSchema = z.object({
	request: manualSubscriptionRequestSchema.nullable(),
});

export type ManualSubscriptionRequestViewResponse = z.infer<
	typeof manualSubscriptionRequestViewResponseSchema
>;

// ---------------------------------------------------------------------------
// SlickPay: Algerian CIB / Edahabia cards (SATIM) on a SlickPay hosted page.
//
// Pricing v8: one payment in DZD buys one wallet top-up of an amount in USD.
// A paid invoice grants top-up credits and writes one receipt in `billing_topup_receipts`.
// A row from before v8 has a plan and no `credits`. The API still fulfils it.
// ---------------------------------------------------------------------------

/**
 * Converts a USD amount (a top-up amount, or a plan price from priceUsdFor) to whole DZD.
 * dzdPerUsdRate is decimal DZD per 1 USD (270 = 270.00), not the stored centi-DZD value.
 * The API invoice, the web prices, and the admin receipts all call it, so their amounts agree.
 */
export function dzdPriceFor(priceUsd: number, dzdPerUsdRate: number): number {
	return Math.round(priceUsd * dzdPerUsdRate);
}

/** Answer of GET billingRoutes.localPricing. It depends on the visitor IP country, so it is never cached. */
export const billingLocalPricingResponseSchema = z.object({
	// null outside Algeria, or when the API has no SlickPay key. Then the web shows USD and Stripe.
	slickpay: z
		.object({
			// Decimal DZD per 1 USD (270 = 270.00). Pass it to dzdPriceFor.
			dzdPerUsdRate: dzdPerUsdRateSchema,
		})
		.nullable(),
});

export type BillingLocalPricingResponse = z.infer<
	typeof billingLocalPricingResponseSchema
>;

/**
 * Body of POST billingRoutes.slickpayCheckout: a top-up of `amountUsd` whole USD, charged in DZD.
 * fullName, phone, and city go on the SlickPay invoice. A pricing v7 plan body fails with a 400.
 */
export const startSlickpayCheckoutBodySchema = z.object({
	amountUsd: topupAmountUsdSchema,
	fullName: z.string().trim().min(2).max(120),
	phone: phoneSchema,
	// City or wilaya in Algeria.
	city: z.string().trim().min(1).max(120),
});

export type StartSlickpayCheckoutBody = z.infer<
	typeof startSlickpayCheckoutBodySchema
>;

/** Answer of POST billingRoutes.slickpayCheckout. The web sends the buyer to `url`, the SlickPay page. */
export const startSlickpayCheckoutResponseSchema = z.object({
	// Id of the row in `slickpay_payments`. The return page confirms it.
	paymentId: uuidSchema,
	url: z.url(),
});

export type StartSlickpayCheckoutResponse = z.infer<
	typeof startSlickpayCheckoutResponseSchema
>;

// created: the row exists, the SlickPay invoice does not exist yet.
// pending: SlickPay created the invoice. The buyer has the payment URL.
// paid: SlickPay says paid. The credits are not granted yet.
// fulfilled: the credits are granted (before v8: the subscription is granted or renewed). Terminal.
// failed: the invoice creation failed, so the buyer never got a URL. Terminal.
// expired: still unpaid 24 h after creation. The sweep skips it. Confirm still asks SlickPay and can move it to paid.
/** Equals the pgEnum slickpay_payment_status in packages/db. */
export const slickpayPaymentStatuses = [
	"created",
	"pending",
	"paid",
	"fulfilled",
	"failed",
	"expired",
] as const;

export const slickpayPaymentStatusSchema = z.enum(slickpayPaymentStatuses);

export type SlickpayPaymentStatus = z.infer<typeof slickpayPaymentStatusSchema>;

/**
 * Answer of POST billingRoutes.slickpayConfirm(id). The return page polls it while the status is created, pending, or paid.
 * A pricing v8 row has amountUsd and credits, and null plan fields. A row from before v8 has the plan fields.
 */
export const slickpayPaymentViewSchema = z.object({
	id: uuidSchema,
	status: slickpayPaymentStatusSchema,
	// Whole USD of the top-up. From `amount_usd_cents / 100`. Null for a row from before v8.
	amountUsd: z.number().positive().nullable(),
	// Decimal display credits that the payment grants. Null for a row from before v8.
	credits: z.number().positive().nullable(),
	plan: billingPlanIdSchema.nullable(),
	// Plain positive int (not creditTierSchema), so a payment on a retired tier still renders.
	tierCredits: z.int().positive().nullable(),
	interval: billingIntervalSchema.nullable(),
	// Whole DZD that SlickPay charges.
	amountDzd: z.int().positive(),
	// The granted or renewed subscription of a row from before v8. Always null for a v8 top-up.
	subscriptionId: uuidSchema.nullable(),
});

export type SlickpayPaymentView = z.infer<typeof slickpayPaymentViewSchema>;

/**
 * Answer of SlickPay POST merchants/invoices (untrusted input). SlickPay sends { success: 1, message, id: 1, url }.
 * The id becomes a string, the type of `slickpay_payments.invoice_id`.
 */
export const slickpayCreateInvoiceResponseSchema = z.object({
	success: z.literal([1, true]),
	id: z
		.union([z.int().positive(), z.string().min(1)])
		.transform((id) => String(id)),
	// SlickPay hosted payment page (SATIM). The web redirects the buyer here, so only https passes.
	url: z.url({ protocol: /^https$/ }),
});

export type SlickpayCreateInvoiceResponse = z.infer<
	typeof slickpayCreateInvoiceResponseSchema
>;

/**
 * Answer of SlickPay GET merchants/invoices/{id} (untrusted input). Only the fields the API reads.
 * success must be 1 or true: a failed answer must never count as "not paid", because that expires the row.
 */
export const slickpayInvoiceDetailsResponseSchema = z.object({
	success: z.literal([1, true]),
	// SlickPay does not document the type. 1, "1", or true means paid.
	completed: z
		.union([z.number(), z.boolean(), z.string().regex(/^\d+$/)])
		.nullish(),
	data: z
		.object({
			// "paid" or "unpaid" in any letter case.
			payment_status: z.string().nullish(),
		})
		.nullish(),
});

export type SlickpayInvoiceDetailsResponse = z.infer<
	typeof slickpayInvoiceDetailsResponseSchema
>;

/**
 * Error answer of the SlickPay API (untrusted input), for example a 422 on a bad phone number.
 * Only `message` goes into slickpay_payments.last_error, never the field values.
 */
export const slickpayErrorBodySchema = z.object({
	message: z.string().max(500),
});

/**
 * True when SlickPay reports the invoice as paid. The official SlickPay WordPress plugin uses the same rule.
 * The API grants credits only after this returns true.
 */
export function isSlickpayInvoicePaid(
	details: SlickpayInvoiceDetailsResponse,
): boolean {
	if (
		details.completed === 1 ||
		details.completed === "1" ||
		details.completed === true
	) {
		return true;
	}
	return details.data?.payment_status?.toLowerCase() === "paid";
}

/** API paths of the billing module. Functions build paths that have an id. */
export const billingRoutes = {
	// Old v7 reads. Cached web bundles call them for one release. The v8 web does not.
	plans: "/api/v1/billing/plans",
	subscription: "/api/v1/billing/subscription",
	wallet: "/api/v1/billing/wallet",
	topup: "/api/v1/billing/topup",
	// Query `sessionId`. The return page polls it after a Stripe top-up.
	topupStatus: "/api/v1/billing/topup/status",
	payments: "/api/v1/billing/payments",
	portal: "/api/v1/billing/portal",
	manualRequest: "/api/v1/billing/manual-request",
	manualRequestCancel: "/api/v1/billing/manual-request/cancel",
	// Public. Tells the web if the visitor sees DZD prices and the SlickPay tab.
	localPricing: "/api/v1/billing/local-pricing",
	slickpayCheckout: "/api/v1/billing/slickpay/checkout",
	// paymentId is the id of the row in `slickpay_payments`.
	slickpayConfirm: (paymentId: string) =>
		`/api/v1/billing/slickpay/payments/${paymentId}/confirm`,
	webhook: "/api/webhooks/stripe",
} as const;
