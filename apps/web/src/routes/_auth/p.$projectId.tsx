import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import Loader from "@/components/loader";
import { isWorkspaceTab, type WorkspaceTab } from "@/features/workspace";
import { pageTitle } from "@/lib/i18n";

// The workspace is the heavy chunk — lazy-loaded so `/` and `/dashboard`
// stay light (PRD: workspace code loads only on /p/*).
const WorkspacePage = lazy(
	() => import("@/features/workspace/pages/workspace-page"),
);

type WorkspaceSearch = { tab?: WorkspaceTab };

export const Route = createFileRoute("/_auth/p/$projectId")({
	validateSearch: (search: Record<string, unknown>): WorkspaceSearch =>
		isWorkspaceTab(search.tab) ? { tab: search.tab } : {},
	head: () => ({ meta: [{ title: pageTitle("workspace.meta.title") }] }),
	component: RouteComponent,
});

function RouteComponent() {
	const { projectId } = Route.useParams();
	const { tab } = Route.useSearch();
	return (
		<Suspense fallback={<Loader />}>
			<WorkspacePage projectId={projectId} tab={tab ?? "page"} />
		</Suspense>
	);
}
