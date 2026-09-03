import { tryPriceUsdFor } from "@wandit/contracts";

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

// "175 credits/mo · $25/mo" (or "· $250/yr" on yearly billing).
export function subscriptionTierLabel(
	subscription: Pick<
		AdminUserSubscription,
		"plan" | "tierCredits" | "interval"
	>,
): string {
	const priceUsd = subscriptionPriceUsd(subscription);
	const credits = `${subscription.tierCredits.toLocaleString("en-US")} credits/mo`;

	if (priceUsd === null) {
		return credits;
	}

	const per = subscription.interval === "year" ? "yr" : "mo";

	return `${credits} · $${priceUsd.toLocaleString("en-US")}/${per}`;
}
