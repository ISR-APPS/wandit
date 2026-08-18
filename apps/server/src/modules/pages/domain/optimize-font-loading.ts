/**
 * Publish-time font-discovery pass: hoists the Google Fonts / Fontshare
 * stylesheet <link>s above the page's inline <style>, so the browser finds the
 * render-blocking font request in the first bytes of <head> instead of after
 * 22-36 KB of inline CSS (measured on live pages: the css2 link sat at byte
 * 23004 of a 23103-byte head, so the request started roughly 2.2 s late).
 *
 * CASCADE SAFETY: a Google Fonts / Fontshare stylesheet declares ONLY
 * @font-face rules — it carries no selector that can win or lose against a
 * page rule — so moving it before the inline <style> cannot change how any
 * page rule resolves. Only the discovery time changes.
 *
 * The href and the rel of every font link stay byte-identical (except for an
 * appended display=swap), because the editor contract matches them exactly:
 * parse-tokens.ts requires rel~="stylesheet" plus the literal
 * "https://fonts.googleapis.com/" prefix, and page-edits.service.ts snapshots
 * the same hrefs so reset-tokens can restore them. Links are never removed or
 * deduped either: nine design worlds mandate THREE families while the token
 * contract only has two font tokens, so the third family's link survives only
 * if this pass leaves it alone.
 *
 * Idempotent and textual: a second run finds the links already hoisted, the
 * preconnects already present and display=swap already set, and returns the
 * identical string. No cheerio round-trip, so a page that needs nothing keeps
 * its exact publish bytes. Plain module, NO NestJS imports: the site-builder
 * finalize pass and the sites publish pipeline both share it.
 */

// The two literals ops.ts:1212-1225 guards on. A different spelling (trailing
// slash, extra attribute) makes the next font-affecting theme save append a
// DUPLICATE preconnect, and ops.spec.ts asserts exactly two.
const GOOGLE_FONTS_PRECONNECT =
	'<link rel="preconnect" href="https://fonts.googleapis.com">';
const GSTATIC_PRECONNECT =
	'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';

const GOOGLE_FONTS_PREFIX = "https://fonts.googleapis.com/";
const GOOGLE_FONTS_CSS2_PREFIX = "https://fonts.googleapis.com/css2";
const FONTSHARE_PREFIX = "https://api.fontshare.com/";

const HEAD_OPEN_PATTERN = /<head\b[^>]*>/i;
const HEAD_CLOSE_PATTERN = /<\/head\s*>/i;
const LINK_TAG_PATTERN = /<link\b[^>]*>/gi;
const STYLE_OPEN_PATTERN = /<style\b/gi;
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

type Range = { end: number; start: number };

type FontLink = Range & { href: string; tag: string };

type Splice = Range & { order: number; replacement: string };

