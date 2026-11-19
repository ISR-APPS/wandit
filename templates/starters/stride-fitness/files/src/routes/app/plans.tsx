// The plans page behind login. The /app layout checks the session first.
// The loader fills the plan rows and the KPIs. Thin: the page and its states live in the plans feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	PlansPage,
	PlansPageError,
	PlansPageSkeleton,
	plansOverviewQueryOptions,
} from "~/features/plans";

/** /app/plans: the five membership plans of the gym. */
export const Route = createFileRoute("/app/plans")({
	loader: ({ context }) =>
		context.queryClient.query(plansOverviewQueryOptions()),
	pendingComponent: PlansPageSkeleton,
	errorComponent: PlansPageError,
	component: PlansPage,
});
