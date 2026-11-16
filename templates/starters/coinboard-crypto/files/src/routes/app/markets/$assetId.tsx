// The page of one asset. The /app layout checks the session first.
// The loader fills the asset, its first price series, the position, and the transactions in parallel.
// Thin: the page lives in the markets feature. A failed load shows the error state of the Markets list.
import { createFileRoute } from "@tanstack/react-router";
import { assetTransactionsQueryOptions } from "~/features/activity";
import { assetPositionQueryOptions } from "~/features/holdings";
import { DEFAULT_DAYS } from "~/features/ledger";
import {
	AssetDetailPage,
	AssetDetailPageSkeleton,
	assetPricesQueryOptions,
	assetQueryOptions,
	MarketsPageError,
} from "~/features/markets";

/** /app/markets/$assetId. `params.assetId` is any text from the URL; the query answers null for an unknown id. */
export const Route = createFileRoute("/app/markets/$assetId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(assetQueryOptions(params.assetId)),
			context.queryClient.query(
				assetPricesQueryOptions(params.assetId, DEFAULT_DAYS),
			),
			context.queryClient.query(assetPositionQueryOptions(params.assetId)),
			context.queryClient.query(assetTransactionsQueryOptions(params.assetId)),
		]),
	pendingComponent: AssetDetailPageSkeleton,
	errorComponent: MarketsPageError,
	component: AssetDetailRoute,
});

function AssetDetailRoute() {
	const { assetId } = Route.useParams();
	// The key gives each asset its own page state, so the period control starts again at 30 days.
	return <AssetDetailPage key={assetId} assetId={assetId} />;
}
