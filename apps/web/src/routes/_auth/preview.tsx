// Launch-window route: where a non-early-access prompt submission lands
// instead of a real /p/$projectId workspace (see lib/early-access.ts). The
// typed prompt rides in history state so the page can echo it as a chat bubble.
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useLayoutEffect } from "react";

import {
	getPreviewPromptFromHistoryState,
	migrateLegacyPreviewPromptUrl,
	normalizePreviewPrompt,
} from "@/features/projects/lib/preview-prompt";
import WorkspacePreviewPage from "@/features/projects/pages/workspace-preview-page";
import { pageTitle } from "@/lib/i18n";

type PreviewSearch = { prompt?: string };

export const Route = createFileRoute("/_auth/preview")({
	// Keep accepting rollout-era links whose prompt was transported in search.
	validateSearch: (search: Record<string, unknown>): PreviewSearch => {
		const prompt = normalizePreviewPrompt(search.prompt);
		return prompt ? { prompt } : {};
	},
	head: () => ({ meta: [{ title: pageTitle("workspace.meta.title") }] }),
	component: RouteComponent,
});

function RouteComponent() {
	const { prompt: legacySearchPrompt } = Route.useSearch();
	const statePrompt = useLocation({
		select: (location) => getPreviewPromptFromHistoryState(location.state),
	});

	useLayoutEffect(() => {
		if (!legacySearchPrompt) return;

		// Bootstrap handles initial legacy URLs before analytics starts; this also
		// migrates rollout-era entries reached through client-side history.
		migrateLegacyPreviewPromptUrl();
	}, [legacySearchPrompt]);

	const prompt = legacySearchPrompt ?? statePrompt;
	return <WorkspacePreviewPage prompt={prompt} />;
}
