import { createFileRoute } from "@tanstack/react-router";

import { OverviewPage } from "@/features/overview/pages/overview-page";

export const Route = createFileRoute("/_dashboard/dashboard")({
	component: OverviewPage,
	head: () => ({
		meta: [
			{
				title: "Overview | Wandit Admin",
			},
		],
	}),
});
