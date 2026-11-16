// Shapes of the chart data (daily points, breakdown slices, desk figures) and the pure functions that build them.
// The query files build the series from rows with these functions. The home panels take the types.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import { DAY_MS, startOfLocalDay } from "./relative-time";

/** The period choices of a trend panel, in days. The sample rows cover two periods of the longest one. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** One day of a trend, oldest first in a list. Zero on a day with no event. */
export type DailyPoint = {
	/** YYYY-MM-DD in the browser time zone. */
	day: string;
	/** The total of that day. */
	current: number;
	/** The total of the same day one period earlier. */
	previous: number;
};

/** One part of a breakdown. `label` is a code; the page translates it before a panel gets it. */
export type BreakdownSlice<Label extends string = string> = {
	label: Label;
	value: number;
};

/** One event of a daily series: its time (ISO) and the amount that it adds to its day. */
export type SeriesEvent = { occurredAt: string; value: number };

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

// The local calendar day `daysAgo` days before the day of `now`, as YYYY-MM-DD.
function dayKey(now: number, daysAgo: number): string {
	const date = new Date(startOfLocalDay(now));
	// setDate keeps the calendar day across a clock change. A subtraction of 24 hours does not.
	date.setDate(date.getDate() - daysAgo);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The date of a `day` key (YYYY-MM-DD) of a DailyPoint, for a cell title or a fact.
 * It is midnight UTC: format it with `timeZone: "UTC"` to keep the same calendar day.
 */
export function dayToDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

/**
 * Whole calendar days from the day of `timestamp` (ISO) to today: 0 for today, 1 for yesterday.
 * A period of N days holds the ages 0 to N - 1. The previous period holds N to 2N - 1.
 */
export function dayAge(timestamp: string, now: number): number {
	return Math.round(
		(startOfLocalDay(now) - startOfLocalDay(Date.parse(timestamp))) / DAY_MS,
	);
}

/**
 * Sums `events` per local day for the last `days` days, today included, and for the `days` days before.
 * A SQL read function does the same math later (generate_series and a left join).
 */
export function buildDailySeries(
	events: SeriesEvent[],
	days: number,
	now: number,
): DailyPoint[] {
	const points: DailyPoint[] = Array.from({ length: days }, (_, index) => ({
		day: dayKey(now, days - 1 - index),
		current: 0,
		previous: 0,
	}));
	for (const event of events) {
		const daysAgo = dayAge(event.occurredAt, now);
		// An event of the previous period lands on the point of the same day one period later.
		const point = points[days - 1 - (daysAgo % days)];
		if (daysAgo < 0 || daysAgo >= 2 * days || !point) {
			continue;
		}
		if (daysAgo < days) {
			point.current += event.value;
		} else {
			point.previous += event.value;
		}
	}
	return points;
}

/** The middle value of `values`, or null for an empty list. The desk figures use it for reply times. */
export function median(values: number[]): number | null {
	if (values.length === 0) {
		return null;
	}
	const sorted = [...values].sort((first, second) => first - second);
	const middle = Math.floor(sorted.length / 2);
	const upper = sorted[middle] ?? 0;
	return sorted.length % 2 === 1
		? upper
		: ((sorted[middle - 1] ?? 0) + upper) / 2;
}
