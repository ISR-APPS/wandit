// The Recent page behind login. The /app layout checks the session first.
// The loader fills the feed of the last 30 days. Thin: the page lives in the recent feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	activityQueryOptions,
	RecentPage,
	RecentPageError,
	RecentPageSkeleton,
} from "~/features/recent";

/** /app/recent: the feed of the last 30 days. */
export const Route = createFileRoute("/app/recent")({
	loader: ({ context }) => context.queryClient.query(activityQueryOptions()),
	pendingComponent: RecentPageSkeleton,
	errorComponent: RecentPageError,
	component: RecentPage,
});
