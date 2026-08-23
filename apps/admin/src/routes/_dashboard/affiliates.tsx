import { createFileRoute } from "@tanstack/react-router";
import { AffiliatesPage } from "@/features/affiliates/pages/affiliates-page";
import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";

export const Route = createFileRoute("/_dashboard/affiliates")({
	component: AffiliatesRoute,
	head: () => ({
		meta: [{ title: "Affiliates | Wandit Admin" }],
	}),
});

function AffiliatesRoute() {
	return (
		<RequireAdminPermission permission={{ affiliates: ["read"] }}>
			<AffiliatesPage />
		</RequireAdminPermission>
	);
}
