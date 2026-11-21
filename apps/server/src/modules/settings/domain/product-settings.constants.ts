/**
 * Constants of the one `product_settings` row: its id, its first values, and the cache time.
 * ProductSettingsRepository inserts the defaults on an empty database.
 * ProductSettingsService reads the cache time. The file calls nothing.
 */

export const PRODUCT_SETTINGS_ID = 1 as const;

/**
 * First values of the settings row. Each value equals the default of its column
 * in `packages/db/src/schema/billing.ts`. Credit amounts are centi-credits.
 */
export const DEFAULT_PRODUCT_SETTINGS = {
	// Hundredths of a DZD per 1 USD (25000 = 250.00 DZD); the admin API exposes decimal DZD.
	dzdPerUsdRate: 25_000,
	emailAuthEnabled: false,
	id: PRODUCT_SETTINGS_ID,
	lifecycleEmailsEnabled: false,
	manualGraceDays: 0,
	manualPaymentsEnabled: false,
	organizationsEnabled: false,
	paidSubscriptionsEnabled: false,
	// 2000 centi-credits = the 20-credit signup grant.
	// The column stores centi-credits; keep in sync with the DB default and
	// SIGNUP_GRANT_CREDITS (whole credits) in @wandit/contracts.
	signupGrantCredits: 2000,
	signupGrantEnabled: false,
	// The Starter pass gate ships off. Turning it on grants a pass to every pool that already paid.
	starterPassRequired: false,
	topupsEnabled: false,
	// 1000 centi-credits = 10 credits: the reward of the referrer when the friend builds.
	userReferralActivationCredits: 1000,
	// 1000 centi-credits = 10 credits: the bonus of the invited friend.
	userReferralFriendCredits: 1000,
	// 10000 centi-credits = 100 credits: the reward of the referrer when the friend pays.
	userReferralPaidCredits: 10_000,
	// The user referral program ships off. An admin turns it on.
	userReferralsEnabled: false,
	// Matches the v2_builder_enabled column default: the V2 builder is off.
	v2BuilderEnabled: false,
	version: 1,
} as const;

export const PRODUCT_SETTINGS_CACHE_TTL_MS = 30_000;
