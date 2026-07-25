/**
 * Deterministic element-stamping pass (V2 spec §4, contract §5).
 *
 * Walks a page's HTML and stamps every editable leaf with a stable
 * `data-wid="e-<n>"`, gives fallback `sec-<n>` wids to top-level sections the
 * builder forgot to name, and enforces document-wide wid uniqueness. Runs
 * after generation AND after every mutation, so every version's canonical
 * HTML in R2 is fully stamped.
 *
 * Plain functions, NO NestJS imports on purpose: the Trigger.dev build task,
 * the ops pipeline, and the chat edit tools all share this module.
 */
import * as cheerio from "cheerio";

export const STAMPABLE_LEAF_SELECTOR =
	"h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, img, a, button";

export const TOP_LEVEL_SECTION_SELECTOR =
	"body > header, body > section, body > footer, body > aside, body > nav, " +
	"body > main > header, body > main > section, body > main > footer, " +
	"body > main > aside, body > main > nav";

// Server-stamped element wids: e-1, e-2, … (contract §1).
const ELEMENT_WID_PATTERN = /^e-(\d+)$/;

// Semantic section wids must match the shared widSchema (contract §1):
// kebab-case, max 48 chars. Anything else ("Hero Section", "héro", too
// long) would make the outline fail its own schema and the section
// untargetable by the edit tools — such sections get a sec-<n> fallback.
const SECTION_WID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MAX_WID_LENGTH = 48;

function isValidSectionWid(wid: string): boolean {
	return (
		wid.length <= MAX_WID_LENGTH &&
		SECTION_WID_PATTERN.test(wid) &&
		!ELEMENT_WID_PATTERN.test(wid)
	);
}

/**
 * Stamp one HTML document. Deterministic and idempotent:
 * stampHtml(stampHtml(x)) === stampHtml(x).
 */
export function stampHtml(html: string): string {
	const $ = cheerio.load(html);

	// Guard rails first: the preview editor's __wandit-* elements must never
	// persist into a canonical version, nor may contenteditable attributes.
	$('[id^="__wandit-"]').remove();
	$("[contenteditable]").removeAttr("contenteditable");

	// Every data-wid value present in the document — fallback assignment must
	// never mint a value that already exists somewhere.
	const usedWids = new Set<string>();
	$("[data-wid]").each((_, node) => {
		const value = $(node).attr("data-wid");

		if (value) {
			usedWids.add(value);
		}
	});

	// Sections: keep valid unique semantic wids; everything else (missing,
	// empty, non-kebab, element-pattern, duplicate of an earlier section)
	// gets sec-<n>. Every top-level section MUST leave this pass with a wid
	// it will keep — the uniqueness sweep below never strips section wids.
	const seenSectionWids = new Set<string>();
	const sectionNodes = new Set<object>();
	let fallbackNumber = 0;

	$(TOP_LEVEL_SECTION_SELECTOR).each((_, node) => {
		const section = $(node);
		const wid = section.attr("data-wid");

		sectionNodes.add(node);

		if (wid && isValidSectionWid(wid) && !seenSectionWids.has(wid)) {
			seenSectionWids.add(wid);

			return;
		}

		do {
			fallbackNumber += 1;
		} while (usedWids.has(`sec-${fallbackNumber}`));

		const fallback = `sec-${fallbackNumber}`;

		section.attr("data-wid", fallback);
		usedWids.add(fallback);
		seenSectionWids.add(fallback);
	});

	// Uniqueness sweep + the max element number, so new stamps continue past
	// everything already used. Sections OWN their wids (seeded first): a
	// non-section element duplicating a section wid loses it regardless of
	// document order — a top-level section must never end up unaddressable.
	// Among non-sections, first occurrence in document order wins.
	let maxNumber = 0;
	const seen = new Set<string>(seenSectionWids);

	$("[data-wid]").each((_, node) => {
		if (sectionNodes.has(node)) {
			return;
		}

		const element = $(node);
		const value = element.attr("data-wid");

		if (!value || seen.has(value)) {
			element.removeAttr("data-wid");

			return;
		}

		seen.add(value);

		const match = ELEMENT_WID_PATTERN.exec(value);

		if (match?.[1]) {
			maxNumber = Math.max(maxNumber, Number.parseInt(match[1], 10));
		}
	});

	// Stamp every unstamped leaf (svg internals excluded — they are artwork,
	// not editable content).
	$(STAMPABLE_LEAF_SELECTOR).each((_, node) => {
		const element = $(node);

		if (element.closest("svg").length > 0) {
			return;
		}

		const value = element.attr("data-wid");

		if (value && ELEMENT_WID_PATTERN.test(value)) {
			return;
		}

		maxNumber += 1;
		element.attr("data-wid", `e-${maxNumber}`);
	});

	return $.html();
}

export type OutlineSection = {
	wid: string;
	tag: string;
	snippet: string;
	elements: number;
};

/**
 * Cheap section map for get_page_outline. Assumes STAMPED input — callers
 * stamp-on-read when a legacy pre-V2 version carries no wids.
 */
export function extractOutline(html: string): { sections: OutlineSection[] } {
	const $ = cheerio.load(html);
	const sections: OutlineSection[] = [];

	$(TOP_LEVEL_SECTION_SELECTOR).each((_, node) => {
		const section = $(node);
		let elements = 0;

		section.find(STAMPABLE_LEAF_SELECTOR).each((_, leafNode) => {
			const leaf = $(leafNode);

			if (leaf.closest("svg").length > 0) {
				return;
			}

			const value = leaf.attr("data-wid");

			if (value && ELEMENT_WID_PATTERN.test(value)) {
				elements += 1;
			}
		});

		sections.push({
			elements,
			snippet: section.text().replace(/\s+/g, " ").trim().slice(0, 90),
			tag: section.prop("tagName")?.toLowerCase() ?? "",
			wid: section.attr("data-wid") ?? "",
		});
	});

	return { sections };
}

/**
 * One element's outerHTML by exact data-wid. Returns null unless the wid
 * matches EXACTLY one element (unstamped/duplicate wids both fail).
 */
export function extractSectionHtml(html: string, wid: string): string | null {
	const $ = cheerio.load(html);
	const match = $(`[data-wid="${wid}"]`);

	if (match.length !== 1) {
		return null;
	}

	return $.html(match);
}
