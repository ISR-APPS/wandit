// The math of the home: daily series of the orders, and the four KPIs of the facts row.
// overview.queries.ts calls these pure functions on the box office. A later turn moves them to SQL read functions.
// A period is the last full days, up to yesterday: today is still open, so its partial total would read as a drop.
// The previous period is the same number of days just before. Today has its own "so far" figure.

import {
	addDays,
	BOX_OFFICE_CURRENCY,
	type BoxOffice,
	type Order,
	startOfLocalDay,
	toIsoDay,
} from "~/features/organiser";
import type { TranslationKey } from "~/shared/i18n";
import { changeRatio, type DailyPoint, type KpiItem } from "./series";

/** One KPI before translation. The home turns `labelKey` into the `label` of KpiItem with t(). */
export type OverviewKpi = Omit<KpiItem, "label"> & {
	labelKey: TranslationKey;
};

/** The period of the facts row, in days. The home names it once above the facts. */
export const KPI_DAYS = 30;

/** The start of the first day of a period of `days` full days that ends yesterday, in milliseconds since 1970. */
function periodStart(now: number, days: number): number {
	return addDays(startOfLocalDay(now), -days);
}

/**
 * A value per day for the last `days` full days, and the same days one period earlier.
 * `timeOf` gives the time that puts an order in a day, or null to skip the order. `amountOf` gives its value.
 */
export function buildDailySeries(
	orders: Order[],
	now: number,
	days: number,
	timeOf: (order: Order) => number | null,
	amountOf: (order: Order) => number,
): DailyPoint[] {
	const firstDay = periodStart(now, days);
	const earliest = addDays(firstDay, -days);
	const today = startOfLocalDay(now);
	const totals = new Map<string, number>();
	for (const order of orders) {
		const time = timeOf(order);
		if (time === null || time < earliest || time >= today) {
			continue;
		}
		const day = toIsoDay(time);
		totals.set(day, (totals.get(day) ?? 0) + amountOf(order));
	}
	return Array.from({ length: days }, (_, index) => {
		const dayStart = addDays(firstDay, index);
		const day = toIsoDay(dayStart);
		return {
			day,
			current: totals.get(day) ?? 0,
			previous: totals.get(toIsoDay(addDays(dayStart, -days))) ?? 0,
		};
	});
}

// Revenue counts the orders that are not refunded, on the day of the purchase.
function paidTime(order: Order): number | null {
	return order.refundedAt === null ? order.placedAt : null;
}

/** Ticket revenue per day, in whole euros. The hero reads it. */
export function dailyRevenue(box: BoxOffice, days: number): DailyPoint[] {
	return buildDailySeries(
		box.orders,
		box.now,
		days,
		paidTime,
		(order) => order.amount,
	);
}

/** The sales of today until now: the revenue in whole euros and the count of orders. Refunds are out. */
export function todaySales(box: BoxOffice): {
	revenue: number;
	orders: number;
} {
	const today = startOfLocalDay(box.now);
	const paid = box.orders.filter(
		(order) => order.refundedAt === null && order.placedAt >= today,
	);
	return {
		revenue: paid.reduce((total, order) => total + order.amount, 0),
		orders: paid.length,
	};
}

function sum(points: DailyPoint[], key: "current" | "previous"): number {
	return points.reduce((total, point) => total + point[key], 0);
}

/** The four KPIs of the facts row over KPI_DAYS days, the most important first. */
export function buildOverviewKpis(box: BoxOffice): OverviewKpi[] {
	const tickets = buildDailySeries(
		box.orders,
		box.now,
		KPI_DAYS,
		paidTime,
		(order) => order.quantity,
	);
	const revenue = dailyRevenue(box, KPI_DAYS);
	// A cancelled event refunds every order at once. The KPI counts only the refunds that buyers ask for.
	const cancelledEventIds = new Set(
		box.events
			.filter((event) => event.cancelledAt !== null)
			.map((event) => event.id),
	);
	const refunds = buildDailySeries(
		box.orders,
		box.now,
		KPI_DAYS,
		(order) => (cancelledEventIds.has(order.eventId) ? null : order.refundedAt),
		() => 1,
	);
	const ticketCount = sum(tickets, "current");
	const previousTicketCount = sum(tickets, "previous");
	const averagePrice =
		ticketCount === 0 ? 0 : sum(revenue, "current") / ticketCount;
	const previousAveragePrice =
		previousTicketCount === 0
			? 0
			: sum(revenue, "previous") / previousTicketCount;

	// The check-in rate counts the events that ended in each period. A cancelled event has no door.
	const windowStart = periodStart(box.now, KPI_DAYS);
	const previousStart = addDays(windowStart, -KPI_DAYS);
	const doorRate = (from: number, to: number) => {
		const ended = box.events.filter(
			(event) =>
				event.status === "completed" &&
				event.endsAt >= from &&
				event.endsAt < to,
		);
		const sold = ended.reduce((total, event) => total + event.sold, 0);
		const scanned = ended.reduce((total, event) => total + event.checkedIn, 0);
		return sold === 0 ? null : scanned / sold;
	};
	const checkInRate = doorRate(windowStart, startOfLocalDay(box.now));
	const previousCheckInRate = doorRate(previousStart, windowStart);
	// The spark: the door rate of the events that ended on each day. A day with no event keeps the last rate.
	let lastRate = previousCheckInRate ?? checkInRate ?? 0;
	const checkInSeries = Array.from({ length: KPI_DAYS }, (_, index) => {
		const dayStart = addDays(windowStart, index);
		lastRate = doorRate(dayStart, addDays(dayStart, 1)) ?? lastRate;
		return lastRate;
	});

	return [
		{
			id: "tickets",
			labelKey: "overview.kpis.tickets",
			value: ticketCount,
			change: changeRatio(ticketCount, previousTicketCount),
			goodWhen: "up",
			series: tickets.map((point) => point.current),
		},
		{
			id: "average-price",
			labelKey: "overview.kpis.averagePrice",
			value: averagePrice,
			format: {
				style: "currency",
				currency: BOX_OFFICE_CURRENCY,
				maximumFractionDigits: 2,
			},
			change: changeRatio(averagePrice, previousAveragePrice),
			goodWhen: "up",
			series: tickets.map((point, index) => {
				const dayRevenue = revenue[index]?.current ?? 0;
				return point.current === 0 ? 0 : dayRevenue / point.current;
			}),
		},
		{
			id: "check-in-rate",
			labelKey: "overview.kpis.checkInRate",
			value: checkInRate ?? 0,
			format: { style: "percent", maximumFractionDigits: 1 },
			change:
				checkInRate === null || previousCheckInRate === null
					? null
					: changeRatio(checkInRate, previousCheckInRate),
			goodWhen: "up",
			series: checkInSeries,
		},
		{
			id: "refunds",
			labelKey: "overview.kpis.refunds",
			value: sum(refunds, "current"),
			change: changeRatio(sum(refunds, "current"), sum(refunds, "previous")),
			goodWhen: "down",
			series: refunds.map((point) => point.current),
		},
	];
}
