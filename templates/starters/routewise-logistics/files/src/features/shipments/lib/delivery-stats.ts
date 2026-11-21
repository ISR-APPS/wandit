// The math of the delivery figures: closed shipments per day and outcome, and the totals of a period.
// deliveries.queries.ts calls these pure functions on the sample rows. SQL read functions do the same math later.
import {
	type CategoryPoint,
	changeRatio,
	DELIVERY_OUTCOMES,
	type DeliveryOutcome,
	dayKey,
	daysAgoOf,
	outcomeOf,
	type ShipmentRow,
} from "~/features/logistics";

/** The count of closed shipments of one period, by outcome. */
export type OutcomeTotals = Record<DeliveryOutcome, number>;

/** The totals of the last `days` full days, and of the `days` days before. */
export type PeriodTotals = { current: OutcomeTotals; previous: OutcomeTotals };

/**
 * Closed shipments per day and outcome for the last `days` full days: the last day is yesterday.
 * Every day has one point per outcome, so a day with no delivery shows 0.
 */
export function buildOutcomeSeries(
	rows: ShipmentRow[],
	days: number,
	dayStart: number,
): CategoryPoint<DeliveryOutcome>[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		const outcome = outcomeOf(row, dayStart);
		if (!outcome || !row.closedAt) {
			continue;
		}
		const daysAgo = daysAgoOf(row.closedAt, dayStart);
		if (daysAgo >= 1 && daysAgo <= days) {
			const key = `${daysAgo}:${outcome}`;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return Array.from({ length: days }, (_, index) => days - index).flatMap(
		(daysAgo) =>
			DELIVERY_OUTCOMES.map((outcome) => ({
				day: dayKey(dayStart, daysAgo),
				category: outcome,
				value: counts.get(`${daysAgo}:${outcome}`) ?? 0,
			})),
	);
}

/** Counts the closed shipments of the last `days` full days and of the `days` days before, by outcome. */
export function buildPeriodTotals(
	rows: ShipmentRow[],
	days: number,
	dayStart: number,
): PeriodTotals {
	const totals: PeriodTotals = {
		current: { on_time: 0, late: 0, failed: 0 },
		previous: { on_time: 0, late: 0, failed: 0 },
	};
	for (const row of rows) {
		const outcome = outcomeOf(row, dayStart);
		if (!outcome || !row.closedAt) {
			continue;
		}
		const daysAgo = daysAgoOf(row.closedAt, dayStart);
		if (daysAgo >= 1 && daysAgo <= days) {
			totals.current[outcome] += 1;
		} else if (daysAgo > days && daysAgo <= 2 * days) {
			totals.previous[outcome] += 1;
		}
	}
	return totals;
}

/** Delivered on time as a share of all delivered shipments. null when nothing was delivered: no rate exists. */
export function onTimeRate(totals: OutcomeTotals): number | null {
	const delivered = totals.on_time + totals.late;
	return delivered === 0 ? null : totals.on_time / delivered;
}

/** The change of the on-time rate against the previous period. null when one of the two periods has no delivery. */
export function onTimeRateChange(totals: PeriodTotals): number | null {
	const current = onTimeRate(totals.current);
	const previous = onTimeRate(totals.previous);
	return current === null || previous === null
		? null
		: changeRatio(current, previous);
}
