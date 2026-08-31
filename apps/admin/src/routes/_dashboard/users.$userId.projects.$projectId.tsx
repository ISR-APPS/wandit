import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_dashboard/users/$userId/projects/$projectId",
)({
	component: ProjectDetailLayout,
});

function ProjectDetailLayout() {
	return <Outlet />;
}
