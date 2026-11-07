/**
 * Loads the fonts of the tray cards on demand. The world part is copied from
 * the V1 tray: each world preview names one Google Fonts family, and one css2
 * request loads each new batch of families. A theme card names the full
 * stylesheet URLs of its faces instead. A family or a URL never loads twice.
 * Called by the world-pick body in tray-bodies.tsx and by theme-mockup.tsx.
 */

const requested = new Set<string>();
/** The stylesheet URLs of the theme fonts that this page requested. */
const requestedHrefs = new Set<string>();

/** css2 spec of one family: spaces become "+", the rest is URL-escaped. */
function familySpec(family: string): string {
	return `family=${encodeURIComponent(family).replaceAll("%20", "+")}`;
}

/** Adds one stylesheet link for the families this page did not request yet. */
export function ensureWorldFontsLoaded(families: readonly string[]): void {
	const fresh = [...new Set(families)].filter(
		(family) => family.length > 0 && !requested.has(family),
	);
	if (fresh.length === 0) return;
	for (const family of fresh) requested.add(family);

	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = `https://fonts.googleapis.com/css2?${fresh
		.map(familySpec)
		.join("&")}&display=swap`;
	link.dataset.wanditWorldFonts = fresh.join(",");
	document.head.appendChild(link);
}

/**
 * Adds one stylesheet link per theme font URL that this page did not request
 * yet. The theme schema of contracts allows only Google Fonts and Fontshare URLs.
 */
export function ensureFontStylesheetsLoaded(hrefs: readonly string[]): void {
	for (const href of hrefs) {
		if (requestedHrefs.has(href)) continue;
		requestedHrefs.add(href);
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = href;
		document.head.appendChild(link);
	}
}
