// The plans page behind login. The /app layout checks the session first.
// The loader fills the plan summaries and the payments ahead.
// Thin: the page and its states live in the plans feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	PlansPage,
	PlansPageError,
	PlansPageSkeleton,
	planSummariesQueryOptions,
	upcomingPaymentsQueryOptions,
} from "~/features/plans";

/** /app/plans: the five membership plans of the gym. */
export const Route = createFileRoute("/app/plans")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(planSummariesQueryOptions()),
			context.queryClient.query(upcomingPaymentsQueryOptions()),
		]),
	pendingComponent: PlansPageSkeleton,
	errorComponent: PlansPageError,
	component: PlansPage,
});
