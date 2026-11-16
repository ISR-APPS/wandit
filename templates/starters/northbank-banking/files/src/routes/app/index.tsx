// The home behind login. The /app layout checks the session first.
// The loader fills the totals, the strip of the first period, and the entry list. Thin: the page lives in overview.
import { createFileRoute } from "@tanstack/react-router";
import {
	DEFAULT_DAYS,
	dailyBalanceQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";
import { transactionsQueryOptions } from "~/features/transactions";

/** /app: the totals, the balance strip, and every entry of the three accounts. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailyBalanceQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(transactionsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
