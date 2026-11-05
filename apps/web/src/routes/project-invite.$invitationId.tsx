/**
 * Route of a project invitation link at `/project-invite/$invitationId`.
 * It is outside `/_auth`: the page asks a signed-out visitor to sign in first.
 * Renders features/project-sharing/pages/project-invite-page.tsx.
 */
import { createFileRoute } from "@tanstack/react-router";

import ProjectInvitePage from "@/features/project-sharing/pages/project-invite-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/project-invite/$invitationId")({
	head: () => ({
		meta: [{ title: pageTitle("sharing.invite.title") }],
	}),
	component: ProjectInviteRoute,
});

function ProjectInviteRoute() {
	const { invitationId } = Route.useParams();

	return <ProjectInvitePage invitationId={invitationId} />;
}
