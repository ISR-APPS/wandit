import { createFileRoute } from "@tanstack/react-router";

import WorkspaceMembersPage from "@/features/workspaces/pages/workspace-members-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/workspace/members")({
	head: () => ({
		meta: [{ title: pageTitle("workspaces.members.title") }],
	}),
	component: WorkspaceMembersPage,
});
