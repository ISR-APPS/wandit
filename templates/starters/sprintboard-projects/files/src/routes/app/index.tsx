// The home behind login: the overview of the product team. The /app layout checks the session first.
// The loader fills the tasks, the projects, the members, and the overview of the default period, so a tab change shows no spinner.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
	overviewSearchSchema,
} from "~/features/overview";
import { projectsQueryOptions } from "~/features/projects";
import {
	DEFAULT_DAYS,
	membersQueryOptions,
	tasksQueryOptions,
} from "~/features/tracker";

/** /app: the overview. `?tab=` opens the Tasks or the Bugs tab. */
export const Route = createFileRoute("/app/")({
	validateSearch: overviewSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(tasksQueryOptions()),
			context.queryClient.query(projectsQueryOptions()),
			context.queryClient.query(membersQueryOptions()),
			context.queryClient.query(overviewQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
