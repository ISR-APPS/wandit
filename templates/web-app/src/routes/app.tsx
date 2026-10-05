// Route behind login, rendered in the browser only (ssr: false).
// beforeLoad sends a signed-out visitor to /login; the loader fills the profile cache.
// Thin: the page lives in the profile feature.
import { createFileRoute } from "@tanstack/react-router";
import { requireSession } from "~/features/auth";
import {
	ProfilePage,
	ProfilePageError,
	ProfilePageSkeleton,
	profileQueryOptions,
} from "~/features/profile";

export const Route = createFileRoute("/app")({
	// Supabase keeps the session in the browser, so this route never renders on the server.
	ssr: false,
	beforeLoad: async () => ({ session: await requireSession() }),
	loader: ({ context }) =>
		context.queryClient.query(profileQueryOptions(context.session.user.id)),
	pendingComponent: ProfilePageSkeleton,
	errorComponent: ProfilePageError,
	component: AppRoute,
});

function AppRoute() {
	const { session } = Route.useRouteContext();
	return <ProfilePage session={session} />;
}
