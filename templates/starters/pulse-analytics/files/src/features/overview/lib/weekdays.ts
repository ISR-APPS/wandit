// The weekday names of the event volume card, Monday first, in the language of the app.
// The weekday bars and the CSV export of the card read them.

// 2024-01-01 is a Monday. The 6 days after it give the other names in the order of the card.
const FIRST_MONDAY_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

/** The name of weekday `index` (0 is Monday, 6 is Sunday): "Mon" in "short" style, "Monday" in "long" style. */
export function weekdayName(
	index: number,
	locale: string,
	style: "short" | "long",
): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: style,
		timeZone: "UTC",
	}).format(FIRST_MONDAY_MS + index * DAY_MS);
}
