// The week schedule behind login. The /app layout checks the session first.
// The loader fills the post list, which also holds the queue and the drafts. Thin: the page lives in the schedule feature.
import { createFileRoute } from "@tanstack/react-router";
import { postsQueryOptions } from "~/features/posts";
import {
	SchedulePage,
	SchedulePageError,
	SchedulePageSkeleton,
} from "~/features/schedule";

/** /app/schedule: the posts of one week, the weekly goals, and the drafts. */
export const Route = createFileRoute("/app/schedule")({
	loader: ({ context }) => context.queryClient.query(postsQueryOptions()),
	pendingComponent: SchedulePageSkeleton,
	errorComponent: SchedulePageError,
	component: SchedulePage,
});
