// The Team page behind login. The /app layout checks the session first.
// The loader fills the members and the tasks. Thin: the page and its states live in the team feature.
import { createFileRoute } from "@tanstack/react-router";
import { TeamPage, TeamPageError, TeamPageSkeleton } from "~/features/team";
import { membersQueryOptions, tasksQueryOptions } from "~/features/tracker";

/** /app/team: the workload of each person of the team. */
export const Route = createFileRoute("/app/team")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(membersQueryOptions()),
			context.queryClient.query(tasksQueryOptions()),
		]),
	pendingComponent: TeamPageSkeleton,
	errorComponent: TeamPageError,
	component: TeamPage,
});
