// The Tasks page behind login. The /app layout checks the session first.
// The loader fills the task list cache. Thin: the page and its states live in the tasks feature.
import { createFileRoute } from "@tanstack/react-router";
import { TasksPage, TasksPageError, TasksPageSkeleton } from "~/features/tasks";
import { tasksQueryOptions } from "~/features/tracker";

/** /app/tasks: every task of every project, with filters and pages. */
export const Route = createFileRoute("/app/tasks")({
	loader: ({ context }) => context.queryClient.query(tasksQueryOptions()),
	pendingComponent: TasksPageSkeleton,
	errorComponent: TasksPageError,
	component: TasksPage,
});
