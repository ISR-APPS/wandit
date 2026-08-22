import { createFileRoute } from "@tanstack/react-router";

import AffiliatePortalPage from "@/features/affiliates/pages/affiliate-portal-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/affiliates")({
	head: () => ({
		meta: [{ title: pageTitle("affiliates.metaTitle") }],
	}),
	component: AffiliatePortalPage,
});
