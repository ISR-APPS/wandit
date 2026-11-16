// The guest list behind login. The /app layout checks the session first.
// The loader reads the events of the picker, resolves the event of the URL, then fills its guest list.
// Thin: the page and its states live in the attendees feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	AttendeesPage,
	AttendeesPageError,
	AttendeesPageSkeleton,
	guestListEventsQueryOptions,
	guestListQueryOptions,
	resolveGuestListEventId,
} from "~/features/attendees";

// `event` is an event id ("evt-1025"), `order` an order id. An unknown id falls back: the default event, no panel.
const attendeesSearchSchema = z.object({
	event: z.string().max(40).optional().catch(undefined),
	order: z.string().max(40).optional().catch(undefined),
});

/** /app/attendees. With no `event`, the list shows the live event, else the next one. */
export const Route = createFileRoute("/app/attendees")({
	validateSearch: attendeesSearchSchema,
	loaderDeps: ({ search }) => ({ event: search.event }),
	loader: async ({ context, deps }) => {
		const events = await context.queryClient.query(
			guestListEventsQueryOptions(),
		);
		const eventId = resolveGuestListEventId(deps.event, events);
		if (eventId) {
			await context.queryClient.query(guestListQueryOptions(eventId));
		}
		return { eventId };
	},
	pendingComponent: AttendeesPageSkeleton,
	errorComponent: AttendeesPageError,
	component: AttendeesRoute,
});

function AttendeesRoute() {
	const { eventId } = Route.useLoaderData();
	const { order } = Route.useSearch();
	return <AttendeesPage eventId={eventId} openOrderId={order} />;
}
