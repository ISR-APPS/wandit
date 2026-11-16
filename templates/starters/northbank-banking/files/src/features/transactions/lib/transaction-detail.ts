// Builds the detail of one entry: the entry, the other half of a transfer, the history with the same party,
// and the steps of its status. transactionDetailQueryOptions calls it. It is pure: it reads only its inputs.
import { directionOf, postDayOf, type Transaction } from "~/features/bank";

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
	steps: StatusStep[];
};

// The detail page lists this many earlier entries. More would push the facts off the first screen.
const HISTORY_ROWS = 8;

// The first step: a card authorizes, an ACH is sent or received, a check is deposited, the rest books at once.
function firstStepOf(transaction: Transaction): StatusStepId {
	if (transaction.method === "card") {
		return "authorized";
	}
	if (transaction.method === "check") {
		return "deposited";
	}
	if (transaction.method === "ach") {
		return directionOf(transaction) === "in" ? "received" : "sent";
	}
	return "booked";
}

// The status steps, oldest first. An entry that books at once has one step.
function stepsOf(transaction: Transaction): StatusStep[] {
	const first: StatusStep = {
		id: firstStepOf(transaction),
		day: transaction.day,
		state: "done",
	};
	// postDayOf skips Saturday and Sunday. The entry status in the sample rows uses the same day.
	const lastDay = postDayOf(transaction.method, transaction.day);
	if (lastDay === transaction.day) {
		return [first];
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
		steps: stepsOf(transaction),
	};
}
