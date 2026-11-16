// The order view of the pages: one order row with the names of its account, rep, and territory.
// The orders query, the rep query, and the home read orders through toOrders.
// A database join gives the same names later.
import { localDateTimeOf } from "./calendar";
import { type OrderStatus, orderStatusOf } from "./order-status";
import type {
	AccountSegment,
	OrderLineRow,
	OrderRow,
	SampleTables,
} from "./sample-data";

/** One order with the names that a table shows. */
export type Order = {
	id: string;
	/** The order number that the team reads, for example "SO-332336". */
	number: string;
	accountName: string;
	segment: AccountSegment;
	repId: string;
	repName: string;
	territoryName: string;
	/** The booking time, as ISO. */
	bookedAt: string;
	status: OrderStatus;
	/** 1 to 3 lines. The dialog lists them. */
	lines: OrderLineRow[];
	/** The sum of the line amounts, in whole units of CURRENCY. */
	amount: number;
};

/** Adds the names to order rows and sorts them newest first. Orders of the same minute sort by number, highest first. */
export function toOrders(rows: OrderRow[], tables: SampleTables): Order[] {
	const accounts = new Map(tables.accounts.map((row) => [row.id, row]));
	const reps = new Map(tables.reps.map((row) => [row.id, row]));
	const territories = new Map(tables.territories.map((row) => [row.id, row]));
	return (
		rows
			.map((row) => {
				const account = accounts.get(row.accountId);
				return {
					id: row.id,
					number: row.number,
					accountName: account?.name ?? "",
					segment: account?.segment ?? "retail",
					repId: row.repId,
					repName: reps.get(row.repId)?.name ?? "",
					territoryName:
						territories.get(account?.territoryId ?? "")?.name ?? "",
					bookedAt: localDateTimeOf(row.day, row.minutes).toISOString(),
					status: orderStatusOf({
						isCancelled: row.isCancelled,
						ageDays: tables.today - row.day,
						delayDays: row.delayDays,
					}),
					lines: row.lines,
					amount: row.amount,
				};
			})
			// Booking times have minute precision. The number breaks a tie, so the newest number stays first.
			.sort(
				(first, second) =>
					second.bookedAt.localeCompare(first.bookedAt) ||
					second.number.localeCompare(first.number),
			)
	);
}
