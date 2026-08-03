import { createFileRoute } from "@tanstack/react-router";

import InvitePage from "@/features/workspaces/pages/invite-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/invite/$invitationId")({
	head: () => ({
		meta: [{ title: pageTitle("workspaces.invite.title") }],
	}),
	component: InviteRoute,
});

function InviteRoute() {
	const { invitationId } = Route.useParams();

	return <InvitePage invitationId={invitationId} />;
}
