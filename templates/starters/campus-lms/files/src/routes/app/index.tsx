// The home behind login: the school dashboard. The /app layout checks the session first.
// The loader fills the summary, the lessons trend of the default period, and the assignments due in parallel.
// Thin: the page and its states live in the dashboard feature.
import { createFileRoute } from "@tanstack/react-router";
import { dueAssignmentsQueryOptions } from "~/features/assignments";
import {
	DashboardPage,
	DashboardPageError,
	DashboardPageSkeleton,
	dashboardSummaryQueryOptions,
	lessonsTrendQueryOptions,
	TREND_DEFAULT_DAYS,
} from "~/features/dashboard";

/** /app: the welcome, course progress, leaderboard, pass rate, grading, activity, lessons trend, and assignments due. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(dashboardSummaryQueryOptions()),
			context.queryClient.query(lessonsTrendQueryOptions(TREND_DEFAULT_DAYS)),
			context.queryClient.query(dueAssignmentsQueryOptions()),
		]),
	pendingComponent: DashboardPageSkeleton,
	errorComponent: DashboardPageError,
	component: DashboardPage,
});
