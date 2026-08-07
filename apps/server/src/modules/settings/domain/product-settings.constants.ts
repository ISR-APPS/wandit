export const PRODUCT_SETTINGS_ID = 1 as const;

export const DEFAULT_PRODUCT_SETTINGS = {
	earlyAccessRequired: true,
	emailAuthEnabled: false,
	id: PRODUCT_SETTINGS_ID,
	organizationsEnabled: false,
	paidSubscriptionsEnabled: false,
	// Pricing v2: $2 of AI value at $0.04/credit. Keep in sync with
	// SIGNUP_GRANT_CREDITS in @wandit/contracts and the DB column default.
	signupGrantCredits: 50,
	signupGrantEnabled: false,
	topupsEnabled: false,
	version: 1,
} as const;

export const PRODUCT_SETTINGS_CACHE_TTL_MS = 30_000;
