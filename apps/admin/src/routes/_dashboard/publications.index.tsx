import { createFileRoute } from "@tanstack/react-router";

import { PublicationsPage } from "@/features/publications/pages/publications-page";

export const Route = createFileRoute("/_dashboard/publications/")({
	component: PublicationsPage,
	head: () => ({
		meta: [
			{
				title: "Publications | Wandit Admin",
			},
		],
	}),
});
