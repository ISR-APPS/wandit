// Reads of the home: the revenue per day and the four figures of the facts row.
// The loader of the home route prefetches them for the first period. The hero and the facts row read them per period.
// Each queryFn reads the sample tables. A later turn replaces its body with a call of a SQL read function.
import { queryOptions } from "@tanstack/react-query";
import {
	buildDailySeries,
	countsAsRevenue,
	getSampleTables,
	type PeriodDays,
} from "~/features/shop";
import { buildOverviewKpis } from "../lib/kpis";

/** Revenue per day for the last `days` full days, with the same days one period earlier. Feeds the hero. */
export function revenuePerDayQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "revenue-daily", days],
		queryFn: async () => {
			const tables = getSampleTables();
			return buildDailySeries(
				tables.orders.flatMap((order) =>
					countsAsRevenue(order.status)
						? [{ occurredAt: order.placedAt, value: order.total }]
						: [],
				),
				days,
				tables.dayStart,
			);
		},
	});
}

/** The figures of the facts row for the last `days` full days: orders, average order, units sold, refunds. */
export function overviewKpisQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "kpis", days],
		queryFn: async () => buildOverviewKpis(getSampleTables(), days),
	});
}
