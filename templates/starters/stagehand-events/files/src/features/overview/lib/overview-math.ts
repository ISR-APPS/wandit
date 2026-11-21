// The math of the home: the figures of one period, built from the box office in one pass.
// overview.queries.ts calls buildHomeSummary. A later turn moves each part to an SQL read function.
// A sales period is the last full days, up to yesterday: today is still open, so its partial total would read as a drop.
// The events ahead count from now: the next `days` days. The previous period is the same length just before.
import {
	addDays,
	type BoxOffice,
	DAY_MS,
	type Order,
	startOfLocalDay,
	type TierRole,
	toIsoDay,
} from "~/features/organiser";
import { changeRatio } from "./series";

/** One figure with its change against the previous period of the same length. */
export type Figure = {
	value: number;
	/** Ratio: 0.12 is +12 %. null when the previous period has no data, so no "0%" shows. */
	change: number | null;
};

/** One full day of ticket sales, with the same day one period earlier. Feeds the ticket sales chart. */
export type SalesDay = {
	/** The local day, `YYYY-MM-DD`. */
	day: string;
	/** Paid tickets bought on the day. */
	tickets: number;
	previousTickets: number;
	/** Paid revenue of the day, in whole euros. */
	revenue: number;
	previousRevenue: number;
};

/** The sales of one day of the week over the period. */
export type WeekdaySales = {
	/** 0 is Sunday, 6 is Saturday, as Date.getDay. */
	weekday: number;
	orders: number;
	tickets: number;
	/** The same counts in the previous period. */
	previousOrders: number;
	previousTickets: number;
};

/** The booked seats of one venue over the events ahead. `venueId` null is the row of the other venues. */
export type VenueLoad = {
	venueId: string | null;
	/** The venue name. null for the "other venues" row: the page translates it. */
	name: string | null;
	events: number;
	/** Valid tickets of those events. */
	sold: number;
	/** The sum of the ticket limits of those events. */
	capacity: number;
};

/** Everything that the home shows for one period. */
export type HomeSummary = {
	/** Events that start in the next `days` days, against the events of the last `days` days. Cancelled events are out. */
	upcomingEvents: Figure;
	/** Paid tickets of the full days of the period. */
	tickets: Figure;
	/** Paid revenue of the period, in whole euros. */
	revenue: Figure;
	/** Paid orders of the period. */
	orders: Figure;
	/** Scanned tickets / valid tickets of the events that ended in the period. null when no event ended. */
	checkInRate: { value: number | null; change: number | null };
	daily: SalesDay[];
	/** Paid tickets of the period per tier role, in the order early, general, premium. */
	tierMix: { role: TierRole; tickets: number }[];
	/** Revenue / tickets of the period, in euros. null with no ticket. */
	averageTicket: number | null;
	/** One row per day of the week, Sunday first. The chart puts the first day of the locale week first. */
	weekdays: WeekdaySales[];
	/** The 4 venues with the most seats ahead, then one row for the other venues when they have events. */
	venueLoads: VenueLoad[];
};

// The rows of the venue card. 4 venues and "other" use the 5 chart colors.
const SHOWN_VENUES = 4;
const TIER_ROLES = [
	"early",
	"general",
	"premium",
] as const satisfies TierRole[];

type DailyValue = { day: string; current: number; previous: number };

/**
 * A value per day for the last `days` full days, and the same days one period earlier.
 * `timeOf` gives the time that puts an order in a day, or null to skip the order. `amountOf` gives its value.
 */
