// The number and text formats of the board: money, percent, initials, axis tops, plural forms, and messages with values.
// Every page formats amounts through these functions, so the currency is set in one place.
// The format functions take the locale of useT().

/** The currency of every amount of the app. Set the currency of the business here. */
export const CURRENCY = "USD";

/** Whole amounts in CURRENCY, for example "$12,480". `compact` gives "$12K" for axes and tight cells. */
export function moneyFormat(
	locale: string,
	options: { compact?: boolean } = {},
): Intl.NumberFormat {
	// Compact amounts keep 3 digits, so "$617K" and "$1.15M" have the same precision side by side.
	return new Intl.NumberFormat(
		locale,
		options.compact
			? {
					style: "currency",
					currency: CURRENCY,
					notation: "compact",
					maximumSignificantDigits: 3,
				}
			: { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 },
	);
}

/** Intl options of a whole amount in CURRENCY. Chart tooltips take options, not a formatter. */
export const MONEY_OPTIONS: Intl.NumberFormatOptions = {
	style: "currency",
	currency: CURRENCY,
	maximumFractionDigits: 0,
};

/** A ratio as a whole percent, for example 0.873 as "87%". */
export function percentFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
}

/** The first letters of the first and the last name, for example "AO" for "Amara Okafor". */
export function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/);
	const first = parts[0]?.[0] ?? "";
	const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

// Each step splits into 4 round ticks: 120 gives 30, 60, 90; 160 gives 40, 80, 120.
const NICE_STEPS = [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8, 10];

/** The smallest round number at or above `value`, for the top of a chart axis with 5 ticks. 0 or less gives 1. */
export function niceCeiling(value: number): number {
	if (value <= 0) {
		return 1;
	}
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const step = NICE_STEPS.find((candidate) => candidate * magnitude >= value);
	return (step ?? 10) * magnitude;
}

/**
 * The plural form of `count`: "one" or "other". A counted message has these two keys, for example `reps.accountOrders.one`.
 * English has only these two forms. A language with more forms adds keys here and in its messages.
 */
export function pluralOf(locale: string, count: number): "one" | "other" {
	return new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
}

/** Puts values into a message: "Day {day} of {total}" with { day: "45", total: "92" } gives "Day 45 of 92". */
export function fillMessage(
	message: string,
	values: Record<string, string>,
): string {
	return message.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in values ? (values[name] ?? match) : match,
	);
}
