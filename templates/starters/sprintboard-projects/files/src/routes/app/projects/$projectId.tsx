// The page of one project: its profile and its task board. The /app layout checks the session first.
// The loader fills the project, its tasks, its milestones, and its people. Thin: the page lives in the projects feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	ProjectDetailPage,
	ProjectDetailPageSkeleton,
	ProjectsPageError,
	projectQueryOptions,
	projectSearchSchema,
} from "~/features/projects";

/** /app/projects/$projectId. `?tab=board` opens the board. The query answers null for an unknown id. */
export const Route = createFileRoute("/app/projects/$projectId")({
	validateSearch: projectSearchSchema,
	loader: ({ context, params }) =>
		context.queryClient.query(projectQueryOptions(params.projectId)),
	pendingComponent: ProjectDetailPageSkeleton,
	errorComponent: ProjectsPageError,
	component: ProjectDetailRoute,
});

function ProjectDetailRoute() {
	const { projectId } = Route.useParams();
	return <ProjectDetailPage projectId={projectId} />;
}
