// The page of one stock item. The /app layout checks the session first.
// The loader fills the item. Thin: the page lives in the items feature.
// A failed load shows the error state of the list: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	ItemDetailPage,
	ItemDetailPageSkeleton,
	ItemsPageError,
	itemQueryOptions,
} from "~/features/items";

/** /app/items/$itemId. `params.itemId` is any text from the URL; the query answers null for an unknown id. */
export const Route = createFileRoute("/app/items/$itemId")({
	loader: ({ context, params }) =>
		context.queryClient.query(itemQueryOptions(params.itemId)),
	pendingComponent: ItemDetailPageSkeleton,
	errorComponent: ItemsPageError,
	component: ItemDetailRoute,
});

function ItemDetailRoute() {
	const { itemId } = Route.useParams();
	return <ItemDetailPage itemId={itemId} />;
}
