// The client list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page, the sheet, and their states live in the clients feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ClientsPage,
	ClientsPageError,
	ClientsPageSkeleton,
	clientsQueryOptions,
	clientsSearchSchema,
} from "~/features/clients";

/** /app/clients: every client of the firm. `?client=` opens the sheet of one client. */
export const Route = createFileRoute("/app/clients")({
	validateSearch: clientsSearchSchema,
	loader: ({ context }) => context.queryClient.query(clientsQueryOptions()),
	pendingComponent: ClientsPageSkeleton,
	errorComponent: ClientsPageError,
	component: ClientsPage,
});
