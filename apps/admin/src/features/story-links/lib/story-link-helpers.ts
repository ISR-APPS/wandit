import { WEB_APP_ORIGIN } from "@/lib/web-origin";

// The admin app exposes only the API origin, not the product web origin.
// Keep shared story links on Wandit's canonical public origin.
export { WEB_APP_ORIGIN as STORY_LINK_WEB_ORIGIN };

type SortableStoryLink = {
	archivedAt: string | null;
};

export function suggestStoryLinkSlug(name: string): string {
	return name
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 64)
		.replace(/-+$/g, "");
}

export function buildStoryLinkUrl(
	slug: string,
	webOrigin = WEB_APP_ORIGIN,
): string {
	return `${webOrigin.replace(/\/+$/g, "")}/s/${encodeURIComponent(slug)}`;
}

export function formatStoryLinkConversionRate(
	numerator: number,
	denominator: number,
	locale = "en-US",
): string {
	if (denominator === 0) {
		return "—";
	}

	return new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(numerator / denominator);
}

export function sortStoryLinksArchivedLast<T extends SortableStoryLink>(
	links: readonly T[],
): T[] {
	return links.toSorted((left, right) => {
		const archivedOrder =
			Number(left.archivedAt !== null) - Number(right.archivedAt !== null);
		if (archivedOrder !== 0) {
			return archivedOrder;
		}

		return 0;
	});
}
