// Number and text formats of the stockroom: quantities with their unit word, money, day counts, initials, and messages.
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

/** A count of days in words: "30 days", "1 day". The period select and the lead times use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/**
 * The first letters of the first two words of a name, for an avatar or a tile: "Hex nut M8, zinc" gives "HN".
 * Not the last word: item names end in a count or a unit ("200 pcs"), so many tiles get the same letters.
 */
export function initialsOf(name: string): string {
	// Words of letters or digits only, so "&" or "-" never becomes an initial.
	const words = name.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
	return words
		.slice(0, 2)
		.map((word) => Array.from(word)[0] ?? "")
		.join("")
		.toLocaleUpperCase();
}

/**
 * Puts values into a message: fillMessage("{count} items", { count: "4" }) gives "4 items".
 * The values are already formatted with Intl. A name with no value stays as it is.
 */
export function fillMessage(
	template: string,
	values: Record<string, string>,
): string {
	return template.replace(
		/\{(\w+)\}/g,
		(placeholder, name: string) => values[name] ?? placeholder,
	);
}
