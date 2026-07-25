/**
 * Edit-ops application (V2 contract §6 + §3 font reconciliation).
 *
 * Applies one batch of edit ops to a page's HTML in array order, on one
 * in-memory DOM. All-or-nothing: the first failing op aborts the batch and
 * the caller writes nothing. The caller re-runs stampHtml on the returned
 * HTML — this module stays single-purpose.
 *
 * Plain functions, NO NestJS imports (shared philosophy with stamp.ts).
 * Env-dependent validation (image-src / section background URL origins)
 * lives in the SERVICE, not here — this module stays env-free.
 */
import {
	CURATED_FONTS,
	type CuratedFont,
	curatedFontStack,
	type EditOp,
	isSafeLinkHref,
	type PageTokenName,
	SECTION_PADDING_CSS,
} from "@wandit/contracts";
import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";

import { TOP_LEVEL_SECTION_SELECTOR } from "./stamp";

export type ApplyOpsResult =
	| { ok: true; html: string; editedWids: string[] }
	| { ok: false; index: number; reason: string };

export function applyOps(html: string, ops: readonly EditOp[]): ApplyOpsResult {
	const $ = cheerio.load(html);
	const editedWids = new Set<string>();
	let tokensTouched = false;
	let fontsTouched = false;

	for (const [index, op] of ops.entries()) {
		const reason = applyOne($, op);

		if (reason !== null) {
			return { index, ok: false, reason };
		}

		if (op.kind === "set-tokens") {
			tokensTouched = true;

			if (
				op.value["font-heading"] !== undefined ||
				op.value["font-body"] !== undefined
			) {
				fontsTouched = true;
			}
		} else {
			editedWids.add(op.wid);

			if (op.kind === "element-style" && op.value.fontFamily !== undefined) {
				fontsTouched = true;
			}
		}
	}

	if (tokensTouched) {
		editedWids.add("__tokens__");
	}

	// Google Fonts links are only reconciled when a font-affecting op ran —
	// otherwise the head is left untouched (contract §3).
	if (fontsTouched) {
		reconcileFontLinks($);
	}

	return { editedWids: [...editedWids], html: $.html(), ok: true };
}

// Returns a failure reason, or null when the op applied.
function applyOne($: CheerioAPI, op: EditOp): string | null {
	if (op.kind === "set-tokens") {
		return applySetTokens($, op.value);
	}

	const match = $(`[data-wid="${op.wid}"]`);

	if (match.length === 0) {
		return `no element with data-wid="${op.wid}"`;
	}

	if (match.length > 1) {
		return `data-wid "${op.wid}" is not unique`;
	}

	switch (op.kind) {
		case "text": {
			// cheerio escapes the value — ops carry plain text, never markup.
			match.text(op.value);

			return null;
		}
		case "image-src": {
			if (!match.is("img")) {
				return "target is not an <img>";
			}

			// srcset/sizes would keep pointing at the old asset — drop them.
			match.attr("src", op.value);
			match.removeAttr("srcset");
			match.removeAttr("sizes");

			return null;
		}
		case "element-style": {
			match.attr(
				"style",
				mergeInlineStyle(match.attr("style"), {
					...(op.value.color !== undefined ? { color: op.value.color } : {}),
					...(op.value.fontSize !== undefined
						? { "font-size": op.value.fontSize }
						: {}),
					...(op.value.fontFamily !== undefined
						? { "font-family": curatedFontStack(op.value.fontFamily) }
						: {}),
				}),
			);

			return null;
		}
		case "remove-element": {
			// Only <img> removal for now — deleting text/sections from the
			// inspector is a bigger product decision than dropping media.
			if (!match.is("img")) {
				return "removal is only supported for <img> elements";
			}

			match.remove();

			return null;
		}
		case "set-link-href": {
			// Re-check the allowlist here (defense in depth): the AI path
			// builds EditOps with no zod schema between it and the DOM.
			if (!isSafeLinkHref(op.value)) {
				return "href must use https, http, tel: or mailto:";
			}

			if (!match.is("a")) {
				return "target is not an <a>";
			}

			match.attr("href", op.value);

			return null;
		}
		case "section-style": {
			if (!match.is(TOP_LEVEL_SECTION_SELECTOR)) {
				return "target is not a top-level section";
			}

			// CSS is built HERE from validated steps/URLs — the client never
			// sends raw style strings (contract §1c).
			const updates: Record<string, string | null> = {};

			if (op.value.paddingTop !== undefined) {
				updates["padding-top"] = SECTION_PADDING_CSS[op.value.paddingTop];
			}

			if (op.value.paddingBottom !== undefined) {
				updates["padding-bottom"] = SECTION_PADDING_CSS[op.value.paddingBottom];
			}

			if (op.value.backgroundImage === "none") {
				// Clearing writes an EXPLICIT inline "none" (not a property
				// delete): builder backgrounds usually come from stylesheet
				// rules, which a delete would let resurface. The cover/center
				// companions the setter branch writes are dropped.
				updates["background-image"] = "none";
				updates["background-size"] = null;
				updates["background-position"] = null;
			} else if (op.value.backgroundImage !== undefined) {
				updates["background-image"] =
					`url("${escapeCssUrlValue(op.value.backgroundImage)}")`;
				updates["background-size"] = "cover";
				updates["background-position"] = "center";
			}

			match.attr("style", mergeInlineStyle(match.attr("style"), updates));

			return null;
		}
		case "replace-section": {
			// Parse the fragment on its own first: it must contain at least one
			// element and no ACTIVE content — the preview iframe allows scripts
			// and the same HTML ships in published pages, so surgical
			// replacements must be inert. The AI adds scripts through full
			// rebuilds, never through surgery.
			const fragment = cheerio.load(op.value, undefined, false);

			if (fragment.root().children().length === 0) {
				return "replacement HTML contains no element";
			}

			const unsafe = findActiveContent(fragment);

			if (unsafe !== null) {
				return unsafe;
			}

			match.replaceWith(op.value);

			return null;
		}
	}
}

