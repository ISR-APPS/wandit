import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { ProjectDetailPage } from "@/features/projects/pages/project-detail-page";

export const Route = createFileRoute(
	"/_dashboard/users/$userId/projects/$projectId/",
)({
	component: ProjectDetailRoute,
	head: () => ({
		meta: [{ title: "Project details | Wandit Admin" }],
	}),
});

function ProjectDetailRoute() {
	const { projectId, userId } = Route.useParams();

	return (
		<RequireAdminPermission permission={{ users: ["read"] }}>
			<ProjectDetailPage projectId={projectId} userId={userId} />
		</RequireAdminPermission>
	);
}
