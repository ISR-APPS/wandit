// The housekeeping page behind login. The /app layout checks the session first.
// The loader fills the tasks of today. Thin: the page and its states live in the housekeeping feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	HousekeepingPage,
	HousekeepingPageError,
	HousekeepingPageSkeleton,
	housekeepingTasksQueryOptions,
} from "~/features/housekeeping";

/** /app/housekeeping: the task board of today. */
export const Route = createFileRoute("/app/housekeeping")({
	loader: ({ context }) =>
		context.queryClient.query(housekeepingTasksQueryOptions()),
	pendingComponent: HousekeepingPageSkeleton,
	errorComponent: HousekeepingPageError,
	component: HousekeepingPage,
});
