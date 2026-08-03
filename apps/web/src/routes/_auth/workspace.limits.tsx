import { createFileRoute } from "@tanstack/react-router";

import WorkspaceLimitsPage from "@/features/workspaces/pages/workspace-limits-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/workspace/limits")({
	head: () => ({
		meta: [{ title: pageTitle("workspaces.limits.title") }],
	}),
	component: WorkspaceLimitsPage,
});
