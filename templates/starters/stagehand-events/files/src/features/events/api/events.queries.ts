// Reads of the programme: every event, and one event with its orders and its sales pace.
// The list and detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample box office. A later turn replaces each body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type AttendanceStatus,
	attendanceOf,
	type EventSummary,
	loadBoxOffice,
	type Order,
} from "~/features/organiser";
import { buildSalesPace } from "../lib/sales-pace";

/** One order of the event page, with its door status at the time of the load. */
export type EventOrder = Order & { status: AttendanceStatus };

/** How many buyers an event card of the list shows as avatars. */
const CARD_BUYERS_COUNT = 3;

/** One event of the list, with the names of its newest buyers for the avatar stack of its card. */
export type EventListRow = EventSummary & {
	/** Up to 3 distinct buyer names of the newest valid orders, the newest first. */
	recentBuyers: string[];
};

/** Every event: the events that have not ended first (the soonest first), then the past events (the newest first). */
export function eventsQueryOptions() {
	return queryOptions({
		queryKey: ["events", "list"],
		queryFn: async (): Promise<EventListRow[]> => {
			const box = loadBoxOffice(Date.now());
			const buyers = new Map<string, string[]>();
			// The orders of each event are oldest first, so the loop keeps the last names it sees.
			for (const order of box.orders) {
				if (order.refundedAt !== null) {
					continue;
				}
				// A buyer with two orders shows once, at the place of the newest order.
				const others = (buyers.get(order.eventId) ?? []).filter(
					(name) => name !== order.buyerName,
				);
				buyers.set(
					order.eventId,
					[order.buyerName, ...others].slice(0, CARD_BUYERS_COUNT),
				);
			}
			const rows = box.events.map((event) => ({
				...event,
				recentBuyers: buyers.get(event.id) ?? [],
			}));
			const ahead = rows.filter((event) => event.endsAt > box.now);
			const past = rows.filter((event) => event.endsAt <= box.now).reverse();
			return [...ahead, ...past];
		},
	});
}

/** One event with its orders (the newest first) and its sales pace, or null when the id does not exist. */
export function eventQueryOptions(eventId: string) {
	return queryOptions({
		queryKey: ["events", "detail", eventId],
		queryFn: async () => {
			const box = loadBoxOffice(Date.now());
			const event = box.events.find((row) => row.id === eventId);
			if (!event) {
				return null;
			}
			const orders = box.orders.filter((order) => order.eventId === eventId);
			return {
				event,
				orders: orders
					.map(
						(order): EventOrder => ({
							...order,
							status: attendanceOf(order, event, box.now),
						}),
					)
					.reverse(),
				salesPace: buildSalesPace(event, orders, box.now),
				now: box.now,
			};
		},
	});
}
