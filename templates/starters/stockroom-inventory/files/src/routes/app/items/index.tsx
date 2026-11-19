// The item list behind login. The /app layout checks the session first.
// The loader fills the list and its four figures. Thin: the page and its states live in the items feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ItemsPage,
	ItemsPageError,
	ItemsPageSkeleton,
	itemsQueryOptions,
	itemsSearchSchema,
	itemsSummaryQueryOptions,
} from "~/features/items";

/** /app/items: every stock item. `status`, `category`, and `supplier` in the URL filter the list. */
export const Route = createFileRoute("/app/items/")({
	validateSearch: itemsSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(itemsQueryOptions()),
			context.queryClient.query(itemsSummaryQueryOptions()),
		]),
	pendingComponent: ItemsPageSkeleton,
	errorComponent: ItemsPageError,
	component: ItemsPage,
});
