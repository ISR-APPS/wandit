import { createFileRoute } from "@tanstack/react-router";

import WorkspaceAssetsPage from "@/features/assets/pages/workspace-assets-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/assets")({
	head: () => ({
		meta: [{ title: pageTitle("projects.assetsPage.metaTitle") }],
	}),
	component: WorkspaceAssetsPage,
});
