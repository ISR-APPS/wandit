import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { AiFailuresPage } from "@/features/conversations/pages/ai-failures-page";

export const Route = createFileRoute("/_dashboard/analytics/ai-failures")({
	component: AiFailuresRoute,
	head: () => ({
		meta: [{ title: "AI failures | Wandit Admin" }],
	}),
});

function AiFailuresRoute() {
	return (
		<RequireAdminPermission permission={{ conversations: ["read"] }}>
			<AiFailuresPage />
		</RequireAdminPermission>
	);
}
