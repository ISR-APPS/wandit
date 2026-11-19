// Reads of accounts: the list with the position of the business, and one account with its entries.
// The list and detail routes prefetch them in their loaders. The pages read them from the cache.
// Each queryFn returns sample rows of ~/features/ledger. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	listAccounts,
	listDailyBalances,
	listTransactions,
	toIsoDay,
} from "~/features/ledger";
import {
	type TransactionRow,
	toTransactionRows,
} from "~/features/transactions";
import {
	type AccountSummary,
	buildAccountSummary,
	buildPosition,
	buildTopCategories,
	type CategorySpend,
	type Position,
} from "../lib/account-summary";

/** What the accounts page shows: every account and the position of the business. */
export type AccountsOverview = {
	accounts: AccountSummary[];
	position: Position;
	/** The day of the balances, as `YYYY-MM-DD`. */
	today: string;
};

/** What the detail page of one account shows. */
export type AccountDetail = {
	account: AccountSummary;
	/** Every entry of the account in the history, newest first. */
	transactions: TransactionRow[];
	/** The largest expense categories of the account in the last 30 days. */
	topCategories: CategorySpend[];
	/** Every other account, the main account first. */
	otherAccounts: AccountSummary[];
	/** The sum of every account that is not a card, in cents. The share of cash of a bank account divides by it. */
	cashOnHandCents: number;
};

function readAccountSummaries(now: number): AccountSummary[] {
	const rows = listTransactions(now);
	const balances = listDailyBalances(now);
	return listAccounts().map((account) =>
		buildAccountSummary(account, rows, balances[account.id], toIsoDay(now)),
	);
}

/** Every account with its balance, its 30-day flow, and its daily balance series. */
export function accountsQueryOptions() {
	return queryOptions({
		queryKey: ["accounts", "list"],
		queryFn: async (): Promise<AccountsOverview> => {
			const now = Date.now();
			const accounts = readAccountSummaries(now);
			const today = toIsoDay(now);
			return {
				accounts,
				position: buildPosition(accounts, today),
				today,
			};
		},
	});
}

/** One account with its entries, its top categories, and the other accounts. null when the id does not exist. */
export function accountQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["accounts", "detail", id],
		queryFn: async (): Promise<AccountDetail | null> => {
			const now = Date.now();
			const summaries = readAccountSummaries(now);
			// The id comes from the URL. An unknown id is "not found", not an error.
			const account = summaries.find((candidate) => candidate.id === id);
			if (!account) {
				return null;
			}
			const rows = listTransactions(now);
			return {
				otherAccounts: summaries.filter((candidate) => candidate.id !== id),
				cashOnHandCents: buildPosition(summaries, toIsoDay(now))
					.cashOnHandCents,
				account,
				transactions: toTransactionRows(
					rows.filter((row) => row.accountId === account.id),
					listAccounts(),
				),
				topCategories: buildTopCategories(account.id, rows, toIsoDay(now)),
			};
		},
	});
}
