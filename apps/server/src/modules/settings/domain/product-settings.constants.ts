export const PRODUCT_SETTINGS_ID = 1 as const;

export const DEFAULT_PRODUCT_SETTINGS = {
	earlyAccessRequired: true,
	emailAuthEnabled: false,
	id: PRODUCT_SETTINGS_ID,
	organizationsEnabled: false,
	paidSubscriptionsEnabled: false,
	// 50 credits ($1.40 of AI value at pricing v3's $0.028/credit). Keep in
	// sync with SIGNUP_GRANT_CREDITS in @wandit/contracts and the DB default.
	signupGrantCredits: 50,
	signupGrantEnabled: false,
	topupsEnabled: false,
	version: 1,
} as const;

export const PRODUCT_SETTINGS_CACHE_TTL_MS = 30_000;
