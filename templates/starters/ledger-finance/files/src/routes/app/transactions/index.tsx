// The transaction list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the transactions feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	TransactionsPage,
	TransactionsPageError,
	TransactionsPageSkeleton,
	transactionsQueryOptions,
	transactionsSearchSchema,
} from "~/features/transactions";

/** /app/transactions. `?type=expense&category=software` filters the list. */
export const Route = createFileRoute("/app/transactions/")({
	validateSearch: transactionsSearchSchema,
	loader: ({ context }) =>
		context.queryClient.query(transactionsQueryOptions()),
	pendingComponent: TransactionsPageSkeleton,
	errorComponent: TransactionsPageError,
	component: TransactionsRoute,
});

function TransactionsRoute() {
	const search = Route.useSearch();
	return <TransactionsPage search={search} />;
}
