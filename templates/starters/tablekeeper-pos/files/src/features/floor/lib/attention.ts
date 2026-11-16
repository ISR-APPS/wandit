// The attention rules of the floor: which tables need the floor manager now, and why.
// AttentionPanel calls buildAttentionItems with the floor board. The rules follow the trade:
// a printed bill waits for payment, food waits too long, guests wait to order, a served table waits for its
// server, and a booking comes in the next hour.
import type { FloorTable } from "~/features/restaurant";

/** Why a table is on the list. Each reason is the message key `floor.<reason>`. */
export type AttentionReason =
	| "billWaiting"
	| "kitchenLate"
	| "noOrder"
	| "servedLong"
	| "bookingSoon";

// The rank of each reason: a lower rank is more urgent. Within one reason, the longest wait comes first.
const REASON_RANK: Record<AttentionReason, number> = {
	billWaiting: 0,
	kitchenLate: 1,
	noOrder: 2,
	servedLong: 3,
	bookingSoon: 4,
};

/** One row of the attention list. */
export type AttentionItem = {
	entry: FloorTable;
	reason: AttentionReason;
	/** ISO time that the row counts from (the bill, the kitchen ticket, the seating) or counts to (a booking). */
	since: string;
	/** Minutes of waiting, the second sort key. A booking counts the minutes that are left, as a negative number. */
	waitMinutes: number;
};

const MINUTE_MS = 60_000;

// A kitchen ticket older than 20 minutes is late for a bistro main course.
const KITCHEN_LATE_MINUTES = 20;
// Guests who sit 5 minutes with no order need a server.
const NO_ORDER_MINUTES = 5;
// 25 minutes after the mains, a table is ready for dessert or the bill, so the server checks on it.
const SERVED_LONG_MINUTES = 25;
// A booking in the next hour needs its table ready.
const BOOKING_SOON_MINUTES = 60;

/** The rows of the list, the most urgent reason first, then the longest wait. The panel shows at most 5. */
export function buildAttentionItems(
	entries: FloorTable[],
	now: number,
): AttentionItem[] {
	const minutesFrom = (iso: string) =>
		Math.floor((now - Date.parse(iso)) / MINUTE_MS);
	const items: AttentionItem[] = [];
	for (const entry of entries) {
		const { openOrder, seating, reservation } = entry;
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
		} else if (
			entry.status === "reserved" &&
			reservation &&
			-minutesFrom(reservation.startsAt) <= BOOKING_SOON_MINUTES
		) {
			items.push({
				entry,
				reason: "bookingSoon",
				since: reservation.startsAt,
				waitMinutes: minutesFrom(reservation.startsAt),
			});
		}
	}
	return items.sort(
		(first, second) =>
			REASON_RANK[first.reason] - REASON_RANK[second.reason] ||
			second.waitMinutes - first.waitMinutes,
	);
}
