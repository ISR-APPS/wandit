// The contacts page behind login. The /app layout checks the session first.
// The loader fills the people and the companies in parallel. Thin: the page and its states live in the contacts feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ContactsPage,
	ContactsPageError,
	ContactsPageSkeleton,
	companiesQueryOptions,
	contactsQueryOptions,
} from "~/features/contacts";

/** /app/contacts: the people at customer companies, and the companies. */
export const Route = createFileRoute("/app/contacts")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(contactsQueryOptions()),
			context.queryClient.query(companiesQueryOptions()),
		]),
	pendingComponent: ContactsPageSkeleton,
	errorComponent: ContactsPageError,
	component: ContactsPage,
});
