// The detail page of one payee. The /app layout checks the session first.
// The loader fills the payee detail and the payee list. Thin: the page lives in the payees feature.
import { createFileRoute } from "@tanstack/react-router";
import { DetailPageSkeleton } from "~/features/bank";
import {
	PayeeDetailPage,
	PayeesPageError,
	payeeDetailQueryOptions,
	payeesQueryOptions,
} from "~/features/payees";

/** /app/payees/$payeeId. The id is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/payees/$payeeId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(payeeDetailQueryOptions(params.payeeId)),
			context.queryClient.query(payeesQueryOptions()),
		]),
	pendingComponent: DetailPageSkeleton,
	errorComponent: PayeesPageError,
	component: PayeeDetailRoute,
});

function PayeeDetailRoute() {
	const { payeeId } = Route.useParams();
	return <PayeeDetailPage payeeId={payeeId} />;
}
