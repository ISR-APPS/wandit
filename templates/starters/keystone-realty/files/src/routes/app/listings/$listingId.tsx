// The detail page of one listing. The /app layout checks the session first.
// The loader fills the listing with its leads, its viewings, and its history. Thin: the page lives in the listings feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	ListingDetailPage,
	ListingDetailPageSkeleton,
	ListingsPageError,
	listingQueryOptions,
} from "~/features/listings";

/** /app/listings/$listingId. `params.listingId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/listings/$listingId")({
	loader: ({ context, params }) =>
		context.queryClient.query(listingQueryOptions(params.listingId)),
	pendingComponent: ListingDetailPageSkeleton,
	errorComponent: ListingsPageError,
	component: ListingDetailRoute,
});

function ListingDetailRoute() {
	const { listingId } = Route.useParams();
	return <ListingDetailPage listingId={listingId} />;
}
