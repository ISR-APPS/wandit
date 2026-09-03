export const PRODUCT_SETTINGS_ID = 1 as const;

export const DEFAULT_PRODUCT_SETTINGS = {
	// Hundredths of a DZD per 1 USD; the admin API exposes decimal DZD.
	dzdPerUsdRate: 27_000,
	emailAuthEnabled: false,
	id: PRODUCT_SETTINGS_ID,
	lifecycleEmailsEnabled: false,
	manualGraceDays: 0,
	manualPaymentsEnabled: false,
	organizationsEnabled: false,
	paidSubscriptionsEnabled: false,
	// 700 centi-credits = the 7-credit signup grant.
	// The column stores centi-credits; keep in sync with the DB default and
	// SIGNUP_GRANT_CREDITS (whole credits) in @wandit/contracts.
	signupGrantCredits: 700,
	signupGrantEnabled: false,
	topupsEnabled: false,
	version: 1,
} as const;

export const PRODUCT_SETTINGS_CACHE_TTL_MS = 30_000;
