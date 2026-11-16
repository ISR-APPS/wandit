// The programme behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the events feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	EventsPage,
	EventsPageError,
	EventsPageSkeleton,
	eventsQueryOptions,
} from "~/features/events";

/** /app/events: every event, the ones to come first. */
export const Route = createFileRoute("/app/events/")({
	loader: ({ context }) => context.queryClient.query(eventsQueryOptions()),
	pendingComponent: EventsPageSkeleton,
	errorComponent: EventsPageError,
	component: EventsPage,
});
