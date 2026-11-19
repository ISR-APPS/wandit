// Builds the detail of one entry: the entry, the other half of a transfer, the history with the same party,
// the other entries of the same day, and the steps of its status. transactionDetailQueryOptions calls it. It is pure: it reads only its inputs.
import { postDayOf, type Transaction } from "~/features/bank";

/** The steps of an entry. Its label is the message key `transactionDetail.steps.<id>`. */
export type StatusStepId =
	| "authorized"
	| "sent"
	| "received"
	| "deposited"
	| "booked"
	| "posted"
	| "returned";

/** One step of the status timeline. */
export type StatusStep = {
	id: StatusStepId;
	/** The day of the step, `YYYY-MM-DD`. For an upcoming step, the expected day. */
	day: string;
	/** "upcoming" has not happened yet. "failed" ends the entry with no effect on the balance. */
	state: "done" | "upcoming" | "failed";
};

/** Everything the detail page shows about one entry. */
export type TransactionDetail = {
	transaction: Transaction;
	/** The other half of a transfer, or null. */
	linked: Transaction | null;
	/** Up to HISTORY_ROWS other entries with the same party, newest first. */
	history: Transaction[];
	/** The count of all other entries with the same party, also the ones the list leaves out. */
	historyCount: number;
	/** Up to SAME_DAY_ROWS other entries of the same account on the same day, in the order of the list. */
	sameDay: Transaction[];
	steps: StatusStep[];
};

// The history card lists this many earlier entries, as the history table of the kit profile page.
const HISTORY_ROWS = 6;

// The same-day card lists this many entries, so it keeps the height of the history card beside it.
const SAME_DAY_ROWS = 5;

// The first step: a card authorizes, a check is deposited, a payment or a transfer is sent or received.
// Interest and a fee have no sender, so they book at once.
function firstStepOf(transaction: Transaction): StatusStepId {
	if (transaction.method === "card") {
		return "authorized";
	}
	if (transaction.method === "check") {
		return "deposited";
	}
	if (transaction.method === "interest" || transaction.method === "fee") {
		return "booked";
	}
	// A transfer has no "in" direction, so the sign of the amount tells the side.
	return transaction.amountCents > 0 ? "received" : "sent";
}

// The status steps, oldest first. Only interest and a fee have one step.
function stepsOf(transaction: Transaction): StatusStep[] {
	const first: StatusStep = {
		id: firstStepOf(transaction),
		day: transaction.day,
		state: "done",
	};
	// postDayOf skips Saturday and Sunday. The entry status in the sample rows uses the same day.
	const lastDay = postDayOf(transaction.method, transaction.day);
	if (lastDay === transaction.day) {
		// A wire or a transfer books on the day it arrives: the second step has the same day.
		return first.id === "booked"
			? [first]
			: [first, { id: "booked", day: lastDay, state: "done" }];
	}
	if (transaction.status === "returned") {
		return [first, { id: "returned", day: lastDay, state: "failed" }];
	}
	return [
		first,
		{
			id: "posted",
			day: lastDay,
			state: transaction.status === "posted" ? "done" : "upcoming",
		},
	];
}

/** The detail of the entry `id`, or null when no entry has that id. `rows` is every entry, newest first. */
export function buildTransactionDetail(
	rows: Transaction[],
	id: string,
): TransactionDetail | null {
	const transaction = rows.find((row) => row.id === id);
	if (!transaction) {
		return null;
	}
	const sameParty = rows.filter(
		(row) =>
			row.id !== id &&
			row.counterparty === transaction.counterparty &&
			row.accountId === transaction.accountId,
	);
	return {
		transaction,
		linked: rows.find((row) => row.id === transaction.linkedId) ?? null,
		history: sameParty.slice(0, HISTORY_ROWS),
		historyCount: sameParty.length,
		sameDay: rows
			.filter(
				(row) =>
					row.id !== id &&
					row.day === transaction.day &&
					row.accountId === transaction.accountId,
			)
			.slice(0, SAME_DAY_ROWS),
		steps: stepsOf(transaction),
	};
}
