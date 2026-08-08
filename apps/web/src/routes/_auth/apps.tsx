import { createFileRoute } from "@tanstack/react-router";

import AppsPage from "@/features/projects/pages/apps-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/apps")({
	head: () => ({
		meta: [{ title: pageTitle("projects.appsPage.metaTitle") }],
	}),
	component: AppsPage,
});
