import { createFileRoute } from "@tanstack/react-router";

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

	return <OrganizationDetailPage organizationId={organizationId} />;
}
