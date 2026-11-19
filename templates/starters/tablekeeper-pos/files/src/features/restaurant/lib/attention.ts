// The attention rules of the floor: which tables need the floor manager now, and why.
// alertsQueryOptions calls buildAttentionItems with the floor board, and the header bell shows the result.
// The rules follow the trade: a printed bill waits for payment, food waits too long,
// guests wait to order, and a served table waits for its server.
import type { FloorTable } from "./floor-board";

/** Why a table is on the list. Each reason is the message key `alerts.kinds.<reason>`. */
export type AttentionReason =
	| "billWaiting"
	| "kitchenLate"
	| "noOrder"
	| "servedLong";

// The rank of each reason: a lower rank is more urgent. Within one reason, the longest wait comes first.
const REASON_RANK: Record<AttentionReason, number> = {
	billWaiting: 0,
	kitchenLate: 1,
	noOrder: 2,
	servedLong: 3,
};

/** One table that needs the floor manager. */
export type AttentionItem = {
	entry: FloorTable;
	reason: AttentionReason;
	/** ISO time that the wait counts from: the bill, the kitchen ticket, the seating, or the service. */
	since: string;
	/** Minutes of waiting, the second sort key. */
	waitMinutes: number;
};

const MINUTE_MS = 60_000;

// A kitchen ticket older than 20 minutes is late for a bistro main course.
const KITCHEN_LATE_MINUTES = 20;
// Guests who sit 5 minutes with no order need a server.
const NO_ORDER_MINUTES = 5;
// 25 minutes after the mains, a table is ready for dessert or the bill, so the server checks on it.
const SERVED_LONG_MINUTES = 25;

/** The tables that need someone, the most urgent reason first, then the longest wait. */
export function buildAttentionItems(
	entries: FloorTable[],
	now: number,
): AttentionItem[] {
	const minutesFrom = (iso: string) =>
		Math.floor((now - Date.parse(iso)) / MINUTE_MS);
	const items: AttentionItem[] = [];
	for (const entry of entries) {
		const { openOrder, seating } = entry;
		if (entry.status === "bill" && openOrder?.billAt) {
			items.push({
				entry,
				reason: "billWaiting",
				since: openOrder.billAt,
				waitMinutes: minutesFrom(openOrder.billAt),
			});
		} else if (
			entry.status === "ordered" &&
			openOrder &&
			minutesFrom(openOrder.sentAt) > KITCHEN_LATE_MINUTES
		) {
			items.push({
				entry,
				reason: "kitchenLate",
				since: openOrder.sentAt,
				waitMinutes: minutesFrom(openOrder.sentAt),
			});
		} else if (
			entry.status === "seated" &&
			seating &&
			minutesFrom(seating.seatedAt) > NO_ORDER_MINUTES
		) {
			items.push({
				entry,
				reason: "noOrder",
				since: seating.seatedAt,
				waitMinutes: minutesFrom(seating.seatedAt),
			});
		} else if (
			entry.status === "served" &&
			openOrder?.servedAt &&
			minutesFrom(openOrder.servedAt) > SERVED_LONG_MINUTES
		) {
			items.push({
				entry,
				reason: "servedLong",
				since: openOrder.servedAt,
				waitMinutes: minutesFrom(openOrder.servedAt),
			});
		}
	}
	return items.sort(
		(first, second) =>
			REASON_RANK[first.reason] - REASON_RANK[second.reason] ||
			second.waitMinutes - first.waitMinutes,
	);
}
