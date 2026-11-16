// The customers page behind login. The /app layout checks the session first.
// The loader fills the customer list. Thin: the page and its states live in the customers feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CustomersPage,
	CustomersPageError,
	CustomersPageSkeleton,
	customersQueryOptions,
	customersSearchSchema,
} from "~/features/customers";

/** /app/customers: every customer company. `?plan=` opens a plan tab, `?customer=` opens the sheet of one customer. */
export const Route = createFileRoute("/app/customers")({
	validateSearch: customersSearchSchema,
	loader: ({ context }) => context.queryClient.query(customersQueryOptions()),
	pendingComponent: CustomersPageSkeleton,
	errorComponent: CustomersPageError,
	component: CustomersPage,
});
