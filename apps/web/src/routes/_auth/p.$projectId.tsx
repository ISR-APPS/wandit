/**
 * This route file owns the authenticated `/p/$projectId` workspace URL.
 *
 * In the chat flow, the user lands here after project creation or by opening an
 * existing project. The route reads `$projectId` from the URL, validates the
 * optional `?tab=` search param, lazy-loads the heavy workspace page, and passes
 * both values into WorkspacePage. WorkspacePage then mounts the chat pane, whose
 * hook resolves the real chatId and opens the SSE stream.
 *
 * Gotcha: this file only gates routing and code loading. It does not fetch chat
 * data itself; the `/_auth` parent route has already checked auth, and the
 * workspace provider/hooks do the project/chat fetching after this component
 * renders.
 */
// TanStack Router turns file routes into typed route objects. `createFileRoute`
// connects this module to the path segment declared in the generated route tree.
import { createFileRoute } from "@tanstack/react-router";
// React.lazy splits WorkspacePage into a separate JavaScript chunk; Suspense
// shows a fallback while that chunk downloads.
import { lazy, Suspense } from "react";

import Loader from "@/components/loader";
import { isWorkspaceTab, type WorkspaceTab } from "@/features/workspace";
import { pageTitle } from "@/lib/i18n";

// The workspace is the heavy chunk — lazy-loaded so `/` and `/dashboard`
// stay light (PRD: workspace code loads only on /p/*).
const WorkspacePage = lazy(
	() => import("@/features/workspace/pages/workspace-page"),
);

// The only search/query-string value this route accepts. Unknown values are
// discarded below so the page always receives a real WorkspaceTab.
type WorkspaceSearch = { tab?: WorkspaceTab };

// Route is the exported TanStack Router definition for /_auth/p/$projectId.
// `$projectId` becomes a typed route param, and validateSearch keeps `?tab=...`
// constrained to the workspace tab union.
export const Route = createFileRoute("/_auth/p/$projectId")({
	validateSearch: (search: Record<string, unknown>): WorkspaceSearch =>
		isWorkspaceTab(search.tab) ? { tab: search.tab } : {},
	head: () => ({ meta: [{ title: pageTitle("workspace.meta.title") }] }),
	component: RouteComponent,
});

// RouteComponent is the tiny adapter between the URL and the feature page:
// read typed route state, then hand projectId/tab to WorkspacePage.
function RouteComponent() {
	const { projectId } = Route.useParams();
	const { tab } = Route.useSearch();
	// Suspense renders Loader until the lazy workspace chunk has loaded.
	return (
		<Suspense fallback={<Loader />}>
			{/* Invalid/missing tabs fall back to the default Page tab. */}
			<WorkspacePage projectId={projectId} tab={tab ?? "page"} />
		</Suspense>
	);
}
