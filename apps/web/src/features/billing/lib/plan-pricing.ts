import type {
	BillingInterval,
	BillingTierPrice,
	Subscription,
} from "@wandit/contracts";
import { priceUsdFor } from "@wandit/contracts";
import type { Locale } from "@wandit/internationalization";

// Savings are relative to the selected plan's own base rate. Requiring the
// caller to provide it prevents Starter or Business from inheriting Pro math.
export function tierSavingsPercent(
	tier: Pick<BillingTierPrice, "monthlyUsd" | "tierCredits">,
	basePer100Usd: number,
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

export function formatUsd(value: number, locale: Locale): string {
	const fractionDigits = Number.isInteger(value) ? 0 : 2;

	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(value);
}

export function isRenewalDowngrade(
	subscription: Pick<Subscription, "interval" | "plan" | "tierCredits">,
	target: Pick<Subscription, "interval" | "plan" | "tierCredits">,
): boolean {
	return (
		priceUsdFor(target.plan, target.tierCredits, "month") <
		priceUsdFor(subscription.plan, subscription.tierCredits, "month")
	);
}
