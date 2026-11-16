// The account list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the accounts feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	AccountsPage,
	AccountsPageError,
	AccountsPageSkeleton,
	accountsQueryOptions,
} from "~/features/accounts";

/** /app/accounts: every customer account with its use of the last 30 days. */
export const Route = createFileRoute("/app/accounts/")({
	loader: ({ context }) => context.queryClient.query(accountsQueryOptions()),
	pendingComponent: AccountsPageSkeleton,
	errorComponent: AccountsPageError,
	component: AccountsPage,
});
