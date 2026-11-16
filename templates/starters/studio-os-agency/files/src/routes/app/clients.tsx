// The client list behind login. The /app layout checks the session first.
// The loader fills the clients, the projects, and the invoices, so the client sheet opens with no spinner.
// Thin: the page and its states live in the clients feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ClientsPage,
	ClientsPageError,
	ClientsPageSkeleton,
	clientsQueryOptions,
} from "~/features/clients";
import { invoicesQueryOptions } from "~/features/invoices";
import { projectsQueryOptions } from "~/features/projects";

/** /app/clients: every client of the studio, with its relation and its money. */
export const Route = createFileRoute("/app/clients")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(clientsQueryOptions()),
			context.queryClient.query(projectsQueryOptions()),
			context.queryClient.query(invoicesQueryOptions()),
		]),
	pendingComponent: ClientsPageSkeleton,
	errorComponent: ClientsPageError,
	component: ClientsPage,
});
