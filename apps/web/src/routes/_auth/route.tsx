import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getSession } from "@/features/auth";
import { sanitizeAuthRedirectPath } from "@/lib/auth-navigation";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/",
				search: {
					auth: "required",
					// Stripe returns order reconciliation state in the query
					// string. Keep it across a re-authentication redirect.
					next: sanitizeAuthRedirectPath(location.href),
				},
			});
		}
		return { session };
	},
});

function AuthLayout() {
	return <Outlet />;
}
