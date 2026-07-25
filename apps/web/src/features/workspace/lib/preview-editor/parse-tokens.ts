// Client-side parsing of the page's design tokens (contract §2) plus the
// curated-font helpers the theme/element panels share. Parsing is read-only
// display work — the server rewrites the real :root block through the ops
// pipeline; mirroring its "FIRST :root block of the FIRST <style> containing
// one" rule keeps what the panel shows aligned with what a save will touch.

import {
	CURATED_FONTS,
	type CuratedFont,
	type CuratedFontId,
	PAGE_TOKEN_NAMES,
	type PageTokenName,
} from "@wandit/contracts";

/**
 * Extract the token values declared on the page's `:root`. Values come back
 * RAW (any CSS the builder wrote — hex, oklch, font stacks…); callers decide
 * what they can edit (hex colors, curated fonts) vs display-only.
 */
export function parsePageTokens(
	html: string,
): Partial<Record<PageTokenName, string>> {
	const doc = new DOMParser().parseFromString(html, "text/html");
	for (const style of Array.from(doc.querySelectorAll("style"))) {
		const css = style.textContent ?? "";
		const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1];
		if (rootBlock === undefined) continue;
		const values: Partial<Record<PageTokenName, string>> = {};
		for (const name of PAGE_TOKEN_NAMES) {
			// Boundary before the dashes so --foreground never matches inside
			// --primary-foreground (and vice versa).
			const match = new RegExp(`(?:^|[\\s;{])--${name}\\s*:\\s*([^;}]+)`).exec(
				rootBlock,
			);
			const value = match?.[1]?.trim();
			if (value) values[name] = value;
		}
		return values;
	}
	return {};
}

/** First family of a CSS font stack, unquoted — `"Cairo", sans-serif` →
 *  `Cairo`. Null for empty values. */
export function extractFirstFontFamily(value: string): string | null {
	const first = value.split(",")[0]?.trim() ?? "";
	const unquoted = first.replace(/^["']|["']$/g, "").trim();
	return unquoted.length > 0 ? unquoted : null;
}

/**
 * Map a raw font token value (curated id OR CSS stack/family) to a curated
 * font id, matching families case-insensitively. Null when the page uses a
 * font outside the curated list (display-only in the panel).
 */
export function matchCuratedFontId(value: string): CuratedFontId | null {
	const direct = CURATED_FONTS.find((font) => font.id === value);
	if (direct) return direct.id as CuratedFontId;
	const family = extractFirstFontFamily(value)?.toLowerCase();
	if (!family) return null;
	const byFamily = CURATED_FONTS.find(
		(font) => font.family.toLowerCase() === family,
	);
	return byFamily ? (byFamily.id as CuratedFontId) : null;
}

/** Combined Google Fonts css2 URL for a set of curated fonts (contract §3
 *  link template) — used for the live `set-tokens` preview link. */
export function buildFontsCss2Url(fonts: readonly CuratedFont[]): string {
	const unique = new Map(fonts.map((font) => [font.id, font]));
	const specs = Array.from(unique.values(), (font) => `family=${font.css2}`);
	return `https://fonts.googleapis.com/css2?${specs.join("&")}&display=swap`;
}
