export const PRODUCT_SETTINGS_ID = 1 as const;

export const DEFAULT_PRODUCT_SETTINGS = {
	earlyAccessRequired: true,
	emailAuthEnabled: false,
	id: PRODUCT_SETTINGS_ID,
	organizationsEnabled: false,
	paidSubscriptionsEnabled: false,
	signupGrantCredits: 20,
	signupGrantEnabled: false,
	topupsEnabled: false,
	version: 1,
} as const;

export const PRODUCT_SETTINGS_CACHE_TTL_MS = 30_000;
