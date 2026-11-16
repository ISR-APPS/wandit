// Reads of accounts: the list with the position of the business, one account with its entries, and its balance series.
// The list and detail routes prefetch them in their loaders. The pages read them from the cache.
// Each queryFn returns sample rows of ~/features/ledger. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type DailyBalance,
	listAccounts,
	listDailyBalances,
	listTransactions,
	type PeriodDays,
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
	/** Every entry of the account in the last 90 days, newest first. */
	transactions: TransactionRow[];
	/** The largest expense categories of the account in the last 30 days. */
	topCategories: CategorySpend[];
};

function readAccountSummaries(now: number): AccountSummary[] {
	const rows = listTransactions(now);
	const balances = listDailyBalances(now);
	return listAccounts().map((account) =>
		buildAccountSummary(account, rows, balances[account.id], toIsoDay(now)),
	);
}

/** Every account with its balance, its 30-day flow, and its 90-day balance series. */
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

/** One account with its entries and its top categories. null when the id does not exist. */
export function accountQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["accounts", "detail", id],
		queryFn: async (): Promise<AccountDetail | null> => {
			const now = Date.now();
			// The id comes from the URL. An unknown id is "not found", not an error.
			const account = readAccountSummaries(now).find(
				(candidate) => candidate.id === id,
			);
			if (!account) {
				return null;
			}
			const rows = listTransactions(now);
			return {
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

/**
 * The balance of one account for the balance chart, oldest first: `days` + 1 points.
 * The first point is the day before the period, so the last point minus the first one is the flow of the period.
 */
export function accountBalanceQueryOptions(id: string, days: PeriodDays) {
	return queryOptions({
		queryKey: ["accounts", "balance", id, days],
		queryFn: async (): Promise<DailyBalance[]> => {
			const account = listAccounts().find((candidate) => candidate.id === id);
			return account
				? listDailyBalances(Date.now())[account.id].slice(-(days + 1))
				: [];
		},
	});
}
