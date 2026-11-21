/**
 * Route of the /trophies account page. The `_auth` parent already checked the session.
 * It renders TrophiesPage of the trophies feature.
 */
import { createFileRoute } from "@tanstack/react-router";

import TrophiesPage from "@/features/trophies/pages/trophies-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/trophies")({
	head: () => ({
		meta: [{ title: pageTitle("trophies.page.metaTitle") }],
	}),
	component: TrophiesPage,
});
