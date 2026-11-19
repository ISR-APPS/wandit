// Reads of the home: the bookings per day against the same days one year earlier, and the 4 stat figures.
// The loader of the home route prefetches the default period. OverviewPage reads the chosen period with useQuery.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	attainmentOf,
	bookedByDay,
	changeRatio,
	dayKeyOf,
	getSampleTables,
	type PeriodDays,
	quarterOfDay,
	quarterProgressOf,
	type SampleTables,
	shiftQuarter,
	teamTargetByQuarter,
	todayDayNumber,
} from "~/features/sales";

/** The period of the home when it opens. */
export const DEFAULT_DAYS: PeriodDays = 30;

// 52 weeks back, so each bar compares with the same weekday one year earlier.
const YEAR_SHIFT_DAYS = 364;

/** One closed day of the chart. Amounts are whole units of CURRENCY, cancelled orders left out. */
export type YearPoint = {
	/** YYYY-MM-DD. */
	day: string;
	thisYear: number;
	/** The booked amount of the same weekday 52 weeks earlier. */
	lastYear: number;
};

/** The ids of the 4 stat cards, in the order of the 2 x 2 grid. Labels: `overview.stats.<id>`. */
export type OverviewStatId =
	| "bookings"
	| "averageOrder"
	| "orders"
	| "attainment";

/** One stat card of the home. */
export type OverviewStat = {
	id: OverviewStatId;
	/** An amount in CURRENCY, a count, or a ratio (0.87 is 87 %) for "attainment". */
	value: number;
	/** The change against the earlier period. null when the earlier value is 0. */
	change: number | null;
	/** "points" for the attainment: the difference of two ratios. "ratio" for the others. */
	changeKind: "ratio" | "points";
};

/** Everything that the chart card and the stat cards show for one period. */
export type OverviewSummary = {
	/** The `days` closed days that end yesterday, oldest first. */
	points: YearPoint[];
	stats: OverviewStat[];
};

// The booked amount and the order count of the days from `fromDay` up to `toDay` (excluded).
function totalsBetween(
	tables: SampleTables,
	fromDay: number,
	toDay: number,
): { booked: number; orders: number } {
	let booked = 0;
	let orders = 0;
	for (const order of tables.orders) {
		if (order.day >= fromDay && order.day < toDay && !order.isCancelled) {
			booked += order.amount;
			orders += 1;
		}
	}
	return { booked, orders };
}

// The summary of the `days` closed days that end yesterday.
function buildOverview(tables: SampleTables, days: number): OverviewSummary {
	const today = tables.today;
	const booked = bookedByDay(tables.orders);
	const points = Array.from({ length: days }, (_, index) => {
		const day = today - days + index;
		return {
			day: dayKeyOf(day),
			thisYear: booked.get(day) ?? 0,
			lastYear: booked.get(day - YEAR_SHIFT_DAYS) ?? 0,
		};
	});

	const current = totalsBetween(tables, today - days, today);
	const previous = totalsBetween(tables, today - 2 * days, today - days);
	const average = current.orders > 0 ? current.booked / current.orders : 0;
	const previousAverage =
		previous.orders > 0 ? previous.booked / previous.orders : 0;

	// The attainment is quarter to date. It compares with the previous quarter after the same count of days.
	const quarter = quarterOfDay(today);
	const previousQuarter = shiftQuarter(quarter, -1);
	const { elapsedDays } = quarterProgressOf(quarter, today);
	const teamTargets = teamTargetByQuarter(tables.targets);
	const attainment = attainmentOf(
		totalsBetween(tables, quarter.startDay, today).booked,
		teamTargets.get(quarter.startDay) ?? 0,
	);
	const previousAttainment = attainmentOf(
		totalsBetween(
			tables,
			previousQuarter.startDay,
			previousQuarter.startDay + elapsedDays,
		).booked,
		teamTargets.get(previousQuarter.startDay) ?? 0,
	);

	return {
		points,
		stats: [
			{
				id: "bookings",
				value: current.booked,
				change: changeRatio(current.booked, previous.booked),
				changeKind: "ratio",
			},
			{
				id: "averageOrder",
				value: average,
				change: changeRatio(average, previousAverage),
				changeKind: "ratio",
			},
			{
				id: "orders",
				value: current.orders,
				change: changeRatio(current.orders, previous.orders),
				changeKind: "ratio",
			},
			{
				id: "attainment",
				value: attainment,
				// No booking in the previous quarter means no earlier data, as changeRatio does.
				change:
					previousAttainment === 0 ? null : attainment - previousAttainment,
				changeKind: "points",
			},
		],
	};
}

/** The chart points and the stat figures of the last `days` closed days. The key holds the period. */
export function overviewQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", days],
		queryFn: async (): Promise<OverviewSummary> =>
			buildOverview(getSampleTables(todayDayNumber()), days),
	});
}
