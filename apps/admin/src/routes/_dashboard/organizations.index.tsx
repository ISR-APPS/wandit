import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { OrganizationsPage } from "@/features/organizations/pages/organizations-page";

export const Route = createFileRoute("/_dashboard/organizations/")({
	component: OrganizationsIndexRoute,
	head: () => ({
		meta: [
			{
				title: "Organizations | Wandit Admin",
			},
		],
	}),
});

function OrganizationsIndexRoute() {
	return (
		<RequireAdminPermission permission={{ organizations: ["read"] }}>
			<OrganizationsPage />
		</RequireAdminPermission>
	);
}