function buildDailySeries(
	orders: Order[],
	now: number,
	days: number,
	timeOf: (order: Order) => number | null,
	amountOf: (order: Order) => number,
): DailyValue[] {
	const today = startOfLocalDay(now);
	const firstDay = addDays(today, -days);
	const earliest = addDays(firstDay, -days);
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

function figureOf(points: DailyValue[]): Figure {
	const value = points.reduce((total, point) => total + point.current, 0);
	const previous = points.reduce((total, point) => total + point.previous, 0);
	return { value, change: changeRatio(value, previous) };
}

/** The figures of the home for the period of `days` days. */
export function buildHomeSummary(box: BoxOffice, days: number): HomeSummary {
	const { now } = box;
	const today = startOfLocalDay(now);
	const periodStart = addDays(today, -days);
	const tickets = buildDailySeries(
		box.orders,
		now,
		days,
		paidTime,
		(order) => order.quantity,
	);
	const revenue = buildDailySeries(
		box.orders,
		now,
		days,
		paidTime,
		(order) => order.amount,
	);
	const orders = buildDailySeries(box.orders, now, days, paidTime, () => 1);
	const ticketFigure = figureOf(tickets);
	const revenueFigure = figureOf(revenue);

	const live = box.events.filter((event) => event.status !== "cancelled");
	const ahead = live.filter(
		(event) => event.startsAt >= now && event.startsAt < now + days * DAY_MS,
	);
	const held = live.filter(
		(event) => event.startsAt < now && event.startsAt >= now - days * DAY_MS,
	);

	// The check-in rate counts the events that ended in each period. A cancelled event has no door.
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
	const checkInRate = doorRate(periodStart, today);
	const previousCheckInRate = doorRate(
		addDays(periodStart, -days),
		periodStart,
	);

	const roleOfTier = new Map(
		box.events.flatMap((event) =>
			event.tiers.map((tier) => [tier.id, tier.role] as const),
		),
	);
	const roleTickets = new Map<TierRole, number>();
	for (const order of box.orders) {
		const time = paidTime(order);
		const role = roleOfTier.get(order.tierId);
		if (time === null || time < periodStart || time >= today || !role) {
			continue;
		}
		roleTickets.set(role, (roleTickets.get(role) ?? 0) + order.quantity);
	}

	// `day` is YYYY-MM-DD. Midnight UTC, read in UTC, gives the weekday of that calendar day.
	const weekdays: WeekdaySales[] = Array.from({ length: 7 }, (_, weekday) => ({
		weekday,
		orders: 0,
		tickets: 0,
		previousOrders: 0,
		previousTickets: 0,
	}));
	tickets.forEach((point, index) => {
		const row = weekdays[new Date(`${point.day}T00:00:00Z`).getUTCDay()];
		const orderPoint = orders[index];
		if (!row || !orderPoint) {
			return;
		}
		row.tickets += point.current;
		row.previousTickets += point.previous;
		row.orders += orderPoint.current;
		row.previousOrders += orderPoint.previous;
	});

	const loads = new Map<string, VenueLoad>();
	for (const event of ahead) {
		const load = loads.get(event.venueId) ?? {
			venueId: event.venueId,
			name: event.venue.name,
			events: 0,
			sold: 0,
			capacity: 0,
		};
		load.events += 1;
		load.sold += event.sold;
		load.capacity += event.capacity;
		loads.set(event.venueId, load);
	}
	const byCapacity = [...loads.values()].sort(
		(first, second) => second.capacity - first.capacity,
	);
	const rest = byCapacity.slice(SHOWN_VENUES);
	const venueLoads =
		rest.length === 0
			? byCapacity
			: [
					...byCapacity.slice(0, SHOWN_VENUES),
					{
						venueId: null,
						name: null,
						events: rest.reduce((total, load) => total + load.events, 0),
						sold: rest.reduce((total, load) => total + load.sold, 0),
						capacity: rest.reduce((total, load) => total + load.capacity, 0),
					},
				];

	return {
		upcomingEvents: {
			value: ahead.length,
			change: changeRatio(ahead.length, held.length),
		},
		tickets: ticketFigure,
		revenue: revenueFigure,
		orders: figureOf(orders),
		checkInRate: {
			value: checkInRate,
			change:
				checkInRate === null || previousCheckInRate === null
					? null
					: changeRatio(checkInRate, previousCheckInRate),
		},
		daily: tickets.map((point, index) => ({
			day: point.day,
			tickets: point.current,
			previousTickets: point.previous,
			revenue: revenue[index]?.current ?? 0,
			previousRevenue: revenue[index]?.previous ?? 0,
		})),
		tierMix: TIER_ROLES.map((role) => ({
			role,
			tickets: roleTickets.get(role) ?? 0,
		})),
		averageTicket:
			ticketFigure.value === 0
				? null
				: revenueFigure.value / ticketFigure.value,
		weekdays,
		venueLoads,
	};
}
