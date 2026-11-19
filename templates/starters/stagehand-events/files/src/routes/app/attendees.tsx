// The attendees page behind login. The /app layout checks the session first.
// The loader fills the guest rows of every event. Thin: the page and its states live in the attendees feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	AttendeesPage,
	AttendeesPageError,
	AttendeesPageSkeleton,
	guestsQueryOptions,
} from "~/features/attendees";

// `event` is an event id ("evt-1025"), `order` an order id. An unknown id falls back: no event filter, no panel.
const attendeesSearchSchema = z.object({
	event: z.string().max(40).optional().catch(undefined),
	order: z.string().max(40).optional().catch(undefined),
});

/** /app/attendees. `?event=` filters the table to one event; `?order=` opens the panel of one order. */
export const Route = createFileRoute("/app/attendees")({
	validateSearch: attendeesSearchSchema,
	loader: ({ context }) => context.queryClient.query(guestsQueryOptions()),
	pendingComponent: AttendeesPageSkeleton,
	errorComponent: AttendeesPageError,
	component: AttendeesRoute,
});

function AttendeesRoute() {
	const { event, order } = Route.useSearch();
	return <AttendeesPage eventId={event} openOrderId={order} />;
}
