// The home behind login: the studio dashboard with the tabs Overview and Reports. The /app layout checks the session first.
// The loader fills the overview of the period, the projects, and the invoices, so a tab change shows no spinner.
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

/** /app: the dashboard. `?tab=` opens Overview or Reports, `?days=` sets the period. */
export const Route = createFileRoute("/app/")({
	validateSearch: overviewSearchSchema,
	loaderDeps: ({ search }) => ({ days: search.days }),
	loader: ({ context, deps }) =>
		Promise.all([
			context.queryClient.query(overviewQueryOptions(deps.days)),
			context.queryClient.query(projectsQueryOptions()),
			context.queryClient.query(invoicesQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
