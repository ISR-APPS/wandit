// The Events page behind login. The /app layout checks the session first.
// The loader fills the catalog of the first period, the detail of the first event, and the stream.
// Thin: the page and its states live in the events feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DEFAULT_EVENT,
	EventsPage,
	EventsPageError,
	EventsPageSkeleton,
	eventCatalogQueryOptions,
	eventDetailQueryOptions,
	eventStreamQueryOptions,
} from "~/features/events";
import { DEFAULT_DAYS } from "~/features/tracking";

/** /app/events: every tracked event, one event in depth, and the newest single events. */
export const Route = createFileRoute("/app/events")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(eventCatalogQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(
				eventDetailQueryOptions(DEFAULT_EVENT, DEFAULT_DAYS),
			),
			context.queryClient.query(eventStreamQueryOptions()),
		]),
	pendingComponent: EventsPageSkeleton,
	errorComponent: EventsPageError,
	component: EventsPage,
});
