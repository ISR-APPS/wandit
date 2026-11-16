// Reads of the home: the three figures of the last 30 days and the picks per day of the trend card.
// The loader of the home route prefetches them. OverviewPage reads them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with Supabase read functions (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import {
	addLocalDays,
	buildDailyPicks,
	changeRatio,
	getSampleTables,
	isDeliveredOnTime,
	type KpiItem,
	type PeriodDays,
	type SampleTables,
	STOCK_CURRENCY,
} from "~/features/stock";
import type { TranslationKey } from "~/shared/i18n";

/** The period of the figures and of the first trend load, in days. */
export const OVERVIEW_DAYS = 30;

/** Rows of the receipts and corrections table of the home. Eight rows cover about two days. */
export const LATEST_MOVEMENT_COUNT = 8;

/** One figure before translation. The home turns `labelKey` into the `label` of KpiItem with t(). */
export type OverviewKpi = Omit<KpiItem, "label"> & { labelKey: TranslationKey };

// On-time share of the orders delivered in full between two times. null when none was delivered then.
function onTimeShare(
	tables: SampleTables,
	from: number,
	to: number,
): number | null {
	const delivered = tables.purchaseOrders.filter((order) => {
		const last = order.receipts.at(-1);
		const deliveredAt = last ? Date.parse(last.receivedAt) : Number.NaN;
		return (
			order.status === "received" && deliveredAt >= from && deliveredAt < to
		);
	});
	if (delivered.length === 0) {
		return null;
	}
	return delivered.filter(isDeliveredOnTime).length / delivered.length;
}

// The three figures of the home, the most important first.
function buildOverviewKpis(tables: SampleTables): OverviewKpi[] {
	const picks = buildDailyPicks(
		tables.movements,
		tables.todayStart,
		OVERVIEW_DAYS,
	);
	const unitsPicked = picks.reduce((sum, point) => sum + point.current, 0);
	const unitsBefore = picks.reduce((sum, point) => sum + point.previous, 0);

	const periodStart = addLocalDays(tables.todayStart, -OVERVIEW_DAYS);
	const previousStart = addLocalDays(tables.todayStart, -2 * OVERVIEW_DAYS);
	const onTime = onTimeShare(tables, periodStart, tables.todayStart);
	const onTimeBefore = onTimeShare(tables, previousStart, periodStart);

	// The value 30 days ago: undo every movement of the period, item by item.
	const unitCost = new Map(
		tables.items.map((item) => [item.id, item.unitCost]),
	);
	const stockValue = tables.items.reduce(
		(sum, item) => sum + item.onHand * item.unitCost,
		0,
	);
	const periodChange = tables.movements
		.filter((movement) => Date.parse(movement.occurredAt) >= periodStart)
		.reduce(
			(sum, movement) =>
				sum + movement.quantity * (unitCost.get(movement.itemId) ?? 0),
			0,
		);

	return [
		{
			id: "units-picked",
			labelKey: "metrics.unitsPicked",
			value: unitsPicked,
			change: changeRatio(unitsPicked, unitsBefore),
			goodWhen: "up",
		},
		{
			id: "on-time",
			labelKey: "metrics.onTimeDeliveries",
			value: onTime ?? 0,
			format: { style: "percent", maximumFractionDigits: 0 },
			change:
				onTime === null || onTimeBefore === null
					? null
					: changeRatio(onTime, onTimeBefore),
			goodWhen: "up",
		},
		// Stock value has no good direction: a rise can be a restock or slow stock. So the delta has no color.
		{
			id: "stock-value",
			labelKey: "metrics.stockValue",
			value: stockValue,
			format: {
				style: "currency",
				currency: STOCK_CURRENCY,
				maximumFractionDigits: 0,
			},
			change: changeRatio(stockValue, stockValue - periodChange),
			goodWhen: "neutral",
		},
	];
}

/** The figures of the last 30 days. The key has no period: the trend control does not change them. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => buildOverviewKpis(getSampleTables()),
	});
}

/** Units picked per day for the last `days` full days, with the period before. Feeds the home trend card. */
export function dailyPicksQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "daily-picks", days],
		queryFn: async () => {
			const tables = getSampleTables();
			return buildDailyPicks(tables.movements, tables.todayStart, days);
		},
	});
}
