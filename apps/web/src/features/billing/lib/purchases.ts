/**
 * Purchase kill-switch view for the credits chip, the out-of-credits banner, and the credits dialogs.
 * It reads the public settings and the DZD rate of GET local-pricing.
 */
import {
	useDzdPerUsdRate,
	useLocalPricingQuery,
} from "@/features/billing/api/billing.queries";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";

/**
 * Whether any top-up (card, SlickPay, or offline request) is currently possible.
 * `undefined` while public settings load — callers treat only an explicit
 * `false` as "hide purchase CTAs" so a slow settings fetch never strips them.
 * The server guards every checkout regardless; this is UI honesty only.
 */
export function usePurchasesEnabled(): boolean | undefined {
	const settingsQuery = usePublicSettingsQuery();
	const localPricingQuery = useLocalPricingQuery();
	const dzdPerUsdRate = useDzdPerUsdRate();

	if (!settingsQuery.data) return undefined;

	if (
		settingsQuery.data.manualPaymentsEnabled ||
		settingsQuery.data.topupsEnabled
	) {
		return true;
	}

	// SlickPay does not depend on the switches above: it is on when the API has a key, so it sends a DZD rate.
	if (!localPricingQuery.data) {
		return localPricingQuery.isError ? false : undefined;
	}

	return dzdPerUsdRate !== null;
}
