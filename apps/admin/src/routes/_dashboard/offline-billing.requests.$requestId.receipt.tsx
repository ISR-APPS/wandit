import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { OfflineRequestReceiptPage } from "@/features/offline-billing/pages/offline-request-receipt-page";

export const Route = createFileRoute(
	"/_dashboard/offline-billing/requests/$requestId/receipt",
)({
	component: OfflineRequestReceiptRoute,
	head: () => ({
		meta: [{ title: "Receipt | Wandit Admin" }],
	}),
});

function OfflineRequestReceiptRoute() {
	const { requestId } = Route.useParams();

	return (
		<RequireAdminPermission permission={{ billing: ["read"] }}>
			<OfflineRequestReceiptPage requestId={requestId} />
		</RequireAdminPermission>
	);
}
