// The list of every entry behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the transactions feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	TransactionsPage,
	TransactionsPageError,
	TransactionsPageSkeleton,
	transactionsQueryOptions,
	transactionsSearchSchema,
} from "~/features/transactions";

/** /app/transactions: the entries of the three accounts. `?tab=upcoming` opens the pending entries. */
export const Route = createFileRoute("/app/transactions/")({
	validateSearch: transactionsSearchSchema,
	loader: ({ context }) =>
		context.queryClient.query(transactionsQueryOptions()),
	pendingComponent: TransactionsPageSkeleton,
	errorComponent: TransactionsPageError,
	component: TransactionsRoute,
});

function TransactionsRoute() {
	const { tab } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<TransactionsPage
			tab={tab ?? "latest"}
			onTabChange={(next) =>
				navigate({ search: { tab: next === "latest" ? undefined : next } })
			}
		/>
	);
}
