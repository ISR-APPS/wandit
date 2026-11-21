// The page of one account. The /app layout checks the session first.
// The loader fills the account with its people, events, and timeline. Thin: the page lives in the accounts feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	AccountDetailPage,
	AccountDetailPageSkeleton,
	AccountsPageError,
	accountQueryOptions,
} from "~/features/accounts";

/** /app/accounts/$accountId. `params.accountId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/accounts/$accountId")({
	loader: ({ context, params }) =>
		context.queryClient.query(accountQueryOptions(params.accountId)),
	pendingComponent: AccountDetailPageSkeleton,
	errorComponent: AccountsPageError,
	component: AccountDetailRoute,
});

function AccountDetailRoute() {
	const { accountId } = Route.useParams();
	return <AccountDetailPage accountId={accountId} />;
}
