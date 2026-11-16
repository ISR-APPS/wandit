// The home behind login: the briefing of the gym day. The /app layout checks the session first.
// The loader fills the profile, the week of classes, the figures, and the check-ins of the first period.
// Thin: the page and its states live in the today feature.
import { createFileRoute } from "@tanstack/react-router";
import { classSessionsQueryOptions } from "~/features/classes";
import { profileQueryOptions } from "~/features/profile";
import {
	DEFAULT_DAYS,
	dailyCheckInsQueryOptions,
	TodayPage,
	TodayPageError,
	TodayPageSkeleton,
	weekKpisQueryOptions,
} from "~/features/today";

/** /app. `context.session` comes from the /app layout guard. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(profileQueryOptions(context.session.user.id)),
			context.queryClient.query(classSessionsQueryOptions()),
			context.queryClient.query(weekKpisQueryOptions()),
			context.queryClient.query(dailyCheckInsQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: TodayPageSkeleton,
	errorComponent: TodayPageError,
	component: TodayRoute,
});

function TodayRoute() {
	const { session } = Route.useRouteContext();
	return <TodayPage session={session} />;
}
