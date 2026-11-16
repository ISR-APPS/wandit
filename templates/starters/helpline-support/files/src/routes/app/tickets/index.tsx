// The ticket list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the tickets feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	TicketsPage,
	TicketsPageError,
	TicketsPageSkeleton,
	ticketsQueryOptions,
	ticketsSearchSchema,
} from "~/features/tickets";

/** /app/tickets: every ticket of the desk. `?status=` opens the tab of one status. */
export const Route = createFileRoute("/app/tickets/")({
	validateSearch: ticketsSearchSchema,
	loader: ({ context }) => context.queryClient.query(ticketsQueryOptions()),
	pendingComponent: TicketsPageSkeleton,
	errorComponent: TicketsPageError,
	component: TicketsPage,
});
