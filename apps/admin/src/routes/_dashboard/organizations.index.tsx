import { createFileRoute } from "@tanstack/react-router";

import { OrganizationsPage } from "@/features/organizations/pages/organizations-page";

export const Route = createFileRoute("/_dashboard/organizations/")({
	component: OrganizationsPage,
	head: () => ({
		meta: [
			{
				title: "Organizations | Wandit Admin",
			},
		],
	}),
});
