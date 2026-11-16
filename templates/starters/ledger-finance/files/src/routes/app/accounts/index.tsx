// The accounts page behind login. The /app layout checks the session first.
// The loader fills the account list. Thin: the page and its states live in the accounts feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	AccountsPage,
	AccountsPageError,
	AccountsPageSkeleton,
	accountsQueryOptions,
} from "~/features/accounts";

/** /app/accounts: the position of the business and one row per account. */
export const Route = createFileRoute("/app/accounts/")({
	loader: ({ context }) => context.queryClient.query(accountsQueryOptions()),
	pendingComponent: AccountsPageSkeleton,
	errorComponent: AccountsPageError,
	component: AccountsPage,
});
