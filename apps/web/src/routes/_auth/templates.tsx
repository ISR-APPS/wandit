/**
 * Parent route of `/templates` and `/templates/$templateId`. It renders the child route.
 * It sends the user to /dashboard when V2 is closed, with the same check as /app/$projectId.
 * The `_auth` parent already checked the session.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { publicSettingsQuery } from "@/features/settings";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_auth/templates")({
	beforeLoad: async () => {
		// Product rule: a starter template makes a V2 project, so the pages open only with V2.
		const isV2Open =
			__V2_BUILDER_IN_BUILD__ &&
			(await queryClient.ensureQueryData(publicSettingsQuery)).v2BuilderEnabled;
		if (!isV2Open) {
			throw redirect({ to: "/dashboard", replace: true });
		}
	},
	component: Outlet,
});
