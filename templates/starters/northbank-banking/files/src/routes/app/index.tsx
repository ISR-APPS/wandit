// The home behind login. The /app layout checks the session first.
// The loader fills the figures of the default period, the entries, the cards, and the cash flow. Thin: the page lives in overview.
import { createFileRoute } from "@tanstack/react-router";
import { cardsQueryOptions } from "~/features/cards";
import {
	cashFlowQueryOptions,
	DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewSummaryQueryOptions,
} from "~/features/overview";
import { transactionsQueryOptions } from "~/features/transactions";

/** /app: the KPI tiles, the card limits, the cash flow, the spending, and the newest entries. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewSummaryQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(transactionsQueryOptions()),
			context.queryClient.query(cardsQueryOptions()),
			context.queryClient.query(cashFlowQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
