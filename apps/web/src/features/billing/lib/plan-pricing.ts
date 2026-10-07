/**
 * Price math and price text for the plan cards, the plan picker, and the landing pricing page.
 * The prices come from the billing catalog in USD. Visitors in Algeria see them in DZD.
 */
import type {
	BillingInterval,
	BillingTierPrice,
	Subscription,
} from "@wandit/contracts";
import { dzdPriceFor, priceUsdFor } from "@wandit/contracts";
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

/**
 * Formats whole dinars, for example "6 750 DZD". The admin receipts use the same format.
 * DZD amounts are never localized (docs/localization.md), so the format is always fr-FR.
 */
export function formatDzd(amountDzd: number): string {
	return new Intl.NumberFormat("fr-FR", {
		style: "currency",
		currency: "DZD",
		currencyDisplay: "code",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amountDzd);
}

/**
 * Formats a catalog USD price for the visitor.
 * dzdPerUsdRate is decimal DZD per 1 USD from GET local-pricing. It is null outside Algeria, so those visitors see USD.
 */
export function formatPlanPrice(
	priceUsd: number,
	locale: Locale,
	dzdPerUsdRate: number | null,
): string {
	return dzdPerUsdRate === null
		? formatUsd(priceUsd, locale)
		: formatDzd(dzdPriceFor(priceUsd, dzdPerUsdRate));
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
