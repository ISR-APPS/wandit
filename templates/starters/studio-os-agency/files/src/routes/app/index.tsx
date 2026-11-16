// The home behind login: the tabbed overview of the studio. The /app layout checks the session first.
// The loader fills the overview, the projects, the invoices, and the team load of the period, so a tab change shows no spinner.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { invoicesQueryOptions } from "~/features/invoices";
import {
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
	overviewSearchSchema,
} from "~/features/overview";
import { projectsQueryOptions } from "~/features/projects";
import { teamLoadQueryOptions } from "~/features/team";

/** /app: the overview. `?tab=` opens an entity tab, `?days=` sets the period. */
export const Route = createFileRoute("/app/")({
	validateSearch: overviewSearchSchema,
	loaderDeps: ({ search }) => ({ days: search.days }),
	loader: ({ context, deps }) =>
		Promise.all([
			context.queryClient.query(overviewQueryOptions(deps.days)),
			context.queryClient.query(projectsQueryOptions()),
			context.queryClient.query(invoicesQueryOptions()),
			context.queryClient.query(teamLoadQueryOptions(deps.days)),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
