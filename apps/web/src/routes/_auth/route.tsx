import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getSession } from "@/features/auth";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async () => {
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
