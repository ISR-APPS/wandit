import { createFileRoute } from "@tanstack/react-router";

import PrivacyPage from "@/features/legal/pages/privacy-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
	head: () => ({
		meta: [
			{ title: pageTitle("legal.privacy.meta.title") },
			{
				name: "description",
				content: pageTitle("legal.privacy.meta.description"),
			},
		],
	}),
	component: PrivacyPage,
});
