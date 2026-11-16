// The page of one stock item. The /app layout checks the session first.
// The loader fills the item and the first period of its chart. Thin: the page lives in the items feature.
// A failed load shows the error state of the list: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	ITEM_DEFAULT_DAYS,
	ItemDetailPage,
	ItemDetailPageSkeleton,
	ItemsPageError,
	itemDailyPicksQueryOptions,
	itemQueryOptions,
} from "~/features/items";

/** /app/items/$itemId. `params.itemId` is any text from the URL; the query answers null for an unknown id. */
export const Route = createFileRoute("/app/items/$itemId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(itemQueryOptions(params.itemId)),
			context.queryClient.query(
				itemDailyPicksQueryOptions(params.itemId, ITEM_DEFAULT_DAYS),
			),
		]),
	pendingComponent: ItemDetailPageSkeleton,
	errorComponent: ItemsPageError,
	component: ItemDetailRoute,
});

function ItemDetailRoute() {
	const { itemId } = Route.useParams();
	return <ItemDetailPage itemId={itemId} />;
}
