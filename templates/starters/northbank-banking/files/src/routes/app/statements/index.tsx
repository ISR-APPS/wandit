// The monthly statements behind login. The /app layout checks the session first.
// The loader fills the account panels and the statement list. Thin: the page lives in the statements feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	accountSummariesQueryOptions,
	StatementsPage,
	StatementsPageError,
	StatementsPageSkeleton,
	statementsQueryOptions,
} from "~/features/statements";

/** /app/statements: the three accounts and every monthly statement. */
export const Route = createFileRoute("/app/statements/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(accountSummariesQueryOptions()),
			context.queryClient.query(statementsQueryOptions()),
		]),
	pendingComponent: StatementsPageSkeleton,
	errorComponent: StatementsPageError,
	component: StatementsPage,
});
