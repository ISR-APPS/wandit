// The home behind login. The /app layout checks the session first.
// The loader fills the KPI rows, the cash flow of the first period, and the transaction list.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DEFAULT_DAYS,
	dailyCashFlowQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";
import { transactionsQueryOptions } from "~/features/transactions";

/** /app: the totals, the cash flow strip, and every transaction of the last 90 days. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailyCashFlowQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(transactionsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
