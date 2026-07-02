import { createFileRoute } from "@tanstack/react-router";

import WorkspacePage from "@/features/workspace/pages/workspace-page";

export const Route = createFileRoute("/_auth/p/$projectId")({
	component: RouteComponent,
});

function RouteComponent() {
	const { projectId } = Route.useParams();
	return <WorkspacePage projectId={projectId} />;
}
