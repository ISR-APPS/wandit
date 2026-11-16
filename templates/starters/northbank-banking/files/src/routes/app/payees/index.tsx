// The saved payees behind login. The /app layout checks the session first.
// The loader fills the payee list. Thin: the page and its states live in the payees feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	PayeesPage,
	PayeesPageError,
	PayeesPageSkeleton,
	payeesQueryOptions,
} from "~/features/payees";

/** /app/payees: every saved payee with its last payment. */
export const Route = createFileRoute("/app/payees/")({
	loader: ({ context }) => context.queryClient.query(payeesQueryOptions()),
	pendingComponent: PayeesPageSkeleton,
	errorComponent: PayeesPageError,
	component: PayeesPage,
});
