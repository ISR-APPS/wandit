/**
 * `/join/$token` route: the target of a workspace or project invite link.
 * It passes the link token from the URL to `JoinPage`, which previews and accepts it.
 */
import { createFileRoute } from "@tanstack/react-router";

import JoinPage from "@/features/workspaces/pages/join-page";
import { pageTitle } from "@/lib/i18n";

// Outside `_auth`: the page itself asks a signed-out visitor to sign in.
export const Route = createFileRoute("/join/$token")({
	head: () => ({
		meta: [{ title: pageTitle("workspaces.join.title") }],
	}),
	component: JoinRoute,
});

function JoinRoute() {
	const { token } = Route.useParams();

	return <JoinPage token={token} />;
}
