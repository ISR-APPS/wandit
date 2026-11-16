// The four figures of the home facts row and the pure function that builds them from the order rows.
// overview.queries.ts calls buildOverviewKpis. OverviewFacts draws the items.
// A SQL read function does the same sums later.
import {
	calendarDaysFromNow,
	changeRatio,
	countsAsRevenue,
	type SampleTables,
} from "~/features/shop";

/** The ids of the figures, in order of importance. The label is the message key `overview.kpis.<id>`. */
export type KpiId = "orders" | "averageOrder" | "unitsSold" | "refunded";

/** One figure of the facts row. */
export type KpiItem = {
	/** Stable id, also the React key. */
	id: KpiId;
	value: number;
	/**
	 * How the value is written: a plain count, an amount in whole currency units, or an amount with cents.
	 * Only the average order has cents: the prices of the shop are whole amounts.
	 */
	kind: "count" | "money" | "moneyCents";
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for refunds: a fall is good news. */
	goodWhen: "up" | "down";
	/** One value per day of the period, oldest first, for the spark. */
	series: number[];
};

// The sum of values[from] to values[to - 1].
function sumOf(values: number[], from: number, to: number): number {
	let sum = 0;
	for (let index = Math.max(0, from); index < to; index += 1) {
		sum += values[index] ?? 0;
	}
	return sum;
}

// No order gives no average: the figure shows 0, and the delta hides.
function ratio(part: number, whole: number): number {
	return whole === 0 ? 0 : part / whole;
}

/**
 * The figures of the last `days` full days, each against the `days` days before.
 * An order and its units count when the order counts as revenue. A refund counts on the day of the refund.
 */
export function buildOverviewKpis(
	tables: SampleTables,
	days: number,
): KpiItem[] {
	const span = 2 * days;
	// One slot per day, oldest first: the previous period, then the current period.
	const counts = new Array<number>(span).fill(0);
	const revenue = new Array<number>(span).fill(0);
	const units = new Array<number>(span).fill(0);
	const refunds = new Array<number>(span).fill(0);
	// The units of each order: the sum of the quantities of its lines.
	const unitsOf = new Map<string, number>();
	for (const line of tables.orderLines) {
		unitsOf.set(line.orderId, (unitsOf.get(line.orderId) ?? 0) + line.quantity);
	}
	for (const order of tables.orders) {
		const placedDaysAgo = -calendarDaysFromNow(order.placedAt, tables.dayStart);
		if (
			countsAsRevenue(order.status) &&
			placedDaysAgo >= 1 &&
			placedDaysAgo <= span
		) {
			const slot = span - placedDaysAgo;
			counts[slot] = (counts[slot] ?? 0) + 1;
			revenue[slot] = (revenue[slot] ?? 0) + order.total;
			units[slot] = (units[slot] ?? 0) + (unitsOf.get(order.id) ?? 0);
		}
		if (order.refundedAt) {
			const refundedDaysAgo = -calendarDaysFromNow(
				order.refundedAt,
				tables.dayStart,
			);
			if (refundedDaysAgo >= 1 && refundedDaysAgo <= span) {
				const slot = span - refundedDaysAgo;
				refunds[slot] = (refunds[slot] ?? 0) + order.total;
			}
		}
	}

	// The current period is the second half of the slots.
	const now = (values: number[]) => sumOf(values, days, span);
	const before = (values: number[]) => sumOf(values, 0, days);
	const currentSlots = Array.from({ length: days }, (_, index) => days + index);
	const averageNow = ratio(now(revenue), now(counts));
	const averageBefore = ratio(before(revenue), before(counts));
	// The average order of each day. A day with no order keeps the value of the day before, so the spark has no hole.
	let lastAverage = averageBefore;
	const averagePerDay = currentSlots.map((slot) => {
		if ((counts[slot] ?? 0) > 0) {
			lastAverage = (revenue[slot] ?? 0) / (counts[slot] ?? 1);
		}
		return lastAverage;
	});
	return [
		{
			id: "orders",
			value: now(counts),
			kind: "count",
			change: changeRatio(now(counts), before(counts)),
			goodWhen: "up",
			series: counts.slice(days),
		},
		{
			id: "averageOrder",
			value: averageNow,
			kind: "moneyCents",
			change: changeRatio(averageNow, averageBefore),
			goodWhen: "up",
			series: averagePerDay,
		},
		{
			id: "unitsSold",
			value: now(units),
			kind: "count",
			change: changeRatio(now(units), before(units)),
			goodWhen: "up",
			series: units.slice(days),
		},
		{
			id: "refunded",
			value: now(refunds),
			kind: "money",
			change: changeRatio(now(refunds), before(refunds)),
			goodWhen: "down",
			// Refunds are rare events. The spark shows the running total of the period, so it rises in steps.
			series: currentSlots.map((slot) => sumOf(refunds, days, slot + 1)),
		},
	];
}
