/**
 * Route /credit-grants. It renders CreditGrantsPage behind credits:read.
 * RequireAdminPermission shows an access-denied state to other staff.
 */
import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { CreditGrantsPage } from "@/features/credit-grants/pages/credit-grants-page";

export const Route = createFileRoute("/_dashboard/credit-grants")({
	component: CreditGrantsRoute,
	head: () => ({
		meta: [{ title: "Credit grants | Wandit Admin" }],
	}),
});

function CreditGrantsRoute() {
	return (
		<RequireAdminPermission permission={{ credits: ["read"] }}>
			<CreditGrantsPage />
		</RequireAdminPermission>
	);
}