// Elements that execute or load active content — never legitimate inside a
// page SECTION (head-level tags included: a fragment has no business
// carrying them, and <link>/<meta>/<base> can rewrite page behavior).
const FORBIDDEN_FRAGMENT_TAGS = new Set([
	"base",
	"embed",
	"frame",
	"frameset",
	"iframe",
	"link",
	"meta",
	"object",
	"script",
]);

// Attributes whose value is a URL a browser may navigate/execute.
const URL_ATTRIBUTES = new Set([
	"action",
	"data",
	"formaction",
	"href",
	"src",
	"xlink:href",
]);

// Browsers strip ASCII whitespace/control characters inside URL schemes
// ("java\tscript:" runs) — compact before the scheme check.
function compactUrl(value: string): string {
	let out = "";

	for (const char of value) {
		if (char.charCodeAt(0) > 0x20) {
			out += char;
		}
	}

	return out.toLowerCase();
}

/**
 * Stored-XSS guard for replace-section fragments: returns a relayable
 * rejection reason when the fragment carries active content (script-bearing
 * elements, event-handler attributes, script-scheme URLs, srcdoc, CSS
 * @import), or null when it is inert. Rejection over stripping — the model
 * retries with clean markup instead of silently losing what it wrote.
 */
function findActiveContent($: CheerioAPI): string | null {
	let reason: string | null = null;

	$("*").each((_, node) => {
		if (reason !== null) {
			return;
		}

		const element = $(node);
		const tag = (element.prop("tagName") ?? "").toLowerCase();

		if (FORBIDDEN_FRAGMENT_TAGS.has(tag)) {
			reason = `replacement HTML must not contain <${tag}> elements`;

			return;
		}

		for (const [name, value] of Object.entries(element.attr() ?? {})) {
			const lowered = name.toLowerCase();

			if (lowered.startsWith("on")) {
				reason = `replacement HTML must not carry event-handler attributes ("${name}")`;

				return;
			}

			if (lowered === "srcdoc") {
				reason = 'replacement HTML must not carry "srcdoc" attributes';

				return;
			}

			if (URL_ATTRIBUTES.has(lowered)) {
				const compact = compactUrl(value);

				if (
					compact.startsWith("javascript:") ||
					compact.startsWith("vbscript:") ||
					compact.startsWith("data:text/html")
				) {
					reason = `replacement HTML must not use script-scheme URLs ("${name}")`;

					return;
				}
			}
		}

		if (tag === "style" && /@import/i.test(element.text())) {
			reason = "replacement HTML must not use CSS @import";
		}
	});

	return reason;
}

