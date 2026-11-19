// Read of the header alerts: the tables that wait for the floor manager, the most urgent first.
// HeaderNotifications reads it after the shell renders. The rules live in lib/attention.ts.
// The queryFn builds the floor board of the sample day. A later SQL view can return the same rows.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { type AttentionReason, buildAttentionItems } from "../lib/attention";
import { buildFloorBoard } from "../lib/floor-board";
import { listServers, listTables } from "../lib/sample-floor";
import {
	listClosedZones,
	listOrders,
	listReservations,
	listSeatings,
} from "../lib/sample-orders";
import { LIVE_REFETCH_MS } from "./orders.queries";

// A table with a check opens its check. A table with guests and no check opens the till for that table.
// linkOptions types each path, so a wrong path fails typecheck.
function checkLink(orderId: string) {
	return linkOptions({ to: "/app/orders/$orderId", params: { orderId } });
}
function tillLink(tableId: string) {
	return linkOptions({ to: "/app/order", search: { table: tableId } });
}

/** One alert of the bell menu. */
export type Alert = {
	/** The table id. One table gives at most one alert. */
	id: string;
	/** Why the table waits. Its label is the message key `alerts.kinds.<kind>`. */
	kind: AttentionReason;
	/** The table name, for example "T4". */
	title: string;
	/** The server of the table, or the check number when the table has a check. */
	detail: string;
	/** ISO time that the wait counts from. */
	at: string;
	link: ReturnType<typeof checkLink> | ReturnType<typeof tillLink>;
};

/** Every alert, the most urgent first. The bell shows the count and the first 5. It refetches every 30 s. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const board = buildFloorBoard(
				listTables(),
				listServers(),
				listOrders(now),
				listSeatings(now),
				listReservations(now),
				listClosedZones(now),
			);
			return buildAttentionItems(board, now).map(
				({ entry, reason, since }) => ({
					id: entry.table.id,
					kind: reason,
					title: entry.table.name,
					detail: entry.openOrder
						? `#${entry.openOrder.number}`
						: (entry.server?.name ?? ""),
					at: since,
					link: entry.openOrder
						? checkLink(entry.openOrder.id)
						: tillLink(entry.table.id),
				}),
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
