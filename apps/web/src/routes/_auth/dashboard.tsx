import { createFileRoute } from "@tanstack/react-router";

import DashboardPage from "@/features/projects/pages/dashboard-page";

export const Route = createFileRoute("/_auth/dashboard")({
	head: () => ({
		meta: [{ title: "Projects — Wandit" }],
	}),
	component: DashboardPage,
});
