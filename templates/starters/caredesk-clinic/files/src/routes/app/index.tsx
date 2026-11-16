// The home behind login: the briefing of the day. The /app layout checks the session first.
// The loader fills the profile, the appointments of today, the figures, and the visits of the first period.
// Thin: the page and its states live in the today feature.
import { createFileRoute } from "@tanstack/react-router";
import { profileQueryOptions } from "~/features/profile";
import {
	DEFAULT_DAYS,
	dailyVisitsQueryOptions,
	TodayPage,
	TodayPageError,
	TodayPageSkeleton,
	todayAppointmentsQueryOptions,
	weekKpisQueryOptions,
} from "~/features/today";

/** /app. `context.session` comes from the /app layout guard. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(profileQueryOptions(context.session.user.id)),
			context.queryClient.query(todayAppointmentsQueryOptions()),
			context.queryClient.query(weekKpisQueryOptions()),
			context.queryClient.query(dailyVisitsQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: TodayPageSkeleton,
	errorComponent: TodayPageError,
	component: TodayRoute,
});

function TodayRoute() {
	const { session } = Route.useRouteContext();
	return <TodayPage session={session} />;
}
