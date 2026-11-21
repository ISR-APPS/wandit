// Read of the live floor: the 20 tables with their status, open check, and next booking.
// The sales home, the order screen, and the alerts of the header read it. The /app loader prefetches it.
// The queryFn joins the sample tables, checks, seatings, and bookings of the day plan. A later SQL view can return the same rows.
import { queryOptions } from "@tanstack/react-query";
import { buildFloorBoard } from "../lib/floor-board";
import { listServers, listTables } from "../lib/sample-floor";
import {
	listClosedZones,
	listOrders,
	listReservations,
	listSeatings,
} from "../lib/sample-orders";
import { LIVE_REFETCH_MS } from "./orders.queries";

/** The tables in the order of the floor plan, with their live status. It refetches every 30 s. */
export function floorQueryOptions() {
	return queryOptions({
		queryKey: ["floor", "board"],
		queryFn: async () => {
			const now = Date.now();
			return buildFloorBoard(
				listTables(),
				listServers(),
				listOrders(now),
				listSeatings(now),
				listReservations(now),
				listClosedZones(now),
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
