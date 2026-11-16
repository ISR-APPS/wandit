// My tasks behind login. The /app layout checks the session first.
// The loader fills the tasks, the members, and the projects. Thin: the page and its states live in the my-tasks feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	MyTasksPage,
	MyTasksPageError,
	MyTasksPageSkeleton,
} from "~/features/my-tasks";
import { projectsQueryOptions } from "~/features/projects";
import { membersQueryOptions, tasksQueryOptions } from "~/features/tracker";

/** /app/tasks: the open and recently done tasks of the signed-in person. */
export const Route = createFileRoute("/app/tasks")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(tasksQueryOptions()),
			context.queryClient.query(membersQueryOptions()),
			context.queryClient.query(projectsQueryOptions()),
		]),
	pendingComponent: MyTasksPageSkeleton,
	errorComponent: MyTasksPageError,
	component: MyTasksPage,
});
