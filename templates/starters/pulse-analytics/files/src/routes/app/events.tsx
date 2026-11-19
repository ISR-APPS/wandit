// The event log behind login. The /app layout checks the session first.
// The loader fills the newest events of today and yesterday for every area.
// Thin: the page and its states live in the events feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	EventsPage,
	EventsPageError,
	EventsPageSkeleton,
	eventLogQueryOptions,
} from "~/features/events";

/** /app/events: the newest single events, by day, with an area filter. */
export const Route = createFileRoute("/app/events")({
	loader: ({ context }) =>
		context.queryClient.query(eventLogQueryOptions("all")),
	pendingComponent: EventsPageSkeleton,
	errorComponent: EventsPageError,
	component: EventsPage,
});
