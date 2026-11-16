/**
 * Route of one starter template at `/templates/$templateId`.
 * The loader finds the id in the static catalog of packages/contracts (v2/starter-template-catalog.ts). An
 * unknown id shows the not-found screen. The parent route holds the V2 gate.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";
import { findStarterTemplate } from "@wandit/contracts/v2/starter-template-catalog";

import { StarterTemplateNotFound } from "@/features/templates/components/starter-template-not-found";
import TemplateDetailPage from "@/features/templates/pages/template-detail-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/templates/$templateId")({
	loader: ({ params }) => {
		// The build constant drops the catalog from the production bundle. The parent route redirects there first.
		const starterTemplate = __V2_BUILDER_IN_BUILD__
			? findStarterTemplate(params.templateId)
			: undefined;
		if (!starterTemplate) throw notFound();
		return starterTemplate;
	},
	head: () => ({
		meta: [{ title: pageTitle("templates.meta.title") }],
	}),
	notFoundComponent: StarterTemplateNotFound,
	component: TemplateDetailRoute,
});

function TemplateDetailRoute() {
	const starterTemplate = Route.useLoaderData();

	return <TemplateDetailPage starterTemplate={starterTemplate} />;
}
