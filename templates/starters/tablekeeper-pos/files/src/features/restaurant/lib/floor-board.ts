// Builds the live floor: one entry per table with its status, its open check, its next booking, and a closed zone.
// floorQueryOptions calls it. The stat cards of the home, the alerts, and the table select of the order screen read it.
// It is a pure function of the sample rows and `now`, so a later SQL view can replace it with the same rules.
// guestsAt counts the guests of some entries for the "tables in use" card of the home.
import type { DiningTable, Reservation, Seating, Server } from "./sample-floor";
import type { ClosedZone, Order, OrderStatus } from "./sample-orders";
import type { TableStatus } from "./status";

/** One table of the floor with everything its tile shows. */
export type FloorTable = {
	table: DiningTable;
	status: TableStatus;
	server: Server | undefined;
	/** The open check of the table. Present for ordered, served, and bill. */
	openOrder: Order | undefined;
	/** Guests seated with no order yet. Present for seated only. */
	seating: Seating | undefined;
	/** The booking of the next hour. Present for reserved only. */
	reservation: Reservation | undefined;
	/** ISO time when the last check of the table was paid. null when the table had no guest today. */
	lastPaidAt: string | null;
	/** The next opening of the zone. Present for a free table in a zone that takes no guests now. */
	closedZone: ClosedZone | undefined;
};

// The table status that each open order status gives.
const STATUS_OF_OPEN_ORDER: Partial<Record<OrderStatus, TableStatus>> = {
	in_kitchen: "ordered",
	served: "served",
	bill: "bill",
};

/** The floor in the order of the floor plan. An open check wins over a seating, and a seating over a booking. */
export function buildFloorBoard(
	tables: DiningTable[],
	servers: Server[],
	orders: Order[],
	seatings: Seating[],
	reservations: Reservation[],
	closedZones: ClosedZone[],
): FloorTable[] {
	return tables.map((table) => {
		const tableOrders = orders.filter((order) => order.tableId === table.id);
		const openOrder = tableOrders.find(
			(order) => STATUS_OF_OPEN_ORDER[order.status] !== undefined,
		);
		const seating = seatings.find((entry) => entry.tableId === table.id);
		const reservation = reservations.find(
			(entry) => entry.tableId === table.id,
		);
		const lastPaid = tableOrders
			.map((order) => order.paidAt)
			.filter((paidAt) => paidAt !== null)
			.sort()
			.at(-1);
		const status: TableStatus =
			(openOrder ? STATUS_OF_OPEN_ORDER[openOrder.status] : undefined) ??
			(seating ? "seated" : reservation ? "reserved" : "free");
		return {
			table,
			status,
			server: servers.find((server) => server.id === table.serverId),
			openOrder,
			seating: status === "seated" ? seating : undefined,
			reservation: status === "reserved" ? reservation : undefined,
			lastPaidAt: lastPaid ?? null,
			closedZone:
				status === "free"
					? closedZones.find((entry) => entry.zone === table.zone)
					: undefined,
		};
	});
}

/** Guests at the tables of `entries`: the covers of the open check, else of the seating. A booking counts 0. */
export function guestsAt(entries: FloorTable[]): number {
	return entries.reduce(
		(sum, entry) =>
			sum + (entry.openOrder?.covers ?? entry.seating?.covers ?? 0),
		0,
	);
}