function readAttribute(tag: string, name: string): string | undefined {
	// Attribute preceded by whitespace, so data-href never matches href.
	const match = new RegExp(
		`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
		"i",
	).exec(tag);

	return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function hasRelToken(tag: string, token: string): boolean {
	const rel = readAttribute(tag, "rel");

	if (rel === undefined) {
		return false;
	}

	return rel
		.trim()
		.split(/\s+/)
		.some((candidate) => candidate.toLowerCase() === token);
}

/**
 * Same disqualifier as the editor validators (parse-tokens.ts): any char <=
 * 0x20 or 0x7f inside the href makes the link invisible to them, so a link
 * carrying one is left exactly where it is.
 */
function hasUrlWhitespaceOrControl(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);

		if (code <= 0x20 || code === 0x7f) {
			return true;
		}
	}

	return false;
}

function isFontStylesheetHref(href: string | undefined): href is string {
	if (href === undefined || hasUrlWhitespaceOrControl(href)) {
		return false;
	}

	return (
		href.startsWith(GOOGLE_FONTS_PREFIX) || href.startsWith(FONTSHARE_PREFIX)
	);
}

/**
 * display=swap only for the Google css2 endpoint: Fontshare has its own query
 * grammar, and an unknown param there is a changed URL for no gain.
 */
function withDisplaySwap(tag: string, href: string): string {
	if (!href.startsWith(GOOGLE_FONTS_CSS2_PREFIX) || href.includes("display=")) {
		return tag;
	}

	// Mirror the page's own separator encoding: live pages carry &amp; inside
	// the attribute, and mixing both spellings in one href reads as a different
	// URL to everything that string-compares hrefs.
	const separator = href.includes("?")
		? href.includes("&amp;")
			? "&amp;"
			: "&"
		: "?";

	return tag.replace(href, `${href}${separator}display=swap`);
}

function isInsideComment(index: number, comments: Range[]): boolean {
	return comments.some(
		(comment) => index >= comment.start && index < comment.end,
	);
}

/** The indentation of the line the given offset sits on, whitespace only. */
function lineIndentAt(text: string, index: number): string {
	const lineStart = text.lastIndexOf("\n", index - 1) + 1;
	const candidate = text.slice(lineStart, index);

	return /^[\t ]*$/.test(candidate) ? candidate : "";
}

/**
 * The start of the whitespace that only exists to lay the tag out, so cutting
 * a hoisted link never leaves a blank line behind.
 */
function cutStartFor(text: string, start: number): number {
	let cut = start;

	while (cut > 0 && (text[cut - 1] === " " || text[cut - 1] === "\t")) {
		cut -= 1;
	}

	return cut > 0 && text[cut - 1] === "\n" ? cut - 1 : start;
}

function collectComments(head: string): Range[] {
	const comments: Range[] = [];

	COMMENT_PATTERN.lastIndex = 0;

	let match = COMMENT_PATTERN.exec(head);

	while (match !== null) {
		comments.push({ end: match.index + match[0].length, start: match.index });
		match = COMMENT_PATTERN.exec(head);
	}

	return comments;
}

/**
 * Offset of the first REAL inline <style>, -1 when the head has none.
 *
 * Comment-filtered like the <link> scan: a head carrying `<!-- <style>…-->`
 * (or even the bare words "inline <style>") would otherwise make the comment
 * the hoist target, and the block would be spliced INSIDE the comment while
 * the original links were cut — publishing a page with no font stylesheet at
 * all.
 */
function firstUncommentedStyleIndex(head: string, comments: Range[]): number {
	STYLE_OPEN_PATTERN.lastIndex = 0;

	let match = STYLE_OPEN_PATTERN.exec(head);

	while (match !== null) {
		if (!isInsideComment(match.index, comments)) {
			return match.index;
		}

		match = STYLE_OPEN_PATTERN.exec(head);
	}

	return -1;
}

function applySplices(head: string, splices: Splice[]): string {
	const ordered = [...splices].sort(
		(left, right) => left.start - right.start || left.order - right.order,
	);
	const pieces: string[] = [];
	let consumed = 0;

	for (const splice of ordered) {
		pieces.push(head.slice(consumed, splice.start), splice.replacement);
		consumed = Math.max(consumed, splice.end);
	}

	pieces.push(head.slice(consumed));

	return pieces.join("");
}

/**
 * Move every Google Fonts / Fontshare stylesheet <link> in <head> above the
 * first inline <style>, add the two sanctioned preconnects when the page loads
 * a Google Fonts sheet without them, and append display=swap to a css2 href
 * that has no display parameter. Relative link order is preserved, no link is
 * removed, no href or rel is otherwise rewritten, and nothing outside <head>
 * is read or written. A page with no font stylesheet — or one already
 * optimized — comes back as the identical string.
 */
export function optimizeFontLoading(html: string): string {
	const headOpen = HEAD_OPEN_PATTERN.exec(html);

	if (headOpen === null) {
		return html;
	}

	const headStart = headOpen.index + headOpen[0].length;
	const afterHeadOpen = html.slice(headStart);
	const headClose = HEAD_CLOSE_PATTERN.exec(afterHeadOpen);
	const head = headClose
		? afterHeadOpen.slice(0, headClose.index)
		: afterHeadOpen;

	const comments = collectComments(head);
	const fontLinks: FontLink[] = [];
	const preconnects: Range[] = [];
	let googlePreconnectPresent = false;
	let gstaticPreconnectPresent = false;

	LINK_TAG_PATTERN.lastIndex = 0;

	let match = LINK_TAG_PATTERN.exec(head);

	while (match !== null) {
		const tag = match[0];
		const start = match.index;

		if (!isInsideComment(start, comments)) {
			const href = readAttribute(tag, "href");

			if (hasRelToken(tag, "preconnect")) {
				preconnects.push({ end: start + tag.length, start });

				// Literal-href equality, exactly like the ops.ts guards.
				googlePreconnectPresent ||= href === "https://fonts.googleapis.com";
				gstaticPreconnectPresent ||= href === "https://fonts.gstatic.com";
			}

			if (hasRelToken(tag, "stylesheet") && isFontStylesheetHref(href)) {
				fontLinks.push({ end: start + tag.length, href, start, tag });
			}
		}

		match = LINK_TAG_PATTERN.exec(head);
	}

	if (fontLinks.length === 0) {
		return html;
	}

	const firstStyleIndex = firstUncommentedStyleIndex(head, comments);
	const mustMove =
		firstStyleIndex !== -1 &&
		fontLinks.some((fontLink) => fontLink.start > firstStyleIndex);

	const hasGoogleSheet = fontLinks.some((fontLink) =>
		fontLink.href.startsWith(GOOGLE_FONTS_PREFIX),
	);
	// Fontshare gets no preconnect of its own: ops.spec.ts asserts a themed
	// page carries EXACTLY the two Google preconnects.
	const missingPreconnects: string[] = [];

	if (hasGoogleSheet && !googlePreconnectPresent) {
		missingPreconnects.push(GOOGLE_FONTS_PRECONNECT);
	}

	if (hasGoogleSheet && !gstaticPreconnectPresent) {
		missingPreconnects.push(GSTATIC_PRECONNECT);
	}

	const hoisted = fontLinks.map((fontLink) => ({
		...fontLink,
		tag: withDisplaySwap(fontLink.tag, fontLink.href),
	}));
	const hrefsChanged = hoisted.some(
		(fontLink, index) => fontLink.tag !== fontLinks[index]?.tag,
	);

	if (!mustMove && !hrefsChanged && missingPreconnects.length === 0) {
		return html;
	}

	const splices: Splice[] = [];

	if (mustMove) {
		// Land the block after the last preconnect that already precedes the
		// first <style>, so DNS warm-up keeps leading the request; otherwise
		// directly before that <style>.
		const lastEarlyPreconnect = preconnects
			.filter((preconnect) => preconnect.start < firstStyleIndex)
			.at(-1);
		const tags = [
			...missingPreconnects,
			...hoisted.map((fontLink) => fontLink.tag),
		];

		if (lastEarlyPreconnect) {
			const indent = lineIndentAt(head, lastEarlyPreconnect.start);

			splices.push({
				end: lastEarlyPreconnect.end,
				order: 0,
				replacement: tags.reduce(
					(text, tag) => `${text}\n${indent}${tag}`,
					head.slice(lastEarlyPreconnect.start, lastEarlyPreconnect.end),
				),
				start: lastEarlyPreconnect.start,
			});
		} else {
			const indent = lineIndentAt(head, firstStyleIndex);

			splices.push({
				end: firstStyleIndex,
				order: 0,
				replacement: tags.map((tag) => `${tag}\n${indent}`).join(""),
				start: firstStyleIndex,
			});
		}

		for (const fontLink of hoisted) {
			splices.push({
				end: fontLink.end,
				order: 1,
				replacement: "",
				start: cutStartFor(head, fontLink.start),
			});
		}
	} else {
		// Already early enough: rewrite in place and keep every other byte.
		const first = hoisted[0] as FontLink;

		if (missingPreconnects.length > 0) {
			const indent = lineIndentAt(head, first.start);

			splices.push({
				end: first.start,
				order: 0,
				replacement: missingPreconnects
					.map((tag) => `${tag}\n${indent}`)
					.join(""),
				start: first.start,
			});
		}

		for (const [index, fontLink] of hoisted.entries()) {
			if (fontLink.tag !== fontLinks[index]?.tag) {
				splices.push({
					end: fontLink.end,
					order: 1,
					replacement: fontLink.tag,
					start: fontLink.start,
				});
			}
		}
	}

	return (
		html.slice(0, headStart) +
		applySplices(head, splices) +
		html.slice(headStart + head.length)
	);
}
