// The page of one monthly statement. The /app layout checks the session first.
// Thin: the page lives in the statements feature. A failed load shows the error state of the list.
import { createFileRoute } from "@tanstack/react-router";
import {
	StatementDetailPage,
	StatementDetailPageSkeleton,
	StatementsPageError,
	statementDetailQueryOptions,
} from "~/features/statements";

/** /app/statements/$statementId. The id is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/statements/$statementId")({
	loader: ({ context, params }) =>
		context.queryClient.query(statementDetailQueryOptions(params.statementId)),
	pendingComponent: StatementDetailPageSkeleton,
	errorComponent: StatementsPageError,
	component: StatementDetailRoute,
});

function StatementDetailRoute() {
	const { statementId } = Route.useParams();
	return <StatementDetailPage statementId={statementId} />;
}
