// The project list behind login. The /app layout checks the session first.
// The loader fills the project list and the members. Thin: the page and its states live in the projects feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ProjectsPage,
	ProjectsPageError,
	ProjectsPageSkeleton,
	projectsQueryOptions,
} from "~/features/projects";
import { membersQueryOptions } from "~/features/tracker";

/** /app/projects: one card per project of the team. */
export const Route = createFileRoute("/app/projects/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(projectsQueryOptions()),
			context.queryClient.query(membersQueryOptions()),
		]),
	pendingComponent: ProjectsPageSkeleton,
	errorComponent: ProjectsPageError,
	component: ProjectsPage,
});
