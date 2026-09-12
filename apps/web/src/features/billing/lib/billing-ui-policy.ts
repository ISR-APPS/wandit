/**
 * Resolves billing controls for the billing page and plan picker.
 * Uses subscription and catalog data from the shared contracts.
 */
import {
	type BillingInterval,
	type BillingPlanCatalogItem,
	type BillingPlanId,
	type CreditTier,
	isManualSubscription,
	type Subscription,
} from "@wandit/contracts";

import { tierPriceUsd } from "./plan-pricing";

const MILLISECONDS_PER_DAY = 86_400_000;

export type PlanPickerPaymentMethod = "card" | "offline";

/**
 * The cancel dialog shows `priceUsd` and passes the selection to the plan picker.
 * `priceUsd` is the Starter price for `interval`: 9 per month or 90 per year.
 */
export type StarterCancelOffer = {
	interval: BillingInterval;
	plan: "starter";
	priceUsd: number;
	tierCredits: CreditTier;
};

/**
 * Returns the cancel offer only for eligible card subscribers on personal workspaces.
 * Preserves the current interval, so yearly subscribers receive yearly Starter.
 */
export function getStarterCancelOffer(input: {
	subscription: Subscription | null | undefined;
	starterPlan: BillingPlanCatalogItem | undefined;
	isPersonal: boolean;
	paidSubscriptionsEnabled: boolean;
}): StarterCancelOffer | null {
	const { subscription, starterPlan, isPersonal, paidSubscriptionsEnabled } =
		input;
	const tier = starterPlan?.tiers[0];

	// Only entitled personal card subscribers can accept this renewal offer.
	if (
		!subscription?.entitled ||
		isManualSubscription(subscription) ||
		subscription.plan === "starter" ||
		getPendingSubscriptionChange(subscription)?.plan === "starter" ||
		subscription.cancelAtPeriodEnd ||
		!isPersonal ||
		!paidSubscriptionsEnabled ||
		!tier
	) {
		return null;
	}

	// LIMIT: The offer uses the first Starter tier. Upgrade: define a retention tier if Starter gains more tiers.
	return {
		interval: subscription.interval,
		plan: "starter",
		priceUsd: tierPriceUsd(tier, subscription.interval),
		tierCredits: tier.tierCredits,
	};
}

/**
 * Shows Starter to card subscribers who hold it, have it scheduled, or open the cancel offer.
 * A workspace without a subscription never sees Starter.
 */
export function isStarterPlanVisible(
	subscription: Subscription | null | undefined,
	initialPlan: BillingPlanId | undefined,
): boolean {
	return (
		!!subscription &&
		!isManualSubscription(subscription) &&
		(subscription.plan === "starter" ||
			getPendingSubscriptionChange(subscription)?.plan === "starter" ||
			initialPlan === "starter")
	);
}

export function getPendingSubscriptionChange(
	subscription:
		| Pick<
				Subscription,
				| "interval"
				| "pendingInterval"
				| "pendingPlan"
				| "pendingTierCredits"
				| "plan"
		  >
		| null
		| undefined,
): Pick<Subscription, "interval" | "plan" | "tierCredits"> | null {
	if (!subscription?.pendingTierCredits) return null;

	return {
		interval: subscription.pendingInterval ?? subscription.interval,
		plan: subscription.pendingPlan ?? subscription.plan,
		tierCredits: subscription.pendingTierCredits,
	};
}

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
