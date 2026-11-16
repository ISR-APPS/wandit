// The home of the stockroom behind login. The /app layout checks the session first.
// The loader fills every query of the home. Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	itemsQueryOptions,
	latestStockChangesQueryOptions,
} from "~/features/items";
import {
	dailyPicksQueryOptions,
	LATEST_MOVEMENT_COUNT,
	OVERVIEW_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";
import { purchaseOrdersQueryOptions } from "~/features/purchase-orders";

/** /app: the overview of stock levels, picks, and deliveries. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailyPicksQueryOptions(OVERVIEW_DAYS)),
			context.queryClient.query(itemsQueryOptions()),
			context.queryClient.query(purchaseOrdersQueryOptions()),
			context.queryClient.query(
				latestStockChangesQueryOptions(LATEST_MOVEMENT_COUNT),
			),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
