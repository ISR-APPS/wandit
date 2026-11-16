// Shapes of the chart and figure data (daily points, category points, slices, KPI items) and the pure functions that build them.
// The query files build every series from sample rows with these functions. The chart and KPI parts take the types.
// A period is the `days` full days before today: today is not over, so it never counts.
import { shiftDays, toDayKey } from "./time";

/** One day of a trend, oldest first in a list. Zero on a day with no event. */
export type DailyPoint = {
	/** YYYY-MM-DD in the browser time zone. */
	day: string;
	/** The total of that day. */
	current: number;
	/** The total of the same day one period earlier. */
	previous: number;
};

/** One day and one category of a stacked trend. Every day has a row for every category, in category order. */
export type CategoryPoint<Category extends string = string> = {
	day: string;
	category: Category;
	value: number;
};

/** One part of a breakdown. `label` is a code until the page translates it. */
export type BreakdownSlice<Label extends string = string> = {
	label: Label;
	value: number;
};

/** One KPI figure. The query builds it with `labelKey`; the page turns the key into `label` with t(). */
export type KpiItem = {
	/** Stable id, also the React key and the key of the icon map, for example "out-today". */
	id: string;
	/** Label, already translated. */
	label: string;
	value: number;
	/** Intl options of the value, for example { style: "percent" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** Translated scope line, for example "Next 7 days". It replaces the delta when `change` is null. */
	note?: string;
	/** "down" for absences, sick days, and waiting requests: a fall is good news. */
	goodWhen: "up" | "down";
};

/** One event of a series: its day (YYYY-MM-DD) and the amount that it adds to that day. */
export type DayEvent = { day: string; value: number };

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** The day keys of the last `days` full days, oldest first. The last one is yesterday. */
export function periodDayKeys(days: number, dayStart: number): string[] {
	return Array.from({ length: days }, (_, index) =>
		toDayKey(shiftDays(dayStart, index - days)),
	);
}

/**
 * Sums `events` per day for the last `days` full days, and for the `days` days before them.
 * A SQL read function does the same math later (generate_series and a left join).
 */
export function buildDailySeries(
	events: DayEvent[],
	days: number,
	dayStart: number,
): DailyPoint[] {
	const current = periodDayKeys(days, dayStart);
	const previous = periodDayKeys(2 * days, dayStart).slice(0, days);
	const sums = new Map<string, number>();
	for (const event of events) {
		sums.set(event.day, (sums.get(event.day) ?? 0) + event.value);
	}
	return current.map((day, index) => ({
		day,
		current: sums.get(day) ?? 0,
		previous: sums.get(previous[index] ?? "") ?? 0,
	}));
}

/** Sums `events` per day and category for the last `days` full days. Each day lists every category in order. */
export function buildCategorySeries<Category extends string>(
	events: (DayEvent & { category: Category })[],
	categories: readonly Category[],
	days: number,
	dayStart: number,
): CategoryPoint<Category>[] {
	const sums = new Map<string, number>();
	for (const event of events) {
		const key = `${event.day}|${event.category}`;
		sums.set(key, (sums.get(key) ?? 0) + event.value);
	}
	return periodDayKeys(days, dayStart).flatMap((day) =>
		categories.map((category) => ({
			day,
			category,
			value: sums.get(`${day}|${category}`) ?? 0,
		})),
	);
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
