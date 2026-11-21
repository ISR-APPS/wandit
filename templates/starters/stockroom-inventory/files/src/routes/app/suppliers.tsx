// The supplier list behind login. The /app layout checks the session first.
// The loader fills the supplier list. Thin: the page lives in the suppliers feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	SuppliersPage,
	SuppliersPageError,
	SuppliersPageSkeleton,
	suppliersQueryOptions,
} from "~/features/suppliers";

/** /app/suppliers: every supplier with its delivery record. */
export const Route = createFileRoute("/app/suppliers")({
	loader: ({ context }) => context.queryClient.query(suppliersQueryOptions()),
	pendingComponent: SuppliersPageSkeleton,
	errorComponent: SuppliersPageError,
	component: SuppliersPage,
});
