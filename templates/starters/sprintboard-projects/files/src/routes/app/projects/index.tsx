// The project list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the projects feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ProjectsPage,
	ProjectsPageError,
	ProjectsPageSkeleton,
	projectsQueryOptions,
	projectsSearchSchema,
} from "~/features/projects";

/** /app/projects: every project of the team. `?status=` opens the tab of one status. */
export const Route = createFileRoute("/app/projects/")({
	validateSearch: projectsSearchSchema,
	loader: ({ context }) => context.queryClient.query(projectsQueryOptions()),
	pendingComponent: ProjectsPageSkeleton,
	errorComponent: ProjectsPageError,
	component: ProjectsPage,
});
