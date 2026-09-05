// Leave two minutes for storage and billing settlement before Trigger's
// seven-minute execution limit. The provider deadline includes SDK retries.
export const MARKETING_ASSET_PROVIDER_TIMEOUT_MS = 5 * 60_000;
export const MARKETING_ASSET_RECOVERY_GRACE_MS = 2 * 60_000;
export const MARKETING_ASSET_STALE_GENERATING_MS =
	MARKETING_ASSET_PROVIDER_TIMEOUT_MS + MARKETING_ASSET_RECOVERY_GRACE_MS;
