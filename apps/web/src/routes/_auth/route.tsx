import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getSession } from "@/features/auth";
import { sanitizeAuthRedirectPath } from "@/lib/auth-navigation";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async ({ location }) => {
		// A failed session CHECK is not a signed-out user: swallowing it here
		// would eject a logged-in user to the landing page and drop their deep
		// link + stashed prompt. Rethrow with a readable message so the route
		// error screen (retryable) shows instead of a raw "Failed to fetch".
		const session = await getSession().catch((error) => {
			throw new Error("We could not check your session. Please retry.", {
				cause: error,
			});
		});
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
		if (!session.user.onboardingCompletedAt) {
			throw redirect({
				to: "/onboarding",
				search: {
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
