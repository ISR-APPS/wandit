// The time-off page behind login. The /app layout checks the session first.
// The loader fills the request list. Thin: the page lives in the time-off feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	TimeOffPage,
	TimeOffPageError,
	TimeOffPageSkeleton,
	timeOffRequestsQueryOptions,
	timeOffSearchSchema,
} from "~/features/time-off";

/** /app/time-off: the leave calendar and every request. `?request=` opens the dialog of one request. */
export const Route = createFileRoute("/app/time-off")({
	validateSearch: timeOffSearchSchema,
	loader: ({ context }) =>
		context.queryClient.query(timeOffRequestsQueryOptions()),
	pendingComponent: TimeOffPageSkeleton,
	errorComponent: TimeOffPageError,
	component: TimeOffPage,
});
