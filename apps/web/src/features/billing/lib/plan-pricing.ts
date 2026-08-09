import type {
	BillingInterval,
	BillingTierPrice,
	CreditTier,
	Subscription,
} from "@wandit/contracts";

// Pro base rate: $30 per 200 credits. Business passes its own basePer100Usd
// (2× Pro) so its volume discounts surface instead of comparing against Pro.
const DEFAULT_BASE_PER_100_USD = 10;

export function tierSavingsPercent(
	tier: Pick<BillingTierPrice, "monthlyUsd" | "tierCredits">,
	basePer100Usd: number = DEFAULT_BASE_PER_100_USD,
): number {
	const retailMonthlyUsd = (tier.tierCredits / 100) * basePer100Usd;

	return Math.round((1 - tier.monthlyUsd / retailMonthlyUsd) * 100);
}

export function tierPriceUsd(
	tier: BillingTierPrice,
	interval: BillingInterval,
): number {
	return interval === "year" ? tier.annualUsd : tier.monthlyUsd;
}

export function isRenewalDowngrade(
	subscription: Pick<Subscription, "interval" | "tierCredits">,
	target: { interval: BillingInterval; tierCredits: CreditTier },
): boolean {
	return (
		subscription.interval === target.interval &&
		target.tierCredits < subscription.tierCredits
	);
}
