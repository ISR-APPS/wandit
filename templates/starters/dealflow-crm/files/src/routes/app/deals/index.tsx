// The deal list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the deals feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DealsPage,
	DealsPageError,
	DealsPageSkeleton,
	dealsQueryOptions,
	dealsSearchSchema,
} from "~/features/deals";

/** /app/deals: every deal of the team. `?stage=` opens the tab of one stage. */
export const Route = createFileRoute("/app/deals/")({
	validateSearch: dealsSearchSchema,
	loader: ({ context }) => context.queryClient.query(dealsQueryOptions()),
	pendingComponent: DealsPageSkeleton,
	errorComponent: DealsPageError,
	component: DealsPage,
});
