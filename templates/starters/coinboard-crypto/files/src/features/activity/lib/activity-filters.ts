// The period filter of the Activity page: every transaction, or the transactions of the last 7, 30, or 90 days.
// ActivityPage filters its rows with it before the Latest and Pending tabs split them.
import {
	DAY_MS,
	PERIOD_DAYS,
	type PeriodDays,
	startOfLocalDay,
} from "~/features/ledger";
import type { Transaction } from "../api/transactions.queries";

/** The period choices of the page: every transaction, or the last 7, 30, or 90 days. */
export type ActivityPeriod = PeriodDays | "all";

/** Reads a period from the value of the Select. An unknown text gives "all". */
export function parseActivityPeriod(value: string): ActivityPeriod {
	return PERIOD_DAYS.find((days) => String(days) === value) ?? "all";
}

/** The transactions of the last `period` full days, plus today. `now` is in milliseconds since 1970. */
export function filterByPeriod(
	transactions: Transaction[],
	period: ActivityPeriod,
	now: number,
): Transaction[] {
	if (period === "all") {
		return transactions;
	}
	const start = startOfLocalDay(now) - period * DAY_MS;
	return transactions.filter((row) => Date.parse(row.occurredAt) >= start);
}
