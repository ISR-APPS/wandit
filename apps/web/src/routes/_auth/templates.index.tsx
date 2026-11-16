/**
 * Route of the starter template list at `/templates`.
 * It validates the filter state `?q=&kind=&category=` and renders the list page.
 * The parent route `/templates` holds the V2 gate.
 */
import { createFileRoute } from "@tanstack/react-router";

import { templatesSearchSchema } from "@/features/templates/lib/schemas";
import TemplatesPage from "@/features/templates/pages/templates-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/templates/")({
	// The search schema is on this leaf route only: `_auth` must keep the raw query for the OAuth pages.
	validateSearch: (search: Record<string, unknown>) =>
		templatesSearchSchema.parse(search),
	head: () => ({
		meta: [{ title: pageTitle("templates.meta.title") }],
	}),
	component: TemplatesRoute,
});

function TemplatesRoute() {
	const search = Route.useSearch();

	return <TemplatesPage search={search} />;
}
