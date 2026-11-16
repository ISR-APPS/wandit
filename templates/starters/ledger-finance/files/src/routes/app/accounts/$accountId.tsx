// The detail page of one account. The /app layout checks the session first.
// The loader fills the account and the first period of its balance chart. Thin: the page lives in the accounts feature.
// A failed load shows the error state of the accounts page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	AccountDetailPage,
	AccountDetailPageSkeleton,
	AccountsPageError,
	accountBalanceQueryOptions,
	accountQueryOptions,
	DEFAULT_BALANCE_DAYS,
} from "~/features/accounts";

/** /app/accounts/$accountId. `params.accountId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/accounts/$accountId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(accountQueryOptions(params.accountId)),
			context.queryClient.query(
				accountBalanceQueryOptions(params.accountId, DEFAULT_BALANCE_DAYS),
			),
		]),
	pendingComponent: AccountDetailPageSkeleton,
	errorComponent: AccountsPageError,
	component: AccountDetailRoute,
});

function AccountDetailRoute() {
	const { accountId } = Route.useParams();
	return <AccountDetailPage accountId={accountId} />;
}
