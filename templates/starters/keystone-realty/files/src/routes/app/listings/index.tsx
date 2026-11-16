// The listings page behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the listings feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ListingsPage,
	ListingsPageError,
	ListingsPageSkeleton,
	listingsQueryOptions,
} from "~/features/listings";

/** /app/listings: every home that the agency sells. */
export const Route = createFileRoute("/app/listings/")({
	loader: ({ context }) => context.queryClient.query(listingsQueryOptions()),
	pendingComponent: ListingsPageSkeleton,
	errorComponent: ListingsPageError,
	component: ListingsPage,
});
