// The detail page of one entry. The /app layout checks the session first.
// Thin: the page lives in the transactions feature. A failed load shows the error state of the list.
import { createFileRoute } from "@tanstack/react-router";
import { DetailPageSkeleton } from "~/features/bank";
import {
	TransactionDetailPage,
	TransactionsPageError,
	transactionDetailQueryOptions,
} from "~/features/transactions";

/** /app/transactions/$transactionId. The id is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/transactions/$transactionId")({
	loader: ({ context, params }) =>
		context.queryClient.query(
			transactionDetailQueryOptions(params.transactionId),
		),
	pendingComponent: DetailPageSkeleton,
	errorComponent: TransactionsPageError,
	component: TransactionDetailRoute,
});

function TransactionDetailRoute() {
	const { transactionId } = Route.useParams();
	return <TransactionDetailPage transactionId={transactionId} />;
}
