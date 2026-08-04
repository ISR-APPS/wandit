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

import { cssColorToHex } from "./contrast";

export type PageColorScheme = "light" | "dark" | null;

export type ParsedPageTheme = {
	tokens: Partial<Record<PageTokenName, string>>;
	colorScheme: PageColorScheme;
};

const GOOGLE_FONT_STYLESHEET_PREFIX = "https://fonts.googleapis.com/";

function hasUrlWhitespaceOrControl(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code <= 0x20 || code === 0x7f) return true;
	}
	return false;
}

function isGoogleFontStylesheetHref(href: string): boolean {
	if (
		!href.startsWith(GOOGLE_FONT_STYLESHEET_PREFIX) ||
		hasUrlWhitespaceOrControl(href)
	) {
		return false;
	}

	try {
		return new URL(href).origin === "https://fonts.googleapis.com";
	} catch {
		return false;
	}
}

/** Builder-origin Google Fonts stylesheets used by reset-token live preview.
 * The strict host prefix matches the postMessage protocol allowlist. */
export function extractGoogleFontStylesheetHrefs(html: string): string[] {
	let hrefs: string[];

	if (typeof DOMParser !== "undefined") {
		const doc = new DOMParser().parseFromString(html, "text/html");
		hrefs = Array.from(
			doc.querySelectorAll('link[rel~="stylesheet"][href]'),
			(link) => link.getAttribute("href") ?? "",
		);
	} else {
		hrefs = Array.from(html.matchAll(/<link\b[^>]*>/gi)).flatMap(([tag]) => {
			const rel = readHtmlAttribute(tag, "rel");
			const href = readHtmlAttribute(tag, "href");
			return rel?.split(/\s+/).some((value) => value === "stylesheet") && href
				? [decodeHtmlAttribute(href)]
				: [];
		});
	}

	return [...new Set(hrefs.filter((href) => isGoogleFontStylesheetHref(href)))];
}

function readHtmlAttribute(tag: string, name: string): string | null {
	const match = new RegExp(
		`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
		"i",
	).exec(tag);
	return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function decodeHtmlAttribute(value: string): string {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">");
}

function styleContents(html: string): string[] {
	// DOMParser is authoritative in the browser. The fallback keeps this pure
	// parser testable in Vitest's Node environment without adding jsdom.
	if (typeof DOMParser !== "undefined") {
		const doc = new DOMParser().parseFromString(html, "text/html");
		return Array.from(
			doc.querySelectorAll("style"),
			(style) => style.textContent ?? "",
		);
	}

	return Array.from(
		html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi),
		(match) => match[1] ?? "",
	);
}

function parseColorScheme(rootBlock: string): PageColorScheme {
	const value = /(?:^|[\s;{])color-scheme\s*:\s*([^;}]+)/i
		.exec(rootBlock)?.[1]
		?.trim()
		.toLowerCase();
	if (!value) return null;

	// `color-scheme: light dark` is valid CSS and expresses its preferred
	// scheme first. `only dark` is also valid, hence token rather than exact
	// value matching.
	const schemes = value.match(/\b(?:light|dark)\b/g);
	const preferred = schemes?.[0];
	return preferred === "light" || preferred === "dark" ? preferred : null;
}

/**
 * Parse the fixed token contract and preferred color scheme from the first
 * `:root` block of the first style element containing one. This deliberately
 * mirrors the server token rewrite target, so the panel never describes a
 * different block from the one a save will mutate.
 */
export function parsePageTheme(html: string): ParsedPageTheme {
	for (const css of styleContents(html)) {
		const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1];
		if (rootBlock === undefined) continue;
		const tokens: Partial<Record<PageTokenName, string>> = {};
		for (const name of PAGE_TOKEN_NAMES) {
			// Boundary before the dashes so --foreground never matches inside
			// --primary-foreground (and vice versa).
			const match = new RegExp(`(?:^|[\\s;{])--${name}\\s*:\\s*([^;}]+)`).exec(
				rootBlock,
			);
			const value = match?.[1]?.trim();
			if (value) tokens[name] = value;
		}
		return { tokens, colorScheme: parseColorScheme(rootBlock) };
	}
	return { tokens: {}, colorScheme: null };
}

/**
 * Extract the token values declared on the page's `:root`. Values come back
 * RAW (any CSS the builder wrote — hex, oklch, font stacks…); callers decide
 * what they can edit (hex colors, curated fonts) vs display-only.
 */
export function parsePageTokens(
	html: string,
): Partial<Record<PageTokenName, string>> {
	return parsePageTheme(html).tokens;
}

/**
 * New token-era pages are finish-gated on all 11 contract declarations.
 * Requiring that complete signature prevents a legacy page with one or two
 * coincidentally named CSS variables from creating ineffective edit versions.
 */
export function hasCompletePageTheme(
	tokens: Partial<Record<PageTokenName, string>>,
): boolean {
	return PAGE_TOKEN_NAMES.every((name) => Boolean(tokens[name]?.trim()));
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

export function normalizeTokenValue(
	name: PageTokenName,
	value: string,
): string {
	if (name === "font-heading" || name === "font-body") {
		return matchCuratedFontId(value) ?? value;
	}
	return cssColorToHex(value) ?? value.trim().toLowerCase();
}

/** Compare complete themes after normalizing editable color/font forms. */
export function tokensEqual(
	left: Partial<Record<PageTokenName, string>>,
	right: Partial<Record<PageTokenName, string>>,
): boolean {
	return PAGE_TOKEN_NAMES.every((name) => {
		const leftValue = left[name];
		const rightValue = right[name];
		return (
			leftValue !== undefined &&
			rightValue !== undefined &&
			normalizeTokenValue(name, leftValue) ===
				normalizeTokenValue(name, rightValue)
		);
	});
}

/** Combined Google Fonts css2 URL for a set of curated fonts (contract §3
 *  link template) — used for the live `set-tokens` preview link. */
export function buildFontsCss2Url(fonts: readonly CuratedFont[]): string {
	const unique = new Map(fonts.map((font) => [font.id, font]));
	const specs = Array.from(unique.values(), (font) => `family=${font.css2}`);
	return `https://fonts.googleapis.com/css2?${specs.join("&")}&display=swap`;
}
