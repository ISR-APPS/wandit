// Reads of the programme: every event, and one event with its orders and its sales pace.
// The list and detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample box office. A later turn replaces each body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import { loadBoxOffice } from "~/features/organiser";
import { buildSalesPace } from "../lib/sales-pace";

/** How many orders the event page lists under "Latest orders". 5 keeps the rail near the height of the main column. */
const LATEST_ORDERS_COUNT = 5;

/** Every event: the events that have not ended first (the soonest first), then the past events (the newest first). */
export function eventsQueryOptions() {
	return queryOptions({
		queryKey: ["events", "list"],
		queryFn: async () => {
			const box = loadBoxOffice(Date.now());
			const ahead = box.events.filter((event) => event.endsAt > box.now);
			const past = box.events
				.filter((event) => event.endsAt <= box.now)
				.reverse();
			return [...ahead, ...past];
		},
	});
}

/** One event with its newest orders and its sales pace, or null when the id does not exist. */
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
				latestOrders: orders.slice(-LATEST_ORDERS_COUNT).reverse(),
				salesPace: buildSalesPace(event, orders, box.now),
				now: box.now,
			};
		},
	});
}
