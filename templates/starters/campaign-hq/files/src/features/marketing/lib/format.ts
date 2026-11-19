// Small text helpers of the marketing pages: money, multiples, days, dates, day keys, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** ISO 4217 code of every amount in the sample tables. A later database gives the currency of the team. */
export const CURRENCY = "USD";

/**
 * A money format. "whole" drops the cents for large figures, "compact" gives $1.2K for an axis or a tight cell.
 * "cents" keeps two decimals for a cost per conversion.
 */
export function moneyFormat(
	locale: string,
	precision: "cents" | "whole" | "compact" = "whole",
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		...(precision === "compact"
			? { notation: "compact", maximumSignificantDigits: 3 }
			: precision === "whole"
				? { maximumFractionDigits: 0 }
				: {}),
	});
}

/** A return on ad spend as a multiple: 3.24 gives "3.2×". null gives "–". */
export function formatMultiple(value: number | null, locale: string): string {
	if (value === null) {
		return "–";
	}
	const number = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	return `${number.format(value)}×`;
}

/** A count of days in words: "30 days", "1 day". The period control and the pacing panel use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
		maximumFractionDigits: 0,
	});
}

/** The day and the time of an event in one short text: "Nov 12, 9:14 PM". Timelines and the calendar use it. */
export function dateTimeFormat(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/** A flight as one short range: "Oct 2 – Nov 30". formatRange drops the repeated month or year. */
export function formatFlight(
	startAt: string,
	endAt: string,
	locale: string,
): string {
	return new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	}).formatRange(new Date(startAt), new Date(endAt));
}

/** The local day of `ms` as YYYY-MM-DD. The chart rows and the calendar cells use it as a key. */
export function dayKeyOf(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The Date of a YYYY-MM-DD key at midnight UTC.
 * Format it with `timeZone: "UTC"`, so every time zone shows the same calendar day.
 */
export function dayToDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
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

/** Up to two initials of a name, for an avatar or a tile: "Kestrel Running" gives "KR", "Ines" gives "I". */
export function initialsOf(name: string): string {
	return (
		name
			.split(/\s+/)
			.filter((word) => word !== "")
			.slice(0, 2)
			// Array.from splits by code point, so an accented or astral first letter stays whole.
			.map((word) => Array.from(word)[0] ?? "")
			.join("")
			.toLocaleUpperCase()
	);
}
