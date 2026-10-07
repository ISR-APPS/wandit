// Layout route of the area behind login, rendered in the browser only (ssr: false).
// beforeLoad sends a signed-out visitor to /login. The app shell wraps every child route.
// Thin: the frame lives in the app-shell feature, the pages live in their features.
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "~/features/app-shell";
import { requireSession } from "~/features/auth";

/** Parent of every route in src/routes/app/. Its context gives `session` to the children. */
export const Route = createFileRoute("/app")({
	// Supabase keeps the session in the browser, so this route never renders on the server.
	ssr: false,
	beforeLoad: async () => ({ session: await requireSession() }),
	component: AppLayout,
});

function AppLayout() {
	const { session } = Route.useRouteContext();
	return (
		<AppShell email={session.user.email ?? ""}>
			<Outlet />
		</AppShell>
	);
}
