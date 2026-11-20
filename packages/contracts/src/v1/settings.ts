/**
 * Contract of the product settings: the admin switches and amounts in the one `product_settings` row.
 * The server settings module, the admin settings page, and the web public settings query read it.
 */
import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

export const dzdPerUsdRateSchema = z
	.number()
	.positive()
	.max(10_000)
	.multipleOf(0.01);

// Whole credits at the admin API, 1 to 10000. Zero is not a legal amount: the
// credit grant rejects it. The server stores the value x100 as centi-credits.
const userReferralSettingCreditsSchema = z.int().min(1).max(10_000);

/**
 * The settings as the ADMIN API sends them: whole credits and decimal DZD.
 * Inside the server, the same type holds centi-credits and hundredths of a DZD.
 */
export const productSettingsSchema = z.object({
	id: z.literal(1),
	signupGrantEnabled: z.boolean(),
	// WHOLE credits at the admin API; the server stores the setting x100 as
	// centi-credits and converts at the settings presentation boundary.
	signupGrantCredits: z.int().positive(),
	paidSubscriptionsEnabled: z.boolean(),
	topupsEnabled: z.boolean(),
	organizationsEnabled: z.boolean(),
	emailAuthEnabled: z.boolean(),
	// Admin-only: captures continue while disabled, but lifecycle email outbox
	// rows are dropped instead of dispatched.
	lifecycleEmailsEnabled: z.boolean(),
	// Offline payments (cash on delivery / wire / CCP): shows the manual
	// request tab in the plan picker and opens the manual-request endpoint.
	manualPaymentsEnabled: z.boolean(),
	// Collection window in days after currentPeriodEnd for manual subscriptions;
	// 0 = strict.
	manualGraceDays: z.int().min(0).max(30),
	// Admin-only DZD charged per 1 USD of catalog price for offline receipts.
	dzdPerUsdRate: dzdPerUsdRateSchema,
	// Opens the V2 app builder to users who also carry the PostHog flag
	// `v2-builder`.
	v2BuilderEnabled: z.boolean(),
	// User referral program switch. Off: no claim, no summary, and no reward.
	userReferralsEnabled: z.boolean(),
	// Whole credits. The bonus of the invited friend at claim time.
	userReferralFriendCredits: userReferralSettingCreditsSchema,
	// Whole credits. The reward of the referrer when the friend builds.
	userReferralActivationCredits: userReferralSettingCreditsSchema,
	// Whole credits. The reward of the referrer when the friend pays.
	userReferralPaidCredits: userReferralSettingCreditsSchema,
	version: z.int().positive(),
	updatedByUserId: z.string().nullable(),
	updatedAt: isoDateTimeSchema,
});

export type ProductSettings = z.infer<typeof productSettingsSchema>;

/** The settings that the web reads before sign-in. The route is public: put no secret here. */
export const publicSettingsSchema = productSettingsSchema
	.pick({
		// Always false since pricing v8 (no plans). Kept because cached web and
		// native bundles parse it.
		paidSubscriptionsEnabled: true,
		topupsEnabled: true,
		signupGrantEnabled: true,
		signupGrantCredits: true,
		// Public: the web shows/hides workspace creation and the Business plan.
		organizationsEnabled: true,
		// Public: the web shows/hides the email sign-in form in the auth modal.
		emailAuthEnabled: true,
		// Public: the web shows/hides the "cash / transfer" tab in the plan picker.
		manualPaymentsEnabled: true,
		// No reader since pricing v8. Kept because cached web bundles parse it.
		manualGraceDays: true,
		// Public: the web resolves the V2 builder switch together with the
		// PostHog flag `v2-builder`.
		v2BuilderEnabled: true,
		// Public: the web shows the referral card, the page, and the claim only when this is on.
		userReferralsEnabled: true,
		// Public: the web shows the three amounts in the referral texts.
		userReferralFriendCredits: true,
		userReferralActivationCredits: true,
		userReferralPaidCredits: true,
	})
	.extend({
		// The public value mirrors storage after exact centi-credit conversion, so
		// legacy or manually edited rows may expose a fractional or zero grant.
		signupGrantCredits: z.number().nonnegative(),
		// Decimal credits, for the same reason: a row edited by hand can hold a fraction.
		userReferralFriendCredits: z.number().nonnegative(),
		userReferralActivationCredits: z.number().nonnegative(),
		userReferralPaidCredits: z.number().nonnegative(),
	});

