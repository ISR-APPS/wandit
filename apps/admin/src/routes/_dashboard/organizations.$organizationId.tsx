import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { OrganizationDetailPage } from "@/features/organizations/pages/organization-detail-page";

export const Route = createFileRoute(
	"/_dashboard/organizations/$organizationId",
)({
	component: OrganizationDetailRoute,
	head: () => ({
		meta: [
			{
				title: "Organization | Wandit Admin",
			},
		],
	}),
});

function OrganizationDetailRoute() {
	const { organizationId } = Route.useParams();

	return (
		<RequireAdminPermission permission={{ organizations: ["read"] }}>
			<OrganizationDetailPage organizationId={organizationId} />
		</RequireAdminPermission>
	);
}
