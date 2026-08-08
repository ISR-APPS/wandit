import { createFileRoute } from "@tanstack/react-router";

import WorkspaceLeadsPage from "@/features/leads/pages/workspace-leads-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/leads")({
	head: () => ({
		meta: [{ title: pageTitle("leads.metaTitle") }],
	}),
	component: WorkspaceLeadsPage,
});
