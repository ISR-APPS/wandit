// Small text helpers of the school pages: day counts, class schedules, initials, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** A count of days in words: "30 days", "1 day". Period labels and waiting times use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/** A share with one decimal: "82.4%". The meters and the tables use it. */
export function shareFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
}

/** A calendar date with no time: "Nov 13, 2026". Course dates and enrollment dates use it. */
export function dateFormat(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
}

// 7 January 2024 is a Sunday. Day `weekday` after it has that weekday number (0 is Sunday).
const FIRST_SUNDAY_UTC = Date.UTC(2024, 0, 7);

/**
 * The class days and the class time of a course in words: "Mon & Wed, 6:30 PM".
 * `classDays` holds weekday numbers (0 is Sunday). `classTime` is "HH:MM" in the school time zone.
 */
export function formatSchedule(
	classDays: number[],
	classTime: string,
	locale: string,
): string {
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const time = new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "UTC",
	});
	const days = new Intl.ListFormat(locale, {
		style: "short",
		type: "conjunction",
	}).format(
		classDays.map((day) =>
			// 86,400,000 ms is one day. UTC has no clock change, so the product is exact.
			weekday.format(new Date(FIRST_SUNDAY_UTC + day * 86_400_000)),
		),
	);
	return `${days}, ${time.format(new Date(`2024-01-07T${classTime}:00Z`))}`;
}

/** The first letters of the first and the last word of a name, for an avatar: "Amara Okafor" gives "AO". */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/**
 * Puts values into a message: fillMessage("Week {week} of {weeks}", { week: "4", weeks: "10" }).
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
