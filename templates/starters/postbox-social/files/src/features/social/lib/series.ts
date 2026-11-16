// Shapes and math of the period figures: the period choices, daily points, KPI items, and the change formula.
// The query files of every page build their figures with these functions. The charts and KPI cards take the types.
// A period of N days is the N complete days that end yesterday. Its previous period is the N days before it.
import type { ChannelHistory, DayStat } from "./sample-data";

/** The period choices of a trend panel, in days. Each period has a previous period of the same length in the history. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The period of the first load of every page. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** One day of a trend. `day` is YYYY-MM-DD in the browser time zone. `previous` is the same day one period earlier. */
export type DailyPoint = {
	day: string;
	current: number;
	previous: number;
};

/** One KPI figure. The query builds it from the history; the page translates `labelKey`. */
export type KpiItem = {
	/** Stable id, also the React key, for example "impressions". */
	id: string;
	/** Label, already translated. */
	label: string;
	/** One muted line under the value that says what the figure counts. Already translated. */
	hint: string;
	value: number;
	/** Intl options of the value, for example { style: "percent" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for a figure where a fall is good news. */
	goodWhen: "up" | "down";
};

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** A value per day of the history: a number field of DayStat. */
export type DayMetric = (stat: DayStat) => number;

/**
 * The sum of `metric` over `days` days of the given histories. `offset` 0 is the period that ends yesterday,
 * `offset` 1 is the period before it. The history keeps two periods of 90 days, so offset 1 always exists.
 */
export function sumPeriod(
	histories: readonly ChannelHistory[],
	metric: DayMetric,
	days: number,
	offset: 0 | 1,
): number {
	let total = 0;
	for (const history of histories) {
		const end = history.days.length - days * offset;
		for (const stat of history.days.slice(end - days, end)) {
			total += metric(stat);
		}
	}
	return total;
}

/** One point per day of the last `days` days, oldest first, with the same day one period earlier. */
export function dailyPoints(
	histories: readonly ChannelHistory[],
	metric: DayMetric,
	days: number,
): DailyPoint[] {
	const length = histories[0]?.days.length ?? 0;
	const points: DailyPoint[] = [];
	for (let index = length - days; index < length; index += 1) {
		let current = 0;
		let previous = 0;
		for (const history of histories) {
			const stat = history.days[index];
			const earlier = history.days[index - days];
			current += stat ? metric(stat) : 0;
			previous += earlier ? metric(earlier) : 0;
		}
		points.push({
			day: histories[0]?.days[index]?.day ?? "",
			current,
			previous,
		});
	}
	return points;
}
