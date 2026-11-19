// The Team page behind login. The /app layout checks the session first.
// The loader fills the members, the tasks, and the projects. Thin: the page and its states live in the team feature.
import { createFileRoute } from "@tanstack/react-router";
import { projectsQueryOptions } from "~/features/projects";
import { TeamPage, TeamPageError, TeamPageSkeleton } from "~/features/team";
import { membersQueryOptions, tasksQueryOptions } from "~/features/tracker";

/** /app/team: every person of the team with the load, the projects, and the status. */
export const Route = createFileRoute("/app/team")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(membersQueryOptions()),
			context.queryClient.query(tasksQueryOptions()),
			context.queryClient.query(projectsQueryOptions()),
		]),
	pendingComponent: TeamPageSkeleton,
	errorComponent: TeamPageError,
	component: TeamPage,
});
