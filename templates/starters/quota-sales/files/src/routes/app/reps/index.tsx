// The reps list behind login. The /app layout checks the session first.
// The loader fills the board cache. Thin: the page and its states live in the reps feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	RepsPage,
	RepsPageError,
	RepsPageSkeleton,
	repsQueryOptions,
} from "~/features/reps";

/** /app/reps: every rep against the target of the current quarter. */
export const Route = createFileRoute("/app/reps/")({
	loader: ({ context }) => context.queryClient.query(repsQueryOptions()),
	pendingComponent: RepsPageSkeleton,
	errorComponent: RepsPageError,
	component: RepsPage,
});
