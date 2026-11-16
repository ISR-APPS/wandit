// Number formats of the stockroom: quantities with their unit word, and money in the stock currency.
// Every page that shows a quantity or a price uses these, so the units and the currency read the same everywhere.
// The unit words are message keys with a "one" and an "other" form, picked by Intl.PluralRules.
import type { TranslationKey } from "~/shared/i18n";
import type { StockUnit } from "./catalog";
import { STOCK_CURRENCY } from "./sample-data";

/** The `t` function of useT(). */
type Translate = (key: TranslationKey) => string;

/** The plural form of a count, for a message key with a "one" and an "other" form. */
export function pluralForm(value: number, locale: string): "one" | "other" {
	// English has only "one" and "other". A language with more plural forms uses "other" for the rest.
	return new Intl.PluralRules(locale).select(Math.abs(value)) === "one"
		? "one"
		: "other";
}

/** The unit word for `value` units, for example "roll" for 1 and "rolls" for 12. */
export function unitWord(
	value: number,
	unit: StockUnit,
	t: Translate,
	locale: string,
): string {
	return t(`units.${unit}.${pluralForm(value, locale)}`);
}

/** A quantity with its unit word, for example "1,240 rolls". */
export function formatQuantity(
	value: number,
	unit: StockUnit,
	t: Translate,
	locale: string,
): string {
	return `${new Intl.NumberFormat(locale).format(value)} ${unitWord(value, unit, t, locale)}`;
}

/** A money format in STOCK_CURRENCY. `wholeUnits` drops the cents, for totals and figures. */
export function moneyFormat(
	locale: string,
	wholeUnits = false,
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: STOCK_CURRENCY,
		...(wholeUnits ? { maximumFractionDigits: 0 } : {}),
	});
}
