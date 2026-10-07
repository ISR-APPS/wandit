/**
 * Purchase kill-switch view for the upgrade button, the out-of-credits banner, and the credits dialogs.
 * It reads the public settings and the SlickPay local pricing of the visitor.
 */
import { useLocalPricingQuery } from "@/features/billing/api/billing.queries";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";

/**
 * Whether any credit purchase (subscription or top-up) is currently possible.
 * `undefined` while public settings load — callers treat only an explicit
 * `false` as "hide purchase CTAs" so a slow settings fetch never strips them.
 * The server guards every checkout regardless; this is UI honesty only.
 */
export function usePurchasesEnabled(): boolean | undefined {
	const settingsQuery = usePublicSettingsQuery();
	const localPricingQuery = useLocalPricingQuery();

	if (!settingsQuery.data) return undefined;

	if (
		settingsQuery.data.paidSubscriptionsEnabled ||
		settingsQuery.data.manualPaymentsEnabled ||
		settingsQuery.data.topupsEnabled
	) {
		return true;
	}

	// SlickPay does not depend on the switches above: it is on when the API has a key and the visitor is in Algeria.
	if (!localPricingQuery.data) {
		return localPricingQuery.isError ? false : undefined;
	}

	return localPricingQuery.data.slickpay !== null;
}
