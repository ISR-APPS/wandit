import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";

/**
 * Whether any credit purchase (subscription or top-up) is currently possible.
 * `undefined` while public settings load — callers treat only an explicit
 * `false` as "hide purchase CTAs" so a slow settings fetch never strips them.
 * The server guards every checkout regardless; this is UI honesty only.
 */
export function usePurchasesEnabled(): boolean | undefined {
	const settingsQuery = usePublicSettingsQuery();

	if (!settingsQuery.data) return undefined;

	return (
		settingsQuery.data.paidSubscriptionsEnabled ||
		settingsQuery.data.topupsEnabled
	);
}
