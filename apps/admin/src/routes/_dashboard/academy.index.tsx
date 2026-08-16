import { createFileRoute } from "@tanstack/react-router";

import { AcademyPage } from "@/features/academy/pages/academy-page";

export const Route = createFileRoute("/_dashboard/academy/")({
	component: AcademyPage,
	head: () => ({
		meta: [{ title: "Academy | Wandit Admin" }],
	}),
});
