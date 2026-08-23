import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { OfflineBillingPage } from "@/features/offline-billing/pages/offline-billing-page";

export const Route = createFileRoute("/_dashboard/offline-billing")({
	component: OfflineBillingRoute,
	head: () => ({
		meta: [{ title: "Offline billing | Wandit Admin" }],
	}),
});

function OfflineBillingRoute() {
	return (
		<RequireAdminPermission permission={{ billing: ["read"] }}>
			<OfflineBillingPage />
		</RequireAdminPermission>
	);
}
