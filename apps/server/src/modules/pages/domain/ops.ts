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
	PAGE_TOKEN_NAMES,
	type PageTokenName,
	PLACEHOLDER_IMAGE_SRC,
	SECTION_PADDING_CSS,
} from "@wandit/contracts";
import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";

import {
	hasOnlyInlineFormatting,
	isStampableContainer,
	isStampableLeaf,
	isTopLevelSection,
} from "./stamp";

export type ApplyOpsResult =
	| { ok: true; html: string; editedWids: string[] }
	| { ok: false; index: number; reason: string };

export type ApplyOpsContext = {
	originalTheme?: {
		values: Partial<Record<PageTokenName, string>>;
		fontLinkHrefs: string[];
	};
};

export function applyOps(
	html: string,
	ops: readonly EditOp[],
	context?: ApplyOpsContext,
): ApplyOpsResult {
	const $ = cheerio.load(html);
	const hadRootBlock = findRootBlock($) !== null;
	const editedWids = new Set<string>();
	let tokensTouched = false;
	let fontsTouched = false;
	let resetTokensTouched = false;

	for (const [index, op] of ops.entries()) {
		const reason = applyOne($, op, context);

		if (reason !== null) {
			return { index, ok: false, reason };
		}

		if (op.kind === "set-page-title") {
			// Head-level op: no wid, so it gets its own sentinel.
			editedWids.add("__title__");
		} else if (op.kind === "set-tokens" || op.kind === "reset-tokens") {
			tokensTouched = true;
			resetTokensTouched ||= op.kind === "reset-tokens";

			if (
				op.kind === "reset-tokens" ||
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
		reconcileFontLinks($, hadRootBlock && !resetTokensTouched);
	}

	return { editedWids: [...editedWids], html: $.html(), ok: true };
}

// Returns a failure reason, or null when the op applied.
function applyOne(
	$: CheerioAPI,
	op: EditOp,
	context?: ApplyOpsContext,
): string | null {
	if (op.kind === "set-tokens") {
		return applySetTokens($, op.value);
	}

	if (op.kind === "reset-tokens") {
		if (!context?.originalTheme) {
			return "no original theme is available for this page";
		}

		const reason = applyRawTokenValues($, context.originalTheme.values);

		if (reason !== null) {
			return reason;
		}

		appendOriginalFontLinks($, context.originalTheme.fontLinkHrefs);

		return null;
	}

	if (op.kind === "set-page-title") {
		return applyPageTitle($, op.value);
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
			// Array order is the dependency contract: clients must emit a descendant
			// removal before a parent text edit. Non-inline descendants fail this
			// guard; stamped inline formatting is deliberately flattened by text(),
			// so processing the text first would erase a later removal's target.
			if (!hasOnlyInlineFormatting($, match[0])) {
				return "text edits are not supported on elements with non-inline child elements";
			}

			// cheerio escapes the value — ops carry plain text, never markup.
			match.text(op.value);

			return null;
		}
		case "image-src": {
			if (!match.is("img")) {
				return "target is not an <img>";
			}

			const wasPlaceholder =
				match.attr("data-wandit-placeholder") !== undefined;

			if (wasPlaceholder) {
				restorePlaceholderImageAttributes(match);
			}

			match.attr("src", op.value);

			if (!wasPlaceholder) {
				// srcset/sizes would keep pointing at the old asset — drop them.
				match.removeAttr("srcset");
				match.removeAttr("sizes");
			}

			return null;
		}
		case "brand-logo": {
			if (!match.is(BRAND_WRAPPER_SELECTOR) || !brandRoleForTarget(match)) {
				return "target is not a brand wrapper inside header, nav, or footer";
			}

			return applyBrandLogo(match, op.value);
		}
		case "placeholder-image": {
			if (!match.is("img")) {
				return "target is not an <img>";
			}

			if (!isStampableLeaf($, match[0])) {
				return "target is not a stamped editable leaf";
			}

			if (match.attr("data-wandit-placeholder") === undefined) {
				preservePlaceholderImageAttributes(match);
			}

			if (op.value) {
				match.attr("width", String(op.value.width));
				match.attr("height", String(op.value.height));
				match.attr(
					"style",
					mergeInlineStyle(match.attr("style"), {
						"aspect-ratio": `${op.value.width} / ${op.value.height}`,
					}),
				);
			}

			match.attr("src", PLACEHOLDER_IMAGE_SRC);
			match.removeAttr("srcset");
			match.removeAttr("sizes");
			match.attr("alt", "");
			match.attr("data-wandit-placeholder", "1");

			return null;
		}
		case "element-style": {
			if (op.value.width !== undefined && !match.is("img")) {
				return "width is only supported for <img> elements";
			}

			if (op.value.objectFit !== undefined && !match.is("img")) {
				return "object-fit is only supported for <img> elements";
			}

			if (
				op.value.backgroundColor !== undefined &&
				!match.is("a, button") &&
				!isStampableContainer($, match[0]) &&
				!isTopLevelSection($, match[0])
			) {
				return "background-color is only supported for links, buttons, stampable containers, and top-level sections";
			}

			match.attr(
				"style",
				mergeInlineStyle(match.attr("style"), {
					...(op.value.backgroundColor !== undefined
						? { "background-color": op.value.backgroundColor }
						: {}),
					...(op.value.borderRadius !== undefined
						? { "border-radius": op.value.borderRadius }
						: {}),
					...(op.value.color !== undefined ? { color: op.value.color } : {}),
					...(op.value.fontFamily !== undefined
						? { "font-family": curatedFontStack(op.value.fontFamily) }
						: {}),
					...(op.value.fontSize !== undefined
						? { "font-size": op.value.fontSize }
						: {}),
					...(op.value.fontStyle !== undefined
						? { "font-style": op.value.fontStyle }
						: {}),
					...(op.value.fontWeight !== undefined
						? { "font-weight": String(op.value.fontWeight) }
						: {}),
					...(op.value.letterSpacing !== undefined
						? { "letter-spacing": op.value.letterSpacing }
						: {}),
					...(op.value.lineHeight !== undefined
						? { "line-height": String(op.value.lineHeight) }
						: {}),
					...(op.value.objectFit !== undefined
						? { "object-fit": op.value.objectFit }
						: {}),
					...(op.value.textAlign !== undefined
						? { "text-align": op.value.textAlign }
						: {}),
					...(op.value.width !== undefined ? { width: op.value.width } : {}),
				}),
			);

			return null;
		}
		case "remove-element": {
			if (!isStampableLeaf($, match[0])) {
				return "target is not a stamped editable leaf";
			}

			const form = match.closest("form").first();

			if (form.length > 0 && match.is("input, textarea")) {
				return "form input and textarea fields cannot be removed";
			}

			if (form.length > 0 && isFormSubmitControl($, match[0])) {
				let submitControlCount = 0;

				form.find("button, input").each((_, node) => {
					if (isFormSubmitControl($, node)) {
						submitControlCount += 1;
					}
				});

				if (submitControlCount === 1) {
					return "a form's only submit control cannot be removed";
				}
			}

			match.remove();

			return null;
		}
		case "set-link-href": {
			// Re-check the allowlist here (defense in depth): the AI path
			// builds EditOps with no zod schema between it and the DOM.
			if (!isSafeLinkHref(op.value)) {
				return "href must use https, http, tel:, mailto:, or a same-page #anchor";
			}

			if (!match.is("a")) {
				return "target is not an <a>";
			}

			match.attr("href", op.value);

			return null;
		}
		case "set-placeholder": {
			if (!match.is("input, textarea")) {
				return "target is not an <input> or <textarea>";
			}

			// Cheerio serializes attribute values safely; ops never carry markup.
			match.attr("placeholder", op.value);

			return null;
		}
		case "section-style": {
			if (!isTopLevelSection($, match[0])) {
				return "target is not a top-level section";
			}

			// CSS is built HERE from validated steps/URLs — the client never
			// sends raw style strings (contract §1c).
			const updates: Record<string, string | null> = {};

			if (op.value.backgroundColor !== undefined) {
				updates["background-color"] = op.value.backgroundColor;
			}

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
		case "insert-element": {
			if (
				op.position === "append" &&
				VOID_ELEMENT_TAGS.has((match.prop("tagName") ?? "").toLowerCase())
			) {
				return "append is not supported for a void element like <img> or <input> — use position before or after";
			}

			const fragment = cheerio.load(op.value, undefined, false);

			if (!hasExactlyOneElementRoot(fragment)) {
				return "inserted HTML must contain exactly one element";
			}

			const unsafe = findActiveContent(fragment, "inserted HTML");

			if (unsafe !== null) {
				return unsafe;
			}

			fragment("[data-wid]").removeAttr("data-wid");
			const insertedHtml = fragment.html() ?? "";

			switch (op.position) {
				case "before":
					match.before(insertedHtml);
					break;
				case "after":
					match.after(insertedHtml);
					break;
				case "append":
					match.append(insertedHtml);
					break;
			}

			return null;
		}
		case "insert-section": {
			if (!isTopLevelSection($, match[0])) {
				return "anchor is not a top-level section";
			}

			const fragment = cheerio.load(op.value, undefined, false);

			if (!hasExactlyOneElementRoot(fragment)) {
				return "inserted HTML must contain exactly one element";
			}

			if (!fragment.root().children().first().is(SECTIONISH_SELECTOR)) {
				return "inserted HTML root is not a section element";
			}

			const unsafe = findActiveContent(fragment, "inserted HTML");

			if (unsafe !== null) {
				return unsafe;
			}

			fragment("[data-wid]").removeAttr("data-wid");
			const insertedHtml = fragment.html() ?? "";

			if (op.position === "before") {
				match.before(insertedHtml);
			} else {
				match.after(insertedHtml);
			}

			return null;
		}
		case "replace-section": {
			// Parse the fragment on its own first: it must contain at least one
			// element and no active content except constrained embeds — the preview
			// iframe allows scripts and the same HTML ships in published pages, so
			// surgical replacements must otherwise be inert. The AI adds scripts
			// through full rebuilds, never through surgery.
			const fragment = cheerio.load(op.value, undefined, false);

			if (fragment.root().children().length === 0) {
				return "replacement HTML contains no element";
			}

			const unsafe = findActiveContent(fragment, "replacement HTML");

			if (unsafe !== null) {
				return unsafe;
			}

			match.replaceWith(op.value);

			return null;
		}
	}
}

const PLACEHOLDER_ORIGINAL_ATTRIBUTES = [
	["width", "data-wandit-orig-width"],
	["height", "data-wandit-orig-height"],
	["srcset", "data-wandit-orig-srcset"],
	["sizes", "data-wandit-orig-sizes"],
	["style", "data-wandit-orig-style"],
] as const;
const PLACEHOLDER_ORIGINAL_SNAPSHOT = "data-wandit-orig-snapshot";
const BRAND_WRAPPER_SELECTOR = "a, div, figure, article";
const BRAND_IMAGE_SELECTOR = "img[data-wandit-brand-image]";
const BRAND_ORIGINAL_HTML = "data-wandit-orig-brand-html";
const BRAND_ORIGINAL_SNAPSHOT = "data-wandit-orig-brand-snapshot";
const BRAND_LOGO_MARKER = "data-wandit-brand-logo";
const BRAND_IMAGE_STYLE =
	"display:block;width:auto;height:auto;max-width:min(12rem,40vw);" +
	"max-height:3rem;object-fit:contain;object-position:center";
const SECTIONISH_SELECTOR = "header, section, footer, aside, nav";
const VOID_ELEMENT_TAGS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

type PageElement = ReturnType<CheerioAPI>;
type PageNode = ReturnType<CheerioAPI>[number];

function applyBrandLogo(
	match: PageElement,
	value: string | null,
): string | null {
	const role = brandRoleForTarget(match);
	const existingRole = match.attr("data-brand");

	if (existingRole !== "nav" && existingRole !== "footer" && role) {
		// Legacy heuristic targets become deterministic after their first op.
		match.attr("data-brand", role);
	}

	if (value === null) {
		return restoreBrandText(match);
	}

	if (match.attr(BRAND_ORIGINAL_SNAPSHOT) !== "1") {
		match.attr(BRAND_ORIGINAL_HTML, brandSnapshotHtml(match));
		match.attr(BRAND_ORIGINAL_SNAPSHOT, "1");
	}

	let image = match.children(BRAND_IMAGE_SELECTOR).first();

	if (image.length === 0) {
		const originalHtml = match.attr(BRAND_ORIGINAL_HTML) ?? "";
		const originalText = normalizedText(
			cheerio.load(originalHtml, undefined, false).root().text(),
		);

		// Create the node through Cheerio; user-controlled values are assigned only
		// through attr(), never interpolated into markup.
		match.empty().append("<img>");
		image = match.children("img").first();
		image.attr(
			"alt",
			match.attr("aria-label") !== undefined ? "" : originalText,
		);
		image.attr("data-wandit-brand-image", "1");
		image.attr("style", BRAND_IMAGE_STYLE);
	}

	image.attr("src", value);
	match.attr(BRAND_LOGO_MARKER, "1");

	return null;
}

function brandSnapshotHtml(match: PageElement): string {
	const snapshot = match.clone();

	// Descendant wids belong to the version being edited, not to the brand
	// content itself. Restoring a snapshot must let the service's final stamp
	// pass mint identifiers for the restored tree instead of resurrecting stale
	// identifiers from an older DOM shape.
	snapshot.find("[data-wid]").removeAttr("data-wid");

	return snapshot.html() ?? "";
}

function restoreBrandText(match: PageElement): string | null {
	if (match.attr(BRAND_ORIGINAL_SNAPSHOT) === "1") {
		match.html(match.attr(BRAND_ORIGINAL_HTML) ?? "");
		clearBrandSwapAttributes(match);

		return null;
	}

	const wanditImage = match.children(BRAND_IMAGE_SELECTOR).first();
	const image =
		wanditImage.length > 0 ? wanditImage : match.find("img").first();
	const hasLogo =
		image.length > 0 || match.attr(BRAND_LOGO_MARKER) !== undefined;

	if (!hasLogo) {
		// A second restore after the snapshot was already consumed is a no-op.
		return null;
	}

	const fallback =
		normalizedText(match.attr("aria-label") ?? "") ||
		normalizedText(image.attr("alt") ?? "");

	if (!fallback) {
		return "no original brand text to restore";
	}

	match.text(fallback);
	clearBrandSwapAttributes(match);

	return null;
}

function clearBrandSwapAttributes(match: PageElement): void {
	match.removeAttr(BRAND_LOGO_MARKER);
	match.removeAttr(BRAND_ORIGINAL_HTML);
	match.removeAttr(BRAND_ORIGINAL_SNAPSHOT);
}

function brandRoleForTarget(match: PageElement): "footer" | "nav" | null {
	if (match.parents("footer").length > 0) {
		return "footer";
	}

	if (match.parents("nav, header").length > 0) {
		return "nav";
	}

	return null;
}

function normalizedText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function preservePlaceholderImageAttributes(match: PageElement): void {
	for (const [
		attribute,
		originalAttribute,
	] of PLACEHOLDER_ORIGINAL_ATTRIBUTES) {
		const value = match.attr(attribute);

		if (value === undefined) {
			match.removeAttr(originalAttribute);
		} else {
			// Cheerio handles attribute quoting/escaping, including srcset URLs.
			match.attr(originalAttribute, value);
		}
	}

	// The sentinel distinguishes a new snapshot whose original image had none
	// of the tracked attrs from placeholders saved before snapshots existed.
	match.attr(PLACEHOLDER_ORIGINAL_SNAPSHOT, "1");
}

function restorePlaceholderImageAttributes(match: PageElement): void {
	if (match.attr(PLACEHOLDER_ORIGINAL_SNAPSHOT) === "1") {
		for (const [
			attribute,
			originalAttribute,
		] of PLACEHOLDER_ORIGINAL_ATTRIBUTES) {
			const value = match.attr(originalAttribute);

			if (value === undefined) {
				match.removeAttr(attribute);
			} else {
				match.attr(attribute, value);
			}
		}
	} else {
		// Backward compatibility for placeholders saved before original attrs
		// were captured: retain unrelated inline styles where possible.
		match.removeAttr("width");
		match.removeAttr("height");
		match.removeAttr("srcset");
		match.removeAttr("sizes");
		const style = mergeInlineStyle(match.attr("style"), {
			"aspect-ratio": null,
		});

		if (style) {
			match.attr("style", style);
		} else {
			match.removeAttr("style");
		}
	}

	for (const [, originalAttribute] of PLACEHOLDER_ORIGINAL_ATTRIBUTES) {
		match.removeAttr(originalAttribute);
	}

	match.removeAttr(PLACEHOLDER_ORIGINAL_SNAPSHOT);
	match.removeAttr("data-wandit-placeholder");
}

function isFormSubmitControl(
	$: CheerioAPI,
	node: PageNode | undefined,
): boolean {
	if (!node) {
		return false;
	}

	const element = $(node);
	const type = (element.attr("type") ?? "").trim().toLowerCase();

	if (element.is("button")) {
		// Missing and invalid button types use the browser's submit default.
		return type !== "button" && type !== "reset";
	}

	return element.is("input") && (type === "submit" || type === "image");
}

// Elements that execute or load active content — never legitimate inside a
// page SECTION (head-level tags included: a fragment has no business
// carrying them, and <link>/<meta>/<base> can rewrite page behavior).
const FORBIDDEN_FRAGMENT_TAGS = new Set([
	"base",
	"embed",
	"frame",
	"frameset",
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

function isAllowedIframeEmbedUrl(value: string | undefined): boolean {
	if (value === undefined) {
		return false;
	}

	const trimmed = value.trim();
	const authority = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(trimmed)?.[1];

	if (authority === undefined) {
		return false;
	}

	let url: URL;

	try {
		url = new URL(trimmed);
	} catch {
		return false;
	}

	if (
		url.protocol !== "https:" ||
		url.username !== "" ||
		url.password !== "" ||
		url.port !== "" ||
		authority.toLowerCase() !== url.hostname.toLowerCase()
	) {
		return false;
	}

	switch (url.hostname.toLowerCase()) {
		case "www.youtube.com":
		case "www.youtube-nocookie.com":
			return /^\/embed\/[^/]+$/.test(url.pathname);
		case "player.vimeo.com":
			return /^\/video\/\d+$/.test(url.pathname);
		case "www.google.com":
			return (
				url.pathname === "/maps/embed" ||
				url.pathname.startsWith("/maps/embed/")
			);
		case "maps.google.com":
			return url.pathname === "/maps/embed" || url.pathname === "/embed";
		default:
			return false;
	}
}

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

function hasExactlyOneElementRoot($: CheerioAPI): boolean {
	if ($.root().children().length !== 1) {
		return false;
	}

	return $.root()
		.contents()
		.toArray()
		.every((node) => node.type !== "text" || $(node).text().trim() === "");
}

/**
 * Stored-XSS guard for raw-HTML fragments: returns a relayable rejection
 * reason when the fragment carries active content (script-bearing elements,
 * event-handler attributes, script-scheme URLs, srcdoc, CSS @import). It
 * permits no active content except constrained embeds. Rejection over
 * stripping — the model retries with clean markup instead of silently losing
 * what it wrote.
 */
function findActiveContent(
	$: CheerioAPI,
	fragmentLabel: "inserted HTML" | "replacement HTML",
): string | null {
	let reason: string | null = null;

	$("*").each((_, node) => {
		if (reason !== null) {
			return;
		}

		const element = $(node);
		const tag = (element.prop("tagName") ?? "").toLowerCase();

		if (FORBIDDEN_FRAGMENT_TAGS.has(tag)) {
			reason = `${fragmentLabel} must not contain <${tag}> elements`;

			return;
		}

		for (const [name, value] of Object.entries(element.attr() ?? {})) {
			const lowered = name.toLowerCase();

			if (lowered.startsWith("on")) {
				reason = `${fragmentLabel} must not carry event-handler attributes ("${name}")`;

				return;
			}

			if (lowered === "srcdoc") {
				reason = `${fragmentLabel} must not carry "srcdoc" attributes`;

				return;
			}

			if (URL_ATTRIBUTES.has(lowered)) {
				const compact = compactUrl(value);

				if (
					compact.startsWith("javascript:") ||
					compact.startsWith("vbscript:") ||
					compact.startsWith("data:text/html")
				) {
					reason = `${fragmentLabel} must not use script-scheme URLs ("${name}")`;

					return;
				}
			}
		}

		if (tag === "iframe" && !isAllowedIframeEmbedUrl(element.attr("src"))) {
			reason = `${fragmentLabel} <iframe> src must be an allowed HTTPS embed URL (YouTube, Vimeo, or Google Maps)`;

			return;
		}

		if (tag === "style" && /@import/i.test(element.text())) {
			reason = `${fragmentLabel} must not use CSS @import`;
		}
	});

	return reason;
}

// Frozen CSS url() escaping (backslash FIRST, then double quote). Characters
// that can break the conservative inline-style parser are percent-encoded.
function escapeCssUrlValue(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/;/g, "%3B")
		.replace(/\(/g, "%28")
		.replace(/\)/g, "%29");
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

function ensureRootBlock(
	$: CheerioAPI,
): NonNullable<ReturnType<typeof findRootBlock>> {
	const existing = findRootBlock($);

	if (existing) {
		return existing;
	}

	const firstStyle = $("style").first();

	if (firstStyle.length > 0) {
		firstStyle.text(`:root {\n}\n${firstStyle.text()}`);
	} else {
		$("head").first().prepend("<style>:root {\n}</style>");
	}

	const injected = findRootBlock($);

	if (!injected) {
		throw new Error("failed to inject :root token block");
	}

	return injected;
}

// Document <title> (the browser tab). The lookup is scoped to the head so an
// inline SVG <title> in the body is never touched, and the value goes through
// text() — cheerio escapes it, so a "</title><script>" value stays inert.
function applyPageTitle($: CheerioAPI, value: string): string | null {
	const head = $("head").first();

	if (head.length === 0) {
		return "this page has no <head> element";
	}

	let title = head.children("title").first();

	if (title.length === 0) {
		// Appended, never prepended: <meta charset> must stay first in the head.
		head.append("<title></title>");
		title = head.children("title").last();
	}

	title.text(value);

	return null;
}

function applySetTokens(
	$: CheerioAPI,
	value: Partial<Record<PageTokenName, string>>,
): string | null {
	const root = ensureRootBlock($);

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

function applyRawTokenValues(
	$: CheerioAPI,
	value: Partial<Record<PageTokenName, string>>,
): string | null {
	const root = ensureRootBlock($);
	let block = root.text.slice(root.open + 1, root.close);

	for (const [name, raw] of Object.entries(value)) {
		if (raw === undefined) {
			continue;
		}

		if (raw.includes("<")) {
			return `original theme token --${name} is unsafe`;
		}

		const declaration = new RegExp(`--${name}\\s*:[^;}]*;?`);

		block = declaration.test(block)
			? block.replace(declaration, `--${name}: ${raw};`)
			: `${block.trimEnd()}\n  --${name}: ${raw};\n`;
	}

	root.setText(
		root.text.slice(0, root.open + 1) + block + root.text.slice(root.close),
	);

	return null;
}

/** Raw values from the first :root block — the same target token ops rewrite. */
export function extractRootTokens(
	html: string,
): Partial<Record<PageTokenName, string>> {
	const $ = cheerio.load(html);
	const root = findRootBlock($);

	if (!root) {
		return {};
	}

	const block = root.text.slice(root.open + 1, root.close);
	const values: Partial<Record<PageTokenName, string>> = {};

	for (const name of PAGE_TOKEN_NAMES) {
		const value = readTokenValue(block, name);

		if (value !== null) {
			values[name] = value;
		}
	}

	return values;
}

function appendOriginalFontLinks($: CheerioAPI, hrefs: string[]): void {
	if (hrefs.length === 0) {
		return;
	}

	const head = $("head").first();

	if (head.length === 0) {
		return;
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

	for (const href of hrefs) {
		if ($(`link[rel="stylesheet"][href="${href}"]`).length === 0) {
			head.append(
				cheerio
					.load(
						"<link>",
						undefined,
						false,
					)("link")
					.attr({ href, rel: "stylesheet" }),
			);
		}
	}
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
function reconcileFontLinks(
	$: CheerioAPI,
	mayReplaceExistingLinks: boolean,
): void {
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

	// An injected token block on a legacy page is not consumed by its existing
	// hard-coded font-family rules. Keep those pages' original font links and
	// add the curated families instead of silently breaking their typography.
	if (mayReplaceExistingLinks && headingFont && bodyFont) {
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
