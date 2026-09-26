/**
 * Loads the display fonts of the design-world cards on demand, copied from
 * the V1 tray. Each world preview names one Google Fonts family. One css2
 * request per new batch of families; a family never loads twice. Called by
 * the world-pick body in tray-bodies.tsx.
 */

const requested = new Set<string>();

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
