// Reads of the home: the KPI rows, the bookings per day, and the bookings by territory.
// The loader of the home route prefetches them. OverviewPage reads them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	attainmentOf,
	type BreakdownSlice,
	buildDailySeries,
	changeRatio,
	type DailyPoint,
	getSampleTables,
	type KpiItem,
	MONEY_OPTIONS,
	quarterOfDay,
	quarterProgressOf,
	type SampleTables,
	shiftQuarter,
	teamTargetByQuarter,
	todayDayNumber,
} from "~/features/sales";
import type { TranslationKey } from "~/shared/i18n";

/** The figures of the band and the breakdown cover this many closed days. */
export const KPI_WINDOW_DAYS = 30;

/** One KPI before translation. The home turns `labelKey` into the `label` of KpiItem with t(). */
export type OverviewKpi = Omit<KpiItem, "label"> & { labelKey: TranslationKey };

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

// The 4 KPIs of the home, the most important first.
function buildOverviewKpis(tables: SampleTables): OverviewKpi[] {
	const today = tables.today;
	const current = totalsBetween(tables, today - KPI_WINDOW_DAYS, today);
	const previous = totalsBetween(
		tables,
		today - 2 * KPI_WINDOW_DAYS,
		today - KPI_WINDOW_DAYS,
	);
	const average = current.orders > 0 ? current.booked / current.orders : 0;
	const previousAverage =
		previous.orders > 0 ? previous.booked / previous.orders : 0;
	// The attainment compares with the previous quarter after the same count of days.
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
	return [
		{
			id: "bookings",
			labelKey: "metrics.bookings",
			value: current.booked,
			// "$1.56M": a full amount of 7 digits pushes the pill under the value in a quarter-width card.
			format: {
				...MONEY_OPTIONS,
				notation: "compact",
				maximumFractionDigits: 2,
			},
			change: changeRatio(current.booked, previous.booked),
			changeKind: "ratio",
			goodWhen: "up",
		},
		{
			id: "orders",
			labelKey: "metrics.orders",
			value: current.orders,
			change: changeRatio(current.orders, previous.orders),
			changeKind: "ratio",
			goodWhen: "up",
		},
		{
			id: "average-order",
			labelKey: "metrics.averageOrder",
			value: average,
			format: MONEY_OPTIONS,
			change: changeRatio(average, previousAverage),
			changeKind: "ratio",
			goodWhen: "up",
		},
		{
			id: "attainment",
			labelKey: "metrics.attainment",
			value: attainment,
			format: { style: "percent", maximumFractionDigits: 0 },
			// A percent changes in points: 48 % against 48.9 % is -0.9 pts, not -1.8 %.
			// No booking in the previous quarter means no earlier data, as changeRatio does.
			change: previousAttainment === 0 ? null : attainment - previousAttainment,
			changeKind: "points",
			goodWhen: "up",
		},
	];
}

/** The KPI rows of the home. The key has no period: the band always covers KPI_WINDOW_DAYS. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async (): Promise<OverviewKpi[]> =>
			buildOverviewKpis(getSampleTables(todayDayNumber())),
	});
}

/** Booked amount per day for the last `days` closed days, with the same days one period earlier and the daily target. */
export function dailyBookingsQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", "daily-bookings", days],
		queryFn: async (): Promise<DailyPoint[]> => {
			const tables = getSampleTables(todayDayNumber());
			return buildDailySeries(
				tables.orders,
				tables.targets,
				tables.today,
				days,
			);
		},
	});
}

/** Booked amount by territory in the last `days` closed days, largest first. The team has 5 territories, so no "other". */
export function territoryBookingsQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", "territory-bookings", days],
		queryFn: async (): Promise<BreakdownSlice[]> => {
			const tables = getSampleTables(todayDayNumber());
			const territoryOf = new Map(
				tables.accounts.map((account) => [account.id, account.territoryId]),
			);
			const firstDay = tables.today - days;
			const totals = new Map<string, number>();
			for (const order of tables.orders) {
				const territoryId = territoryOf.get(order.accountId);
				if (order.day >= firstDay && !order.isCancelled && territoryId) {
					totals.set(
						territoryId,
						(totals.get(territoryId) ?? 0) + order.amount,
					);
				}
			}
			return tables.territories
				.map((territory) => ({
					label: territory.name,
					value: totals.get(territory.id) ?? 0,
				}))
				.sort((first, second) => second.value - first.value);
		},
	});
}
