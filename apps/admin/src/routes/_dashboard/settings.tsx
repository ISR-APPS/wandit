import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/features/settings/pages/settings-page";

export const Route = createFileRoute("/_dashboard/settings")({
	component: SettingsPage,
	head: () => ({
		meta: [{ title: "Settings | Wandit Admin" }],
	}),
});
