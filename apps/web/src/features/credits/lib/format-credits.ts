import {
	CENTI_CREDITS_PER_CREDIT,
	creditsToCentiCredits,
} from "@wandit/contracts";
import type { Locale } from "@wandit/internationalization";

// Pricing v4: the API sends decimal credits. Balances floor to 1 decimal
// (never round up what the user has); charges stay exact with trailing
// zeros trimmed. Both go through integer centi-credits to avoid float dust.

/** Balance display: floor to 1 decimal, locale-aware (e.g. 28.87 -> "28.8"). */
export function formatCreditBalance(credits: number, locale: Locale): string {
	const flooredTenths = Math.floor(creditsToCentiCredits(credits) / 10);
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(flooredTenths / 10);
}

/** Activity row: signed, always 2 dp ("+50.00", "-0.39"); zero has no sign. */
export function formatCreditDelta(credits: number, locale: Locale): string {
	const centi = creditsToCentiCredits(credits);
	const formatted = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(Math.abs(centi) / CENTI_CREDITS_PER_CREDIT);
	if (centi === 0) return formatted;
	return `${centi < 0 ? "-" : "+"}${formatted}`;
}

/** Charge display: exact 2-dp amount, trailing zeros trimmed (3, 0.87, 0.1). */
export function formatCreditAmount(credits: number, locale: Locale): string {
	const exact = creditsToCentiCredits(credits) / CENTI_CREDITS_PER_CREDIT;
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: 2,
	}).format(exact);
}
