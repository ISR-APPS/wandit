import type { BillingInterval } from "@wandit/contracts";

export function areTopupsAvailable(
	topupsEnabled: boolean | undefined,
	availablePackCount: number | undefined,
): boolean {
	return topupsEnabled === true && (availablePackCount ?? 0) > 0;
}

export function resolvePlanPickerInterval(
	selectedInterval: BillingInterval | null,
	subscriptionInterval: BillingInterval | undefined,
): BillingInterval {
	if (subscriptionInterval === "year") {
		return "year";
	}

	return selectedInterval ?? subscriptionInterval ?? "month";
}
