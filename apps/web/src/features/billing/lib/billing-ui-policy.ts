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

/** Tabs of the plan picker: Stripe card, SlickPay (CIB / Edahabia), and Cash / transfer. */
export type PlanPickerPaymentMethod = "card" | "offline" | "slickpay";

/** True for each payment tab that the plan picker can show. */
export type PlanPickerPaymentMethods = Record<PlanPickerPaymentMethod, boolean>;

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

/** Decides which payment tabs the plan picker shows. The SlickPay versus Stripe rule lives only here. */
export function getPlanPickerPaymentMethods(input: {
	paidSubscriptionsEnabled: boolean;
	manualPaymentsEnabled: boolean;
	/** True when GET local-pricing returns a rate: the visitor is in Algeria and the API has a SlickPay key. */
	slickpayOffered: boolean;
	subscription: Pick<Subscription, "provider"> | null | undefined;
}): PlanPickerPaymentMethods {
	const manualSubscription = isManualSubscription(input.subscription);
	// SlickPay cannot change a Stripe subscription (the API answers 409), so a Stripe subscriber keeps the Card tab.
	const slickpayAvailable =
		input.slickpayOffered && (!input.subscription || manualSubscription);
	// Product rule: visitors in Algeria pay with SlickPay, not Stripe.
	// To show both tabs to them, remove "&& !slickpayAvailable" from this line.
	const cardAvailable =
		input.paidSubscriptionsEnabled && !manualSubscription && !slickpayAvailable;

	return {
		card: cardAvailable,
		offline: input.manualPaymentsEnabled,
		slickpay: slickpayAvailable,
	};
}

/** Keeps the preferred tab when it is available. Else SlickPay, then Card, then Cash / transfer. */
export function resolvePlanPickerPaymentMethod(
	preferred: PlanPickerPaymentMethod | null | undefined,
	available: PlanPickerPaymentMethods,
): PlanPickerPaymentMethod | null {
	if (preferred && available[preferred]) {
		return preferred;
	}

	// SlickPay comes first: it is the default tab where it shows.
	const defaultOrder = ["slickpay", "card", "offline"] as const;

	return defaultOrder.find((method) => available[method]) ?? null;
}
