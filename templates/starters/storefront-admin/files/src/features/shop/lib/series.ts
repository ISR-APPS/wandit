// Shapes of the chart data (daily points and breakdown slices) and the pure functions that build them.
// The query files build the series from sample rows with these functions. The chart parts take the types.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import { calendarDaysFromNow } from "./relative-time";

/** The period choices of the home, in days. The sample orders cover two periods of the longest one. */
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

/** One figure of a stat card: the value of the period and its change against the period before. */
export type PeriodFigure = {
	value: number;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null when the period before is 0. */
	change: number | null;
};

/** The home stat cards and the product figure cards build each figure with it. */
export function periodFigureOf(
	current: number,
	previous: number,
): PeriodFigure {
	return { value: current, change: changeRatio(current, previous) };
}

// The local calendar day `daysAgo` days before the day of `dayStart`, as YYYY-MM-DD.
function dayKey(dayStart: number, daysAgo: number): string {
	const date = new Date(dayStart);
	// setDate keeps the calendar day across a clock change. A subtraction of 24 hours does not.
	date.setDate(date.getDate() - daysAgo);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The date of a `day` key (YYYY-MM-DD) of a DailyPoint, for an axis tick or a tooltip.
 * It is midnight UTC: format it with `timeZone: "UTC"` to keep the same calendar day.
 */
export function dayToDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

/**
 * Sums `events` per local day for the last `days` full days (the last one is yesterday), and for the `days` days before.
 * `dayStart` is the midnight that starts today. A SQL read function does the same math later (generate_series and a left join).
 */
export function buildDailySeries(
	events: SeriesEvent[],
	days: number,
	dayStart: number,
): DailyPoint[] {
	const points: DailyPoint[] = Array.from({ length: days }, (_, index) => ({
		day: dayKey(dayStart, days - index),
		current: 0,
		previous: 0,
	}));
	for (const event of events) {
		const daysAgo = -calendarDaysFromNow(event.occurredAt, dayStart);
		if (daysAgo < 1 || daysAgo > 2 * days) {
			continue;
		}
		// An event of the previous period lands on the point of the same day one period later.
		const point = points[days - 1 - ((daysAgo - 1) % days)];
		if (!point) {
			continue;
		}
		if (daysAgo <= days) {
			point.current += event.value;
		} else {
			point.previous += event.value;
		}
	}
	return points;
}

/** The sums of `current` and of `previous` over a series, and their change ratio. */
export function totalsOf(points: DailyPoint[]): {
	current: number;
	previous: number;
	change: number | null;
} {
	const current = points.reduce((sum, point) => sum + point.current, 0);
	const previous = points.reduce((sum, point) => sum + point.previous, 0);
	return { current, previous, change: changeRatio(current, previous) };
}
