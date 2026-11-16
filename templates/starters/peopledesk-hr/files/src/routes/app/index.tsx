// The home of the app behind login: the digest of the HR desk. The /app layout checks the session first.
// The loader fills every query of the period in the URL (?days=30), or of the default week.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	candidatesQueryOptions,
	dailyApplicationsQueryOptions,
} from "~/features/hiring";
import {
	DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewSearchSchema,
} from "~/features/overview";
import {
	absenceByDepartmentQueryOptions,
	absenceByTypeQueryOptions,
	dailyAbsenceQueryOptions,
	timeOffRequestsQueryOptions,
} from "~/features/time-off";

/** /app: the digest of the last 7 days, or of the last 30 with ?days=30. */
export const Route = createFileRoute("/app/")({
	validateSearch: overviewSearchSchema,
	loaderDeps: ({ search }) => ({ days: search.days ?? DEFAULT_DAYS }),
	loader: ({ context, deps }) =>
		Promise.all([
			context.queryClient.query(dailyAbsenceQueryOptions(deps.days)),
			context.queryClient.query(absenceByTypeQueryOptions(deps.days)),
			context.queryClient.query(absenceByDepartmentQueryOptions(deps.days)),
			context.queryClient.query(dailyApplicationsQueryOptions(deps.days)),
			context.queryClient.query(timeOffRequestsQueryOptions()),
			context.queryClient.query(candidatesQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
