// The detail page of one transaction. The /app layout checks the session first.
// The loader fills the transaction with its timeline and its payee history. Thin: the page lives in the transactions feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	TransactionDetailPage,
	TransactionDetailPageSkeleton,
	TransactionsPageError,
	transactionQueryOptions,
} from "~/features/transactions";

/** /app/transactions/$transactionId. `params.transactionId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/transactions/$transactionId")({
	loader: ({ context, params }) =>
		context.queryClient.query(transactionQueryOptions(params.transactionId)),
	pendingComponent: TransactionDetailPageSkeleton,
	errorComponent: TransactionsPageError,
	component: TransactionDetailRoute,
});

function TransactionDetailRoute() {
	const { transactionId } = Route.useParams();
	return <TransactionDetailPage transactionId={transactionId} />;
}
