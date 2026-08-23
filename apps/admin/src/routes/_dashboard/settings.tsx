import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { SettingsPage } from "@/features/settings/pages/settings-page";

export const Route = createFileRoute("/_dashboard/settings")({
	component: SettingsRoute,
	head: () => ({
		meta: [{ title: "Settings | Wandit Admin" }],
	}),
});

function SettingsRoute() {
	return (
		<RequireAdminPermission permission={{ settings: ["read"] }}>
			<SettingsPage />
		</RequireAdminPermission>
	);
}