export type PublicSettings = z.infer<typeof publicSettingsSchema>;

/**
 * Body of the admin PATCH. `version` is the optimistic lock: a stale value gets a 409.
 * A new field must also be in the `.refine` list, or a body with only that field gets a 400.
 * Pricing v8 removes paidSubscriptionsEnabled and manualGraceDays. Their columns stay.
 * An old admin bundle that sends them gets the keys stripped, so such a patch fails the refine.
 */
export const patchProductSettingsBodySchema = z
	.object({
		signupGrantEnabled: z.boolean().optional(),
		signupGrantCredits: z.int().positive().optional(),
		topupsEnabled: z.boolean().optional(),
		organizationsEnabled: z.boolean().optional(),
		emailAuthEnabled: z.boolean().optional(),
		lifecycleEmailsEnabled: z.boolean().optional(),
		manualPaymentsEnabled: z.boolean().optional(),
		dzdPerUsdRate: dzdPerUsdRateSchema.optional(),
		v2BuilderEnabled: z.boolean().optional(),
		userReferralsEnabled: z.boolean().optional(),
		userReferralFriendCredits: userReferralSettingCreditsSchema.optional(),
		userReferralActivationCredits: userReferralSettingCreditsSchema.optional(),
		userReferralPaidCredits: userReferralSettingCreditsSchema.optional(),
		version: z.int().positive(),
	})
	.refine(
		(settings) =>
			settings.signupGrantEnabled !== undefined ||
			settings.signupGrantCredits !== undefined ||
			settings.topupsEnabled !== undefined ||
			settings.organizationsEnabled !== undefined ||
			settings.emailAuthEnabled !== undefined ||
			settings.lifecycleEmailsEnabled !== undefined ||
			settings.manualPaymentsEnabled !== undefined ||
			settings.dzdPerUsdRate !== undefined ||
			settings.v2BuilderEnabled !== undefined ||
			settings.userReferralsEnabled !== undefined ||
			settings.userReferralFriendCredits !== undefined ||
			settings.userReferralActivationCredits !== undefined ||
			settings.userReferralPaidCredits !== undefined,
		{ message: "At least one setting must be provided" },
	);

export type PatchProductSettingsBody = z.infer<
	typeof patchProductSettingsBodySchema
>;

// PATCH response: when the signup grant flips off->on the server reports how
// many users signed up while it was off (`skipped` outbox rows) so the admin
// can decide on the explicit backfill. Enabling alone never grants to them.
export const productSettingsUpdateResponseSchema = productSettingsSchema.extend(
	{
		signupGrantSkippedCount: z.int().nonnegative().optional(),
	},
);

export type ProductSettingsUpdateResponse = z.infer<
	typeof productSettingsUpdateResponseSchema
>;

export const backfillSignupGrantsBodySchema = z.object({
	// Only users whose outbox row was created after this instant.
	createdAfter: isoDateTimeSchema.optional(),
	// true: count only, change nothing.
	dryRun: z.boolean().default(false),
});

export type BackfillSignupGrantsBody = z.infer<
	typeof backfillSignupGrantsBodySchema
>;

export const backfillSignupGrantsResponseSchema = z.object({
	// Skipped rows matched before the run (the dry-run count).
	skipped: z.int().nonnegative(),
	// Rows moved to pending by this call (0 on a dry run).
	requeued: z.int().nonnegative(),
});

export type BackfillSignupGrantsResponse = z.infer<
	typeof backfillSignupGrantsResponseSchema
>;

export const settingsRoutes = {
	admin: "/api/v1/admin/settings",
	public: "/api/v1/settings/public",
	signupGrantBackfill: "/api/v1/admin/settings/signup-grants/backfill",
} as const;
