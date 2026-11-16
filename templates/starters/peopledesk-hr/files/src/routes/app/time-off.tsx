// The time-off page behind login. The /app layout checks the session first.
// The loader fills the request list, the figures, and the planner. Thin: the page lives in the time-off feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	plannerQueryOptions,
	TimeOffPage,
	TimeOffPageError,
	TimeOffPageSkeleton,
	timeOffKpisQueryOptions,
	timeOffRequestsQueryOptions,
	timeOffSearchSchema,
} from "~/features/time-off";

/** /app/time-off: every request of the company. `?request=` opens the dialog of one request. */
export const Route = createFileRoute("/app/time-off")({
	validateSearch: timeOffSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(timeOffRequestsQueryOptions()),
			context.queryClient.query(timeOffKpisQueryOptions()),
			context.queryClient.query(plannerQueryOptions()),
		]),
	pendingComponent: TimeOffPageSkeleton,
	errorComponent: TimeOffPageError,
	component: TimeOffPage,
});