// Frozen CSS url() escaping (backslash FIRST, then double quote) — only
// section-style background images go through it.
function escapeCssUrlValue(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Merge updates into an existing inline style attribute; a null update value
// DELETES the property. Conservative parsing (split on ";" then first ":") —
// inline styles the editor writes never carry values containing semicolons.
function mergeInlineStyle(
	existing: string | undefined,
	updates: Record<string, string | null>,
): string {
	const properties = new Map<string, string>();

	for (const declaration of (existing ?? "").split(";")) {
		const colon = declaration.indexOf(":");

		if (colon === -1) {
			continue;
		}

		const name = declaration.slice(0, colon).trim().toLowerCase();
		const value = declaration.slice(colon + 1).trim();

		if (name && value) {
			properties.set(name, value);
		}
	}

	for (const [name, value] of Object.entries(updates)) {
		if (value === null) {
			properties.delete(name);
		} else {
			properties.set(name, value);
		}
	}

	return [...properties.entries()]
		.map(([name, value]) => `${name}: ${value}`)
		.join("; ");
}

// The first <style> element whose text contains a :root block, plus the
// block's boundaries inside that text.
function findRootBlock($: CheerioAPI): {
	close: number;
	open: number;
	setText: (next: string) => void;
	text: string;
} | null {
	let found: ReturnType<typeof findRootBlock> = null;

	$("style").each((_, node) => {
		if (found) {
			return;
		}

		const styleElement = $(node);
		const text = styleElement.text();
		const rootIndex = text.indexOf(":root");

		if (rootIndex === -1) {
			return;
		}

		const open = text.indexOf("{", rootIndex);

		if (open === -1) {
			return;
		}

		const close = text.indexOf("}", open);

		if (close === -1) {
			return;
		}

		found = {
			close,
			open,
			setText: (next: string) => {
				styleElement.text(next);
			},
			text,
		};
	});

	return found;
}

function applySetTokens(
	$: CheerioAPI,
	value: Partial<Record<PageTokenName, string>>,
): string | null {
	const root = findRootBlock($);

	if (!root) {
		// Legacy pre-V2 versions have no token block to rewrite.
		return "no :root token block found";
	}

	let block = root.text.slice(root.open + 1, root.close);

	for (const [name, raw] of Object.entries(value)) {
		if (raw === undefined) {
			continue;
		}

		// Fonts arrive as curated ids; colors/radius are written verbatim.
		const cssValue =
			name === "font-heading" || name === "font-body"
				? curatedFontStack(raw)
				: raw;
		// `\s*:` keeps --primary from matching --primary-foreground (the next
		// character there is "-", not a colon).
		const declaration = new RegExp(`--${name}\\s*:[^;}]*;?`);

		block = declaration.test(block)
			? block.replace(declaration, `--${name}: ${cssValue};`)
			: `${block.trimEnd()}\n  --${name}: ${cssValue};\n`;
	}

	root.setText(
		root.text.slice(0, root.open + 1) + block + root.text.slice(root.close),
	);

	return null;
}

function curatedFontByFamily(family: string): CuratedFont | undefined {
	const wanted = family.trim().toLowerCase();

	return CURATED_FONTS.find((font) => font.family.toLowerCase() === wanted);
}

// First double-quoted family name in a font token value / font-family stack.
function parseQuotedFamily(value: string | null): string | null {
	if (!value) {
		return null;
	}

	return /"([^"]+)"/.exec(value)?.[1] ?? null;
}

function readTokenValue(block: string, name: string): string | null {
	return (
		new RegExp(`--${name}\\s*:\\s*([^;}]*)`).exec(block)?.[1]?.trim() ?? null
	);
}

/**
 * Google Fonts link reconciliation (contract §3). Safe rule: only REPLACE
 * the existing links when BOTH font tokens resolve to curated families —
 * otherwise a builder-chosen non-curated family still referenced by an
 * unchanged token would lose its stylesheet. In that case the combined
 * curated link is ADDED and existing links stay.
 */
function reconcileFontLinks($: CheerioAPI): void {
	const root = findRootBlock($);
	const block = root ? root.text.slice(root.open + 1, root.close) : "";
	const headingFont = curatedFontFromToken(block, "font-heading");
	const bodyFont = curatedFontFromToken(block, "font-body");

	// Insertion-ordered map: heading, body, then inline pins.
	const needed = new Map<string, CuratedFont>();

	if (headingFont) {
		needed.set(headingFont.id, headingFont);
	}

	if (bodyFont) {
		needed.set(bodyFont.id, bodyFont);
	}

	// Families pinned by element-style overrides anywhere in the document.
	$("[style]").each((_, node) => {
		const style = $(node).attr("style") ?? "";
		const family = /font-family\s*:\s*"([^"]+)"/i.exec(style)?.[1];
		const font = family ? curatedFontByFamily(family) : undefined;

		if (font) {
			needed.set(font.id, font);
		}
	});

	if (needed.size === 0) {
		return;
	}

	const head = $("head");

	if (head.length === 0) {
		return;
	}

	if (headingFont && bodyFont) {
		$('link[href*="fonts.googleapis.com/css"]').remove();
	}

	if (
		$('link[rel="preconnect"][href="https://fonts.googleapis.com"]').length ===
		0
	) {
		head.append('<link rel="preconnect" href="https://fonts.googleapis.com">');
	}

	if (
		$('link[rel="preconnect"][href="https://fonts.gstatic.com"]').length === 0
	) {
		head.append(
			'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
		);
	}

	const href = `https://fonts.googleapis.com/css2?${[...needed.values()]
		.map((font) => `family=${font.css2}`)
		.join("&")}&display=swap`;

	// Never accumulate identical links across repeated saves.
	$(`link[href="${href}"]`).remove();
	head.append(`<link rel="stylesheet" href="${href}">`);
}

function curatedFontFromToken(
	block: string,
	name: "font-heading" | "font-body",
): CuratedFont | undefined {
	const family = parseQuotedFamily(readTokenValue(block, name));

	return family ? curatedFontByFamily(family) : undefined;
}
