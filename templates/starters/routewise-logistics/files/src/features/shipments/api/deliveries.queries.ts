// Reads of the delivery figures: closed shipments per day and outcome, the figures of a period, and late deliveries by reason.
// The loader of the home prefetches them. The deliveries panel and the reasons panel of the home read them.
// Each queryFn reads the sample shipments. A later turn replaces its body with one rpc call to a SQL read function.
import { queryOptions } from "@tanstack/react-query";
import {
	changeRatio,
	type Figure,
	getSampleTables,
	type PeriodDays,
} from "~/features/logistics";
import type { TranslationKey } from "~/shared/i18n";
import {
	buildLateByReason,
	buildOutcomeSeries,
	buildPeriodTotals,
	onTimeRate,
	onTimeRateChange,
	type PeriodTotals,
} from "../lib/delivery-stats";

// The 4 figures of the deliveries panel, the most important first.
function buildDeliveryFigures(totals: PeriodTotals): Figure<TranslationKey>[] {
	const delivered = totals.current.on_time + totals.current.late;
	const deliveredBefore = totals.previous.on_time + totals.previous.late;
	return [
		{
			id: "delivered",
			labelKey: "deliveries.delivered",
			value: delivered,
			change: changeRatio(delivered, deliveredBefore),
			goodWhen: "up",
		},
		{
			id: "on-time-rate",
			labelKey: "deliveries.onTimeRate",
			value: onTimeRate(totals.current) ?? 0,
			format: { style: "percent", maximumFractionDigits: 1 },
			change: onTimeRateChange(totals),
			goodWhen: "up",
		},
		{
			id: "late",
			labelKey: "deliveries.late",
			value: totals.current.late,
			change: changeRatio(totals.current.late, totals.previous.late),
			goodWhen: "down",
		},
		{
			id: "failed",
			labelKey: "deliveries.failed",
			value: totals.current.failed,
			change: changeRatio(totals.current.failed, totals.previous.failed),
			goodWhen: "down",
		},
	];
}

/** Closed shipments per day and outcome for the last `days` full days, oldest first. Feeds the stacked trend chart. */
export function deliveryOutcomesQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["deliveries", "outcomes", days],
		queryFn: async () => {
			const tables = getSampleTables();
			return buildOutcomeSeries(tables.shipments, days, tables.dayStart);
		},
	});
}

/** Delivered, on-time rate, late, and failed for the last `days` full days, each with its change against the days before. */
export function deliveryFiguresQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["deliveries", "figures", days],
		queryFn: async () => {
			const tables = getSampleTables();
			return buildDeliveryFigures(
				buildPeriodTotals(tables.shipments, days, tables.dayStart),
			);
		},
	});
}

/** Late deliveries of the last `days` full days by reason, the largest part first. Feeds the breakdown panel. */
export function lateByReasonQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["deliveries", "late-by-reason", days],
		queryFn: async () => {
			const tables = getSampleTables();
			return buildLateByReason(tables.shipments, days, tables.dayStart);
		},
	});
}
