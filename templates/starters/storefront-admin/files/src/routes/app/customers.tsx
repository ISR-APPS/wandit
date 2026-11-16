// The customer page behind login. The /app layout checks the session first.
// The loader fills the customer cache. Thin: the page and its states live in the customers feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CustomersPage,
	CustomersPageError,
	CustomersPageSkeleton,
	customersQueryOptions,
	customersSearchSchema,
} from "~/features/customers";

/** /app/customers: every customer of the shop. `?customer=` opens the panel of one customer. */
export const Route = createFileRoute("/app/customers")({
	validateSearch: customersSearchSchema,
	loader: ({ context }) => context.queryClient.query(customersQueryOptions()),
	pendingComponent: CustomersPageSkeleton,
	errorComponent: CustomersPageError,
	component: CustomersPage,
});
