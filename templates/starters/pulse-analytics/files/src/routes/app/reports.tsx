// The Reports page behind login. The /app layout checks the session first.
// The loader fills the reports of the default period, the schedules, and the notes. Thin: the page lives in the reports feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	notesQueryOptions,
	ReportsPage,
	ReportsPageError,
	ReportsPageSkeleton,
	reportsQueryOptions,
	schedulesQueryOptions,
} from "~/features/reports";
import { DEFAULT_DAYS } from "~/features/tracking";

/** /app/reports: sign-ups, retention, active users, recent sign-ups, email schedules, and team notes. */
export const Route = createFileRoute("/app/reports")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(reportsQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(schedulesQueryOptions()),
			context.queryClient.query(notesQueryOptions()),
		]),
	pendingComponent: ReportsPageSkeleton,
	errorComponent: ReportsPageError,
	component: ReportsPage,
});
