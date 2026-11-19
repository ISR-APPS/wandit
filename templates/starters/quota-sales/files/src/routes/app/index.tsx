// The home of the area behind login. The /app layout checks the session first.
// The loader fills the summary of the default period, the order list, and the reps board.
// Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { ordersQueryOptions } from "~/features/orders";
import {
	DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
} from "~/features/overview";
import { repsQueryOptions } from "~/features/reps";

/** /app: the sales overview. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(ordersQueryOptions()),
			context.queryClient.query(repsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
