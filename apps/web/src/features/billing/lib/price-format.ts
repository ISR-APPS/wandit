/**
 * Price text of the top-up dialog, the wallet page, the return pages, and the landing pricing page.
 * Amounts are in USD. The DZD price comes from dzdPriceFor in the contracts and the live rate of GET local-pricing.
 */
import { dzdPriceFor } from "@wandit/contracts";
import type { Locale } from "@wandit/internationalization";

/** Whole dollars print with no cents. Other values print with two decimals. */
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
 * Formats a USD amount as DZD when the rate is known, else as USD. The SlickPay and offline tabs use it for the DZD charge.
 * dzdPerUsdRate is decimal DZD per 1 USD from useDzdPerUsdRate. Null means "no rate", so the text is USD.
 */
export function formatLocalPrice(
	priceUsd: number,
	locale: Locale,
	dzdPerUsdRate: number | null,
): string {
	return dzdPerUsdRate === null
		? formatUsd(priceUsd, locale)
		: formatDzd(dzdPriceFor(priceUsd, dzdPerUsdRate));
}

/**
 * Formats a USD amount with its DZD price after it, for example "$20 · 5 000 DZD". Every visitor sees both.
 * dzdPerUsdRate is decimal DZD per 1 USD from useDzdPerUsdRate. Null gives the USD text only, for example "$20".
 */
export function formatUsdAndDzd(
	priceUsd: number,
	locale: Locale,
	dzdPerUsdRate: number | null,
): string {
	const usd = formatUsd(priceUsd, locale);

	return dzdPerUsdRate === null
		? usd
		: `${usd} · ${formatDzd(dzdPriceFor(priceUsd, dzdPerUsdRate))}`;
}
