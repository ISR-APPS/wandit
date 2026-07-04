import { createFileRoute } from "@tanstack/react-router";

import DashboardPage from "@/features/projects/pages/dashboard-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/dashboard")({
	head: () => ({
		meta: [{ title: pageTitle("projects.meta.title") }],
	}),
	component: DashboardPage,
});
