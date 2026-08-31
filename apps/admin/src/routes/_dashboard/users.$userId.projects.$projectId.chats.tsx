import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { ProjectConversationsPage } from "@/features/conversations/pages/project-conversations-page";

export const Route = createFileRoute(
	"/_dashboard/users/$userId/projects/$projectId/chats",
)({
	component: ProjectConversationsRoute,
	head: () => ({
		meta: [{ title: "Project conversations | Wandit Admin" }],
	}),
});

function ProjectConversationsRoute() {
	const { projectId, userId } = Route.useParams();

	return (
		<RequireAdminPermission permission={{ conversations: ["read"] }}>
			<ProjectConversationsPage projectId={projectId} userId={userId} />
		</RequireAdminPermission>
	);
}
