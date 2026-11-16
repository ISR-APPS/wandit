// The Holdings list behind login. The /app layout checks the session first.
// The loader fills the position cache. Thin: the page and its states live in the holdings feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	HoldingsPage,
	HoldingsPageError,
	HoldingsPageSkeleton,
	positionsQueryOptions,
} from "~/features/holdings";

/** /app/holdings: every position of the user, with its cost and its profit. */
export const Route = createFileRoute("/app/holdings")({
	loader: ({ context }) => context.queryClient.query(positionsQueryOptions()),
	pendingComponent: HoldingsPageSkeleton,
	errorComponent: HoldingsPageError,
	component: HoldingsPage,
});
