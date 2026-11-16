// The pure parts of the transaction detail page: the status steps and the place of an entry in its month.
// transactions.queries.ts calls them with the rows of the sample ledger. They read no clock.
import {
	type Budget,
	monthStartOf,
	type Transaction,
	type TransactionStatus,
} from "~/features/ledger";

/** One step of the life of an entry: recorded, cleared by the bank, checked against the statement. */
export type TimelineStep = {
	/** The status that the entry gets at this step. The label is the message key `transactions.steps.<status>`. */
	status: TransactionStatus;
	/** The day of the step, as `YYYY-MM-DD`. null when the step did not happen yet. */
	day: string | null;
};

/** The three steps of an entry, in the order of the work. The first step always has a day. */
export function buildTimeline(transaction: Transaction): TimelineStep[] {
	return [
		{ status: "pending", day: transaction.day },
		{ status: "cleared", day: transaction.clearedDay },
		{ status: "reconciled", day: transaction.reconciledDay },
	];
}

/** The place of one entry in the total of its category for its calendar month. */
export type CategoryMonth = {
	/** The first day of the month of the entry, as `YYYY-MM-DD`. */
	monthStart: string;
	/** The sum of the category in that month, in cents and positive. It includes the entry. */
	totalCents: number;
	/** Count of the entries of the category in that month. */
	entryCount: number;
	/** The monthly limit of the category, in cents. null when the category has no budget. */
	limitCents: number | null;
};

/**
 * Sums the category of `transaction` over its calendar month. `rows` is every entry of the ledger.
 * `historyStart` is the first day of `rows`, as `YYYY-MM-DD`.
 * null when the month starts before that day: the sum would miss the first days of the month.
 */
export function buildCategoryMonth(
	transaction: Transaction,
	rows: Transaction[],
	budgets: Budget[],
	historyStart: string,
): CategoryMonth | null {
	const monthStart = monthStartOf(transaction.day);
	// `YYYY-MM-DD` texts compare in date order.
	if (monthStart < historyStart) {
		return null;
	}
	const sameMonth = rows.filter(
		(row) =>
			row.categoryId === transaction.categoryId &&
			row.type === transaction.type &&
			monthStartOf(row.day) === monthStart,
	);
	return {
		monthStart,
		totalCents: sameMonth.reduce(
			(sum, row) => sum + Math.abs(row.amountCents),
			0,
		),
		entryCount: sameMonth.length,
		limitCents:
			budgets.find((budget) => budget.categoryId === transaction.categoryId)
				?.limitCents ?? null,
	};
}
