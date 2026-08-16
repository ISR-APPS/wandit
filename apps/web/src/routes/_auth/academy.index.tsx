import { createFileRoute } from "@tanstack/react-router";

import AcademyPage from "@/features/academy/pages/academy-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/academy/")({
	head: () => ({
		meta: [{ title: pageTitle("academy.meta.title") }],
	}),
	component: AcademyPage,
});
