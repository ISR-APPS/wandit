import {
	type BillingInterval,
	isManualSubscription,
	type Subscription,
} from "@wandit/contracts";

const MILLISECONDS_PER_DAY = 86_400_000;

export type PlanPickerPaymentMethod = "card" | "offline";

export function areTopupsAvailable(
	topupsEnabled: boolean | undefined,
	availablePackCount: number | undefined,
): boolean {
	return topupsEnabled === true && (availablePackCount ?? 0) > 0;
}

export function getManualGraceNoticeDates(
	subscription:
		| Pick<Subscription, "currentPeriodEnd" | "entitled" | "provider">
		| null
		| undefined,
	manualGraceDays: number,
	now: Date = new Date(),
): { accessEndDate: Date; periodEndDate: Date } | null {
	if (!subscription?.entitled || !isManualSubscription(subscription)) {
		return null;
	}

	const periodEndDate = new Date(subscription.currentPeriodEnd);
	if (periodEndDate.getTime() >= now.getTime()) {
		return null;
	}

	return {
		accessEndDate: new Date(
			periodEndDate.getTime() + manualGraceDays * MILLISECONDS_PER_DAY,
		),
		periodEndDate,
	};
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

export function resolvePlanPickerPaymentMethod(
	preferred: PlanPickerPaymentMethod | null | undefined,
	cardAvailable: boolean,
	offlineAvailable: boolean,
): PlanPickerPaymentMethod | null {
	if (preferred === "card" && cardAvailable) {
		return "card";
	}

	if (preferred === "offline" && offlineAvailable) {
		return "offline";
	}

	if (cardAvailable) {
		return "card";
	}

	if (offlineAvailable) {
		return "offline";
	}

	return null;
}
