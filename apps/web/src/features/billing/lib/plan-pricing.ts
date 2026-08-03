import type {
	BillingInterval,
	BillingTierPrice,
	CreditTier,
	Subscription,
} from "@wandit/contracts";

const RETAIL_USD_PER_CREDIT = 0.25;

export function tierSavingsPercent(
	tier: Pick<BillingTierPrice, "monthlyUsd" | "tierCredits">,
): number {
	const retailMonthlyUsd = tier.tierCredits * RETAIL_USD_PER_CREDIT;

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
