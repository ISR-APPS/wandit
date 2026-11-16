// The item list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the items feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ItemsPage,
	ItemsPageError,
	ItemsPageSkeleton,
	itemsQueryOptions,
	itemsSearchSchema,
} from "~/features/items";

/** /app/items: every stock item. `status` and `category` in the URL filter the list. */
export const Route = createFileRoute("/app/items/")({
	validateSearch: itemsSearchSchema,
	loader: ({ context }) => context.queryClient.query(itemsQueryOptions()),
	pendingComponent: ItemsPageSkeleton,
	errorComponent: ItemsPageError,
	component: ItemsPage,
});
