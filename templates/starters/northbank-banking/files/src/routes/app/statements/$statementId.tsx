// The page of one monthly statement. The /app layout checks the session first.
// The loader fills the statement detail and the list. Thin: the page lives in the statements feature.
import { createFileRoute } from "@tanstack/react-router";
import { DetailPageSkeleton } from "~/features/bank";
import {
	StatementDetailPage,
	StatementsPageError,
	statementDetailQueryOptions,
	statementsQueryOptions,
} from "~/features/statements";

/** /app/statements/$statementId. The id is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/statements/$statementId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(
				statementDetailQueryOptions(params.statementId),
			),
			context.queryClient.query(statementsQueryOptions()),
		]),
	pendingComponent: DetailPageSkeleton,
	errorComponent: StatementsPageError,
	component: StatementDetailRoute,
});

function StatementDetailRoute() {
	const { statementId } = Route.useParams();
	return <StatementDetailPage statementId={statementId} />;
}
