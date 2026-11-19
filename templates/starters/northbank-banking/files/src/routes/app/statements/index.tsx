// The monthly statements behind login. The /app layout checks the session first.
// The loader fills the statement list. Thin: the page lives in the statements feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	StatementsPage,
	StatementsPageError,
	StatementsPageSkeleton,
	statementsQueryOptions,
} from "~/features/statements";

/** /app/statements: one tile per account and month. */
export const Route = createFileRoute("/app/statements/")({
	loader: ({ context }) => context.queryClient.query(statementsQueryOptions()),
	pendingComponent: StatementsPageSkeleton,
	errorComponent: StatementsPageError,
	component: StatementsPage,
});
