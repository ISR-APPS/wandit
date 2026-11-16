// The page of one ticket with its conversation. The /app layout checks the session first.
// The loader fills the ticket query. Thin: the page lives in the tickets feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	TicketDetailPage,
	TicketDetailPageSkeleton,
	TicketsPageError,
	ticketQueryOptions,
} from "~/features/tickets";

/** /app/tickets/$ticketId. `params.ticketId` is any text from the URL; the query returns null for an unknown one. */
export const Route = createFileRoute("/app/tickets/$ticketId")({
	loader: ({ context, params }) =>
		context.queryClient.query(ticketQueryOptions(params.ticketId)),
	pendingComponent: TicketDetailPageSkeleton,
	errorComponent: TicketsPageError,
	component: TicketDetailRoute,
});

function TicketDetailRoute() {
	const { ticketId } = Route.useParams();
	// The key resets the page state when a related-ticket link opens another ticket.
	return <TicketDetailPage key={ticketId} ticketId={ticketId} />;
}
