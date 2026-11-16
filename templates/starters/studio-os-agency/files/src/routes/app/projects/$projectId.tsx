// The detail page of one project. The /app layout checks the session first.
// The loader fills the project detail. Thin: the page lives in the projects feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	ProjectDetailPage,
	ProjectDetailPageSkeleton,
	ProjectsPageError,
	projectQueryOptions,
} from "~/features/projects";

/** /app/projects/$projectId. `params.projectId` is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/projects/$projectId")({
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
