/**
 * Pure helpers of the starter templates feature: the image URLs, the live
 * preview URL, the categories in use, and the filter of the list page.
 * Called by the card and the two pages. No React and no network.
 */

import { STARTER_TEMPLATE_PREVIEW_SLUG_SUFFIX } from "@wandit/contracts";
import { starterTemplateCategories } from "@wandit/contracts/v2/starter-templates";
import type { Locale } from "@wandit/internationalization";

import type { StarterTemplate, StarterTemplateCategory } from "../api/dto";
import type { TemplatesSearch } from "./schemas";

/** URL of the cover image, 1280 x 800 px. The file is in `apps/web/public/starter-templates/<id>/`. */
export function starterTemplateCoverUrl(id: string): string {
	return `/starter-templates/${id}/cover.webp`;
}

/** URLs of the gallery images `shot-1.webp` to `shot-N.webp`, in order. N is `shots` of the catalog entry, 0 to 3. */
export function starterTemplateShotUrls(
	starterTemplate: Pick<StarterTemplate, "id" | "shots">,
): string[] {
	return Array.from(
		{ length: starterTemplate.shots },
		(_, index) =>
			`/starter-templates/${starterTemplate.id}/shot-${index + 1}.webp`,
	);
}

/**
 * URL of the live preview: one Worker per template on `<id>-template.wandit.app`.
 * `templates/starters/scripts/deploy-previews.mjs` deploys it. Every environment links to these production hosts.
 * An app opens on `/app`, so the visitor sees the sign-in page first and then the dashboard.
 */
export function starterTemplatePreviewUrl(
	starterTemplate: Pick<StarterTemplate, "id" | "kind">,
): string {
	const path = starterTemplate.kind === "app" ? "/app" : "/";
	return `https://${starterTemplate.id}${STARTER_TEMPLATE_PREVIEW_SLUG_SUFFIX}.wandit.app${path}`;
}

/** The categories that have one starter template or more, in the order of the contracts list. */
export function usedStarterTemplateCategories(
	starterTemplates: readonly StarterTemplate[],
): StarterTemplateCategory[] {
	return starterTemplateCategories.filter((category) =>
		starterTemplates.some(
			(starterTemplate) => starterTemplate.category === category,
		),
	);
}

// Lower case, with no accent and no Arabic vowel mark. So "sante" finds "Santé".
function searchFormOf(text: string): string {
	return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * The starter templates that pass the filter of the list page, in catalog order.
 * The search reads the name, the tagline and the description in the UI
 * language, and the category label. Every word of the search text must match.
 */
export function filterStarterTemplates(
	starterTemplates: readonly StarterTemplate[],
	search: TemplatesSearch,
	locale: Locale,
	/** Gives the category label in the UI language. The page passes its `t`. */
	categoryLabelOf: (category: StarterTemplateCategory) => string,
): StarterTemplate[] {
	const words = searchFormOf(search.q ?? "")
		.split(/\s+/u)
		.filter((word) => word !== "");
	return starterTemplates.filter((starterTemplate) => {
		if (search.kind !== undefined && starterTemplate.kind !== search.kind) {
			return false;
		}
		if (
			search.category !== undefined &&
			starterTemplate.category !== search.category
		) {
			return false;
		}
		const searchedText = searchFormOf(
			[
				starterTemplate.name,
				starterTemplate.tagline[locale],
				starterTemplate.description[locale],
				categoryLabelOf(starterTemplate.category),
			].join(" "),
		);
		// The words can be in different fields and in any order: "clinic health" finds a clinic of the Health category.
		return words.every((word) => searchedText.includes(word));
	});
}
