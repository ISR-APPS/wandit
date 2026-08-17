/**
 * Browser-tab title of a generated page.
 *
 * The builder prompt asks for a buyer-friendly <title>, but a model that
 * forgets it (or writes an empty one) ships a tab labelled with the URL. The
 * finish pass therefore fills the gap deterministically with the short human
 * title the chat Brain already composed for the project.
 *
 * Plain functions, NO NestJS imports on purpose: the Trigger.dev build task
 * and the page pipeline share this module, exactly like stamp.ts.
 */

import * as cheerio from "cheerio";

/**
 * Set the title ONLY when the document lacks a usable one: a missing <title>,
 * or one whose text is empty or whitespace. A document that already names
 * itself is returned byte-identical, so the builder's own wording always
 * wins and the pass stays a no-op on well-formed pages.
 */
export function ensureDocumentTitle(html: string, fallback: string): string {
	const title = fallback.trim();

	if (title.length === 0) {
		return html;
	}

	const $ = cheerio.load(html);
	const head = $("head").first();
	const existing = head.find("title").first();

	if (existing.length > 0) {
		if (existing.text().trim().length > 0) {
			return html;
		}

		// Cheerio escapes the text node itself — an ampersand or angle bracket
		// in a merchant's brand name can never break out of the element.
		existing.text(title);

		return $.html();
	}

	// Appended, never prepended: <meta charset> must stay first in the head —
	// the same rule the set-page-title edit op follows in ops.ts.
	head.append($("<title></title>").text(title));

	return $.html();
}
