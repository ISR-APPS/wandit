// The admin app exposes only the API origin, not the product web origin.
// Keep shared story links on Wandit's canonical public origin.
export const STORY_LINK_WEB_ORIGIN = "https://wandit.dev";

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
	webOrigin = STORY_LINK_WEB_ORIGIN,
): string {
	return `${webOrigin.replace(/\/+$/g, "")}/s/${encodeURIComponent(slug)}`;
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
