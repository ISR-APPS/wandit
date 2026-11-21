// Small text helpers of the HR pages: day counts, date ranges, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.
import { dayKeyToMs } from "./time";

/** A count of days in words: "30 days", "1 day". Period labels, leave lengths, and hiring times use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/** "12 – 16 May" for two YYYY-MM-DD days. One day gives one date. Tables and the bell show leave dates with it. */
export function formatDayRange(
	startDate: string,
	endDate: string,
	locale: string,
): string {
	const format = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	return format.formatRange(
		new Date(dayKeyToMs(startDate)),
		new Date(dayKeyToMs(endDate)),
	);
}

/**
 * Puts values into a message: fillMessage("{count} people", { count: "4" }) gives "4 people".
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
