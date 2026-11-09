/**
 * `/workspace/people` route: members, invitations, invite links, and collaborators
 * of the active workspace. The `_auth` layout requires a session.
 * It renders `WorkspacePeoplePage` from the workspaces feature.
 */
import { createFileRoute } from "@tanstack/react-router";

import WorkspacePeoplePage from "@/features/workspaces/pages/workspace-people-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/workspace/people")({
	head: () => ({
		meta: [{ title: pageTitle("workspaces.people.title") }],
	}),
	component: WorkspacePeoplePage,
});
