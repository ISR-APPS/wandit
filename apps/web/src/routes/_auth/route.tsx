import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getSession } from "@/features/auth";

// LAUNCH LOCK: the app is closed to the public until launch — every
// authenticated area bounces back to the landing page. Flip to false (one
// commit) to reopen. The landing page itself stays fully visible.
const LAUNCH_LOCK = true;

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async () => {
		if (LAUNCH_LOCK) {
			throw redirect({ to: "/" });
		}

		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/", search: { auth: "required" } });
		}
		return { session };
	},
});

function AuthLayout() {
	return <Outlet />;
}
