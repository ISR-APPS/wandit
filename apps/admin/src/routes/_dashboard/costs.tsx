import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { MonthlyCostsPage } from "@/features/costs/pages/monthly-costs-page";

export const Route = createFileRoute("/_dashboard/costs")({
	component: CostsRoute,
	head: () => ({
		meta: [{ title: "Monthly costs | Wandit Admin" }],
	}),
});

function CostsRoute() {
	return (
		<RequireAdminPermission permission={{ costs: ["read"] }}>
			<MonthlyCostsPage />
		</RequireAdminPermission>
	);
}
