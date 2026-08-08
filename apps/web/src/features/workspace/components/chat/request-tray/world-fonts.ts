// Loads the display faces the taste cards need, on demand. Every design
// world's preview.fontFamily is a bare Google Fonts family name; a card row
// shows at most a handful, so one css2 stylesheet request per NEW batch of
// families beats preloading the whole library. Families already requested are
// never requested again for the lifetime of the page.

const requested = new Set<string>();

/** css2 spec for one family: spaces become "+", the rest is URL-escaped. */
function familySpec(family: string): string {
	return `family=${encodeURIComponent(family).replaceAll("%20", "+")}`;
}

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
