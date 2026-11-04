/**
 * Route of the /coding-agents account page. The `_auth` parent already checked the session.
 * It sends the user to /dashboard when V2 is closed, with the same check as /app/$projectId.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

import CodingAgentsPage from "@/features/coding-agents/pages/coding-agents-page";
import { publicSettingsQuery } from "@/features/settings";
import { pageTitle } from "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_auth/coding-agents")({
	beforeLoad: async () => {
		// Product rule: coding agents work on V2 projects only.
		const isV2Open =
			__V2_BUILDER_IN_BUILD__ &&
			(await queryClient.ensureQueryData(publicSettingsQuery)).v2BuilderEnabled;
		if (!isV2Open) {
			throw redirect({ to: "/dashboard", replace: true });
		}
	},
	head: () => ({
		meta: [{ title: pageTitle("auth.codingAgents.metaTitle") }],
	}),
	component: CodingAgentsPage,
});
