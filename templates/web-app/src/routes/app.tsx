// Layout route of the area behind login, rendered in the browser only (ssr: false).
// beforeLoad sends a signed-out visitor to /login. The loader reads the caller's row of app_access.
// Only an approved account gets the app shell and the child routes. Each other account gets the gate page.
// Thin: the gate lives in the access feature, the frame in the app-shell feature, the pages in their features.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
	AccessCheckError,
	AccessCheckSkeleton,
	AccessPendingPage,
	accessQueryOptions,
} from "~/features/access";
import { AppShell } from "~/features/app-shell";
import { requireSession } from "~/features/auth";

/**
 * Parent of every route in src/routes/app/. Its context gives `session` to the children.
 * A failed access read shows `AccessCheckError`, never the shell.
 */
export const Route = createFileRoute("/app")({
	// Supabase keeps the session in the browser, so the server renders only the skeleton of this route.
	ssr: false,
	beforeLoad: async () => ({ session: await requireSession() }),
	loader: ({ context }) =>
		context.queryClient.query(accessQueryOptions(context.session.user.id)),
	pendingComponent: AccessCheckSkeleton,
	// By default the router keeps the skeleton of the server for 500 ms in the browser.
	// 0 shows the app as soon as the access read ends.
	pendingMinMs: 0,
	errorComponent: AccessCheckError,
	component: AppLayout,
});

function AppLayout() {
	const { session } = Route.useRouteContext();
	const { data: access } = useSuspenseQuery(
		accessQueryOptions(session.user.id),
	);
	const email = session.user.email ?? "";

	// Product rule: the first account with a confirmed email is the owner, and each later account waits for the owner.
	// A backend that sends the code email confirms the address with that code. A backend that sends no email confirms it at sign-up.
	// This branch only picks the screen. RLS in the database keeps the rows from an account that waits.
	if (access.status !== "approved") {
		return <AccessPendingPage status={access.status} email={email} />;
	}
	return (
		<AppShell userId={session.user.id} email={email}>
			<Outlet />
		</AppShell>
	);
}
