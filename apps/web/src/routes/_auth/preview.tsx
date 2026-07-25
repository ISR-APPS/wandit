// Launch-window route: where a non-early-access prompt submission lands
// instead of a real /p/$projectId workspace (see lib/early-access.ts). The
// typed prompt rides in ?prompt= so the page can echo it as a chat bubble.
import { createFileRoute } from "@tanstack/react-router";

import WorkspacePreviewPage from "@/features/projects/pages/workspace-preview-page";
import { pageTitle } from "@/lib/i18n";

const MAX_PROMPT_LENGTH = 2_000;

type PreviewSearch = { prompt?: string };

export const Route = createFileRoute("/_auth/preview")({
	validateSearch: (search: Record<string, unknown>): PreviewSearch =>
		typeof search.prompt === "string" && search.prompt.trim().length > 0
			? { prompt: search.prompt.slice(0, MAX_PROMPT_LENGTH) }
			: {},
	head: () => ({ meta: [{ title: pageTitle("workspace.meta.title") }] }),
	component: RouteComponent,
});

function RouteComponent() {
	const { prompt } = Route.useSearch();
	return <WorkspacePreviewPage prompt={prompt} />;
}
