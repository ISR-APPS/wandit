/**
 * Pure helpers of the user detail page: initials, labels, old plan prices, and the spend badge.
 * Called by the user detail components. Uses the billing and credits contracts.
 */
import {
	SPEND_BADGES,
	type SpendBadgeId,
	tryPriceUsdFor,
} from "@wandit/contracts";

import type {
	AdminUserSubscription,
	UserRole,
} from "@/features/users/api/users.dto";

export function getInitials(name: string) {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join("") || "?"
	);
}

export function titleCase(value: string) {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export function getRoleLabel(role: UserRole) {
	return titleCase(role);
}

// Catalog price for the subscription's purchased tier, at its billing interval.
// Null only when persisted data contains an invalid plan/tier pairing.
export function subscriptionPriceUsd(
	subscription: Pick<
		AdminUserSubscription,
		"plan" | "tierCredits" | "interval"
	>,
): number | null {
	return tryPriceUsdFor(
		subscription.plan,
		subscription.tierCredits,
		subscription.interval,
	);
}

/**
 * Id of the highest spend badge that `spentCredits` (decimal credits) earns.
 * Null below the first threshold. The badges and thresholds come from the contracts.
 */
export function highestSpendBadgeId(spentCredits: number): SpendBadgeId | null {
	// SPEND_BADGES is in threshold order, so the last reached badge is the highest.
	return (
		SPEND_BADGES.findLast((badge) => spentCredits >= badge.thresholdCredits)
			?.id ?? null
	);
}
