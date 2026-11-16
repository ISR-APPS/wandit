// The list of every entry behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the transactions feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	TransactionsPage,
	TransactionsPageError,
	TransactionsPageSkeleton,
	transactionsQueryOptions,
} from "~/features/transactions";

/** /app/transactions: every entry of the three accounts. */
export const Route = createFileRoute("/app/transactions/")({
	loader: ({ context }) =>
		context.queryClient.query(transactionsQueryOptions()),
	pendingComponent: TransactionsPageSkeleton,
	errorComponent: TransactionsPageError,
	component: TransactionsPage,
});
