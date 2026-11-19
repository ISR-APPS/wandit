// The page of one ticket, as an inbox with its thread. The /app layout checks the session first.
// The loader fills the ticket query and the ticket list of the list pane. Thin: the page lives in the tickets feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	TicketDetailPage,
	TicketDetailPageSkeleton,
	TicketsPageError,
	ticketQueryOptions,
	ticketsQueryOptions,
} from "~/features/tickets";

/** /app/tickets/$ticketId. `params.ticketId` is any text from the URL; the query returns null for an unknown one. */
export const Route = createFileRoute("/app/tickets/$ticketId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(ticketQueryOptions(params.ticketId)),
			context.queryClient.query(ticketsQueryOptions()),
		]),
	pendingComponent: TicketDetailPageSkeleton,
	errorComponent: TicketsPageError,
	component: TicketDetailRoute,
});

function TicketDetailRoute() {
	const { ticketId } = Route.useParams();
	// No key: the list pane keeps its view, tab, and search while the user moves from ticket to ticket.
	return <TicketDetailPage ticketId={ticketId} />;
}
