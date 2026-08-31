import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { OfflineReceiptPage } from "@/features/offline-billing/pages/offline-receipt-page";

export const Route = createFileRoute(
	"/_dashboard/offline-billing/$subscriptionId/receipt",
)({
	component: OfflineReceiptRoute,
	head: () => ({
		meta: [{ title: "Receipt | Wandit Admin" }],
	}),
});

function OfflineReceiptRoute() {
	const { subscriptionId } = Route.useParams();

	return (
		<RequireAdminPermission permission={{ billing: ["read"] }}>
			<OfflineReceiptPage subscriptionId={subscriptionId} />
		</RequireAdminPermission>
	);
}
