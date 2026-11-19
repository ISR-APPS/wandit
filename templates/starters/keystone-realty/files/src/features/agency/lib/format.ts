// Text helpers that every page of the agency uses: message templates, money, initials, and the address line.
// The page components call them with the `locale` of useT(). They read no data.
import { AGENCY_CURRENCY } from "./sample-listings";

/**
 * Puts values into a message, for example "Built in {year}".
 * A name in braces with no value stays as it is, so a wrong template shows on the page.
 */
export function fillMessage(
	template: string,
	values: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
		name in values ? String(values[name]) : placeholder,
	);
}

/**
 * A count with its noun, for example "1 viewing" or "3 viewings".
 * `one` and `other` are messages with a {count} placeholder. Intl.PluralRules picks one for the language.
 */
export function countLabel(
	count: number,
	one: string,
	other: string,
	locale: string,
): string {
	const isOne = new Intl.PluralRules(locale).select(count) === "one";
	return fillMessage(isOne ? one : other, {
		count: new Intl.NumberFormat(locale).format(count),
	});
}

/** A formatter for prices in the agency currency, with no cents: every sample price is a whole number. */
export function moneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: AGENCY_CURRENCY,
		maximumFractionDigits: 0,
	});
}

/** A formatter for large sums in a short form, for example "$18.4M". */
export function compactMoneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: AGENCY_CURRENCY,
		notation: "compact",
		maximumFractionDigits: 1,
	});
}

/** The first letters of the first and the last word of a name, for an avatar: "Priya Raman" gives "PR". */
export function initialsOf(fullName: string): string {
	const words = fullName.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/** The street line with the unit, for example "66 Marigold Street, Unit 1B". A house has no unit. */
export function addressOf(home: {
	street: string;
	unit: string | null;
}): string {
	return home.unit === null ? home.street : `${home.street}, ${home.unit}`;
}

/** The median of `values`, or null for an empty list. The median hides a few very slow answers. */
export function medianOf(values: number[]): number | null {
	if (values.length === 0) {
		return null;
	}
	const sorted = [...values].sort((first, second) => first - second);
	const middle = Math.floor(sorted.length / 2);
	const upper = sorted[middle] ?? 0;
	return sorted.length % 2 === 1
		? upper
		: ((sorted[middle - 1] ?? upper) + upper) / 2;
}

/**
 * A length of time in the unit that fits: "35 min", "2.5 hr", or "3.2 days".
 * The lead pages use it for the time from the arrival of a lead to its first answer.
 */
export function formatDuration(minutes: number, locale: string): string {
	// Under 1 hour: minutes. Under 2 days: hours. Else days. 1,440 minutes are one day.
	const [value, unit] =
		minutes < 60
			? ([minutes, "minute"] as const)
			: minutes < 2 * 1440
				? ([minutes / 60, "hour"] as const)
				: ([minutes / 1440, "day"] as const);
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit,
		unitDisplay: "short",
		maximumFractionDigits: 1,
	}).format(value);
}

/** Change against an earlier value, as a ratio: 0.12 is +12 %. null when the earlier value is 0, so no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
