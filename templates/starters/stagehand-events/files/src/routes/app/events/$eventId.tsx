// The page of one event. The /app layout checks the session first.
// The loader fills the event, its orders, and its sales pace. Thin: the page lives in the events feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	EventDetailPage,
	EventDetailPageSkeleton,
	EventsPageError,
	eventQueryOptions,
} from "~/features/events";

/** /app/events/$eventId. `params.eventId` is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/events/$eventId")({
	loader: ({ context, params }) =>
		context.queryClient.query(eventQueryOptions(params.eventId)),
	pendingComponent: EventDetailPageSkeleton,
	errorComponent: EventsPageError,
	component: EventDetailRoute,
});

function EventDetailRoute() {
	const { eventId } = Route.useParams();
	return <EventDetailPage eventId={eventId} />;
}
