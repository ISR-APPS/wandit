// Shapes and math of the floor statistics: the checks per day of the heat calendar and the 2 KPI figures.
// floor-stats.queries.ts calls the build functions. The heat panel and the KPI figures take the types.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import {
	businessDay,
	type DailyTotals,
	isCountedOrder,
	type Order,
	orderSubtotalCents,
	type TodayTotals,
	toIsoDay,
} from "~/features/restaurant";
import type { TranslationKey } from "~/shared/i18n";

/** The period choices of the heat panel, in days. 7 days draw a strip, 30 and 90 a calendar. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One day of the heat calendar. `day` is YYYY-MM-DD in the browser time zone. */
export type DailyPoint = {
	day: string;
	/** Checks of the day, voids excluded. */
	current: number;
};

/** One KPI figure. The page turns `labelKey` into its label with t(). */
export type KpiItem = {
	/** Stable id, also the React key. */
	id: string;
	labelKey: TranslationKey;
	/** The value in its unit: a count, or cents when `isMoney` is true. */
	value: number;
	/** True when `value` is in cents. The figure then formats it as money. */
	isMoney: boolean;
	/** Ratio against the same weekday last week: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "up": a rise is good news. Covers and sales are both "up". */
	goodWhen: "up" | "down";
};

/** Change against the previous value, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** Checks, covers, and sales of the business day so far. Voids do not count. */
export function totalsOfToday(orders: Order[]): TodayTotals {
	const counted = orders.filter(isCountedOrder);
	return {
		checks: counted.length,
		covers: counted.reduce((sum, order) => sum + order.covers, 0),
		salesCents: counted.reduce(
			(sum, order) => sum + orderSubtotalCents(order),
			0,
		),
	};
}

/** The last `days` days, oldest first, with the business day of `now` at the end. It counts the real checks of the day. */
export function buildDailyChecks(
	history: DailyTotals[],
	today: TodayTotals,
	now: number,
	days: number,
): DailyPoint[] {
	const past = history
		.slice(-(days - 1))
		.map((entry) => ({ day: entry.day, current: entry.checks }));
	return [
		...past,
		{ day: toIsoDay(new Date(businessDay(now).start)), current: today.checks },
	];
}

/**
 * The same weekday last week, cut at the time of now. A restaurant compares a Saturday with the Saturday before.
 * Each total of last week scales by the part of the planned day that today has reached: `plannedNow` of `plannedDay`.
 * The callers pass today's totals as `plannedNow`. So a lunch compares with a lunch. undefined with under a week of history.
 */
export function sameTimeLastWeek(
	history: DailyTotals[],
	plannedNow: TodayTotals,
	plannedDay: TodayTotals,
): TodayTotals | undefined {
	// history ends with yesterday, so the 7th entry from the end is the same weekday last week.
	const lastWeek = history.at(-7);
	const scale = (value: number, now: number, day: number) =>
		day === 0 ? 0 : Math.round((value * now) / day);
	return lastWeek
		? {
				checks: scale(lastWeek.checks, plannedNow.checks, plannedDay.checks),
				covers: scale(lastWeek.covers, plannedNow.covers, plannedDay.covers),
				salesCents: scale(
					lastWeek.salesCents,
					plannedNow.salesCents,
					plannedDay.salesCents,
				),
			}
		: undefined;
}

/** The 2 figures of the heat panel: covers and sales of today against `lastWeek` (sameTimeLastWeek). */
export function buildFloorKpis(
	today: TodayTotals,
	lastWeek: TodayTotals | undefined,
): KpiItem[] {
	return [
		{
			id: "covers-today",
			labelKey: "floor.coversToday",
			value: today.covers,
			isMoney: false,
			change: lastWeek ? changeRatio(today.covers, lastWeek.covers) : null,
			goodWhen: "up",
		},
		{
			id: "sales-today",
			labelKey: "floor.salesToday",
			value: today.salesCents,
			isMoney: true,
			change: lastWeek
				? changeRatio(today.salesCents, lastWeek.salesCents)
				: null,
			goodWhen: "up",
		},
	];
}
