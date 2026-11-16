// The period filter of the Activity page and the totals of the shown transactions.
// ActivityPage filters its rows with them. ActivitySummary shows the totals.
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

/** The money totals of a list of transactions, in the app currency. */
export type ActivityTotals = {
	bought: number;
	sold: number;
	/** The market value of the staking rewards when they arrived. */
	rewards: number;
	fees: number;
};

/** Sums the confirmed rows only. A pending or a failed transaction moved no money yet. */
export function sumActivity(transactions: Transaction[]): ActivityTotals {
	const totals = { bought: 0, sold: 0, rewards: 0, fees: 0 };
	for (const row of transactions) {
		if (row.status !== "confirmed") {
			continue;
		}
		totals.fees += row.fee;
		if (row.type === "buy") {
			totals.bought += row.amount;
		} else if (row.type === "sell") {
			totals.sold += row.amount;
		} else if (row.type === "reward") {
			totals.rewards += row.amount;
		}
	}
	return totals;
}
