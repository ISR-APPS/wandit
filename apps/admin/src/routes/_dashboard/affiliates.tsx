import { createFileRoute } from "@tanstack/react-router";

import { AffiliatesPage } from "@/features/affiliates/pages/affiliates-page";

export const Route = createFileRoute("/_dashboard/affiliates")({
	component: AffiliatesPage,
	head: () => ({
		meta: [{ title: "Affiliates | Wandit Admin" }],
	}),
});
