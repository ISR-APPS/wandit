// Profile route behind login. The /app layout checks the session first.
// The loader fills the profile cache. Thin: the page lives in the profile feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ProfilePage,
	ProfilePageError,
	ProfilePageSkeleton,
	profileQueryOptions,
} from "~/features/profile";

/** The profile page. `context.session` comes from the /app layout guard. */
export const Route = createFileRoute("/app/profile")({
	loader: ({ context }) =>
		context.queryClient.query(profileQueryOptions(context.session.user.id)),
	pendingComponent: ProfilePageSkeleton,
	errorComponent: ProfilePageError,
	component: ProfileRoute,
});

function ProfileRoute() {
	const { session } = Route.useRouteContext();
	return <ProfilePage session={session} />;
}
