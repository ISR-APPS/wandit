// The invoice list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the invoices feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	InvoicesPage,
	InvoicesPageError,
	InvoicesPageSkeleton,
	invoicesQueryOptions,
} from "~/features/invoices";

/** /app/invoices: every invoice of the studio, drafts included. */
export const Route = createFileRoute("/app/invoices")({
	loader: ({ context }) => context.queryClient.query(invoicesQueryOptions()),
	pendingComponent: InvoicesPageSkeleton,
	errorComponent: InvoicesPageError,
	component: InvoicesPage,
});
