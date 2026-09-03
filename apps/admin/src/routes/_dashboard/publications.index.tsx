import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { PublicationsPage } from "@/features/publications/pages/publications-page";

export const Route = createFileRoute("/_dashboard/publications/")({
	component: PublicationsIndexRoute,
	head: () => ({
		meta: [
			{
				title: "Publications | Wandit Admin",
			},
		],
	}),
});

function PublicationsIndexRoute() {
	return (
		<RequireAdminPermission permission={{ publications: ["read"] }}>
			<PublicationsPage />
		</RequireAdminPermission>
	);
}
