// The targets page behind login. The /app layout checks the session first.
// The loader fills both quarters, so the quarter tabs switch at once. Thin: the page lives in the targets feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	quarterTargetsQueryOptions,
	TargetsPage,
	TargetsPageError,
	TargetsPageSkeleton,
} from "~/features/targets";

/** /app/targets: the team, territory, and month targets of the current and the previous quarter. */
export const Route = createFileRoute("/app/targets")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(quarterTargetsQueryOptions("current")),
			context.queryClient.query(quarterTargetsQueryOptions("previous")),
		]),
	pendingComponent: TargetsPageSkeleton,
	errorComponent: TargetsPageError,
	component: TargetsPage,
});
