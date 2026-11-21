// Reads of transactions: the list, the scheduled entries of the next days, and one transaction with its detail page.
// The list and detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn returns sample rows of ~/features/ledger. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type Account,
	addDays,
	daysBetween,
	HISTORY_DAYS,
	listAccounts,
	listBudgets,
	listScheduledEntries,
	listTransactions,
	type ScheduledEntry,
	type Transaction,
	toIsoDay,
} from "~/features/ledger";
import {
	buildCategoryMonth,
	buildTimeline,
	type CategoryMonth,
	type TimelineStep,
} from "../lib/transaction-detail";

/** One transaction with the name of its account: a row of `transactions` joined to `accounts`. */
export type TransactionRow = Transaction & {
	/** The name of the account of `accountId`. */
	accountName: string;
};

/** Everything that the detail page shows for one transaction. */
export type TransactionDetail = {
	transaction: TransactionRow;
	account: Account;
	/** The other half of a transfer. null for income and expenses. */
	linked: TransactionRow | null;
	/** Every other entry with the same payee, newest first. For a transfer: the earlier moves between the same two accounts. */
	payeeHistory: TransactionRow[];
	/** The other entries closest in days: the same day first, then the nearest days. At most 5. */
	nearby: TransactionRow[];
	timeline: TimelineStep[];
	/** The total of the category in the month of the entry. null for a transfer, or for a month that the history only partly covers. */
	categoryMonth: CategoryMonth | null;
};

// The nearby list shows at most this many rows: the density of the kit connections card.
const NEARBY_LIMIT = 5;

/** Adds the account name to each row. Other features join their own row lists with it. */
export function toTransactionRows(
	rows: Transaction[],
	accounts: Account[],
): TransactionRow[] {
	const nameById = new Map(
		accounts.map((account) => [account.id, account.name]),
	);
	return rows.map((row) => ({
		...row,
		accountName: nameById.get(row.accountId) ?? "",
	}));
}

/** Every transaction of the history, newest first. The pages filter and page them in the browser. */
export function transactionsQueryOptions() {
	return queryOptions({
		queryKey: ["transactions", "list"],
		queryFn: async () =>
			toTransactionRows(listTransactions(Date.now()), listAccounts()),
	});
}

/** The days of the "Upcoming" tab of the transactions page. */
export const SCHEDULED_DAYS = 30;

/** The fixed bills and receipts of the next 30 days, the soonest first. */
export function scheduledQueryOptions() {
	return queryOptions({
		queryKey: ["transactions", "scheduled"],
		queryFn: async (): Promise<ScheduledEntry[]> =>
			listScheduledEntries(Date.now(), SCHEDULED_DAYS),
	});
}

/** One transaction with its account, its timeline, its payee history, and its day. null when the id does not exist. */
export function transactionQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["transactions", "detail", id],
		queryFn: async (): Promise<TransactionDetail | null> => {
			const now = Date.now();
			const accounts = listAccounts();
			const rows = toTransactionRows(listTransactions(now), accounts);
			// The id comes from the URL. An unknown id is "not found", not an error.
			const transaction = rows.find((row) => row.id === id);
			const account = accounts.find(
				(candidate) => candidate.id === transaction?.accountId,
			);
			if (!transaction || !account) {
				return null;
			}
			return {
				transaction,
				account,
				linked: rows.find((row) => row.id === transaction.linkedId) ?? null,
				// For a transfer: the same half of the same move in other months.
				payeeHistory: rows.filter(
					(row) =>
						row.payee === transaction.payee &&
						row.id !== transaction.id &&
						(transaction.type === "transfer"
							? row.type === "transfer" &&
								row.accountId === transaction.accountId
							: row.type !== "transfer"),
				),
				// The kit card always shows a full list. A day with few entries fills from the nearest days.
				// The sort is stable, so a tie keeps the ledger order, the newest first.
				nearby: rows
					.filter((row) => row.id !== transaction.id)
					.sort(
						(first, second) =>
							Math.abs(daysBetween(transaction.day, first.day)) -
							Math.abs(daysBetween(transaction.day, second.day)),
					)
					.slice(0, NEARBY_LIMIT),
				timeline: buildTimeline(transaction),
				categoryMonth:
					transaction.type === "transfer"
						? null
						: buildCategoryMonth(
								transaction,
								rows,
								listBudgets(),
								addDays(toIsoDay(now), 1 - HISTORY_DAYS),
							),
			};
		},
	});
}
