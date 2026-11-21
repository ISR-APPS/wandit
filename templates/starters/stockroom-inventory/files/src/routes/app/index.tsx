// The home of the stockroom behind login. The /app layout checks the session first.
// The loader fills the summary of the default period, the item list, and the order list. Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { itemsQueryOptions } from "~/features/items";
import {
	OVERVIEW_DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
} from "~/features/overview";
import { purchaseOrdersQueryOptions } from "~/features/purchase-orders";

/** /app: the stock overview of the period. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewQueryOptions(OVERVIEW_DEFAULT_DAYS)),
			context.queryClient.query(itemsQueryOptions()),
			context.queryClient.query(purchaseOrdersQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
