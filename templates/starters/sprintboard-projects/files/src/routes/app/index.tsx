// The home behind login: the delivery dashboard of the product team. The /app layout checks the session first.
// The loader fills the tasks, the projects, and the summary of the default period, so the first view shows no spinner.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	OVERVIEW_DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewSearchSchema,
	overviewSummaryQueryOptions,
} from "~/features/overview";
import { projectsQueryOptions } from "~/features/projects";
import { tasksQueryOptions } from "~/features/tracker";

/** /app: the dashboard. `?tab=reports` opens the project report. */
export const Route = createFileRoute("/app/")({
	validateSearch: overviewSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(tasksQueryOptions()),
			context.queryClient.query(projectsQueryOptions()),
			context.queryClient.query(
				overviewSummaryQueryOptions(OVERVIEW_DEFAULT_DAYS),
			),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
