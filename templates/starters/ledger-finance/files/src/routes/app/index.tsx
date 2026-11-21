// The home behind login. The /app layout checks the session first.
// The loader fills the summary of the first period, the monthly expenses, the transactions, the budget, and the accounts.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { accountsQueryOptions } from "~/features/accounts";
import { budgetReportQueryOptions } from "~/features/budgets";
import {
	DEFAULT_DAYS,
	monthlyExpensesQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
} from "~/features/overview";
import { transactionsQueryOptions } from "~/features/transactions";

/** /app: the KPIs, the income, expenses, and spending cards, the newest entries, the budget, and the accounts. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(monthlyExpensesQueryOptions()),
			context.queryClient.query(transactionsQueryOptions()),
			context.queryClient.query(budgetReportQueryOptions("current")),
			context.queryClient.query(accountsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
