// The Holdings list behind login. The /app layout checks the session first.
// The loader fills the position and the transaction caches. Thin: the page and its states live in the holdings feature.
import { createFileRoute } from "@tanstack/react-router";
import { transactionsQueryOptions } from "~/features/activity";
import {
	HoldingsPage,
	HoldingsPageError,
	HoldingsPageSkeleton,
	positionsQueryOptions,
} from "~/features/holdings";

/** /app/holdings: every position of the user, with KPI cards of its value, profit, rewards, and fees. */
export const Route = createFileRoute("/app/holdings")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(positionsQueryOptions()),
			context.queryClient.query(transactionsQueryOptions()),
		]),
	pendingComponent: HoldingsPageSkeleton,
	errorComponent: HoldingsPageError,
	component: HoldingsPage,
});
