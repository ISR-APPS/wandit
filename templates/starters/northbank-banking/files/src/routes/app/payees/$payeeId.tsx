// The detail page of one payee. The /app layout checks the session first.
// Thin: the page lives in the payees feature. A failed load shows the error state of the list.
import { createFileRoute } from "@tanstack/react-router";
import {
	PayeeDetailPage,
	PayeeDetailPageSkeleton,
	PayeesPageError,
	payeeDetailQueryOptions,
} from "~/features/payees";

/** /app/payees/$payeeId. The id is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/payees/$payeeId")({
	loader: ({ context, params }) =>
		context.queryClient.query(payeeDetailQueryOptions(params.payeeId)),
	pendingComponent: PayeeDetailPageSkeleton,
	errorComponent: PayeesPageError,
	component: PayeeDetailRoute,
});

function PayeeDetailRoute() {
	const { payeeId } = Route.useParams();
	return <PayeeDetailPage payeeId={payeeId} />;
}
