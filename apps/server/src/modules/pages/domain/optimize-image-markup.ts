/**
 * Deterministic <img> markup pass: exactly ONE prioritized LCP image per
 * page, every other image lazy, and — at publish only — a srcset built from
 * renditions that provably exist in R2.
 *
 * WHY DETERMINISTIC. Measured on live pages: five images all declared
 * width="900" height="1100" against real intrinsics of 1024x1536 and
 * 906x1280 (three of them laid out distorted at 1100 px tall), three
 * below-fold images carried loading="eager", and not one page anywhere
 * carried a srcset. The base builder prompts only ask for alt text and
 * below-fold lazy, so this pass is AUTHORITATIVE, not additive: it strips a
 * stray fetchpriority instead of merely filling a missing one.
 *
 * WHY IT NEVER WRITES width/height. The wrong attributes already on
 * published pages define their layout; correcting them here would reflow
 * live sites, which is a different decision from a performance pass. The fix
 * runs one layer up instead: the generate_image result states the real pixels
 * of what it just produced, so the model writes real ones for generated
 * images. A user-uploaded photo's pixels never reach the model, so the
 * builder prompts tell it to size those with CSS instead of guessing.
 *
 * THE LCP HEURISTIC. "First <img> in the document" is right one time in two
 * — measured: on one live page the first image is the 48x48 header brand
 * logo while the real LCP is the second image. So candidacy drops brand and
 * placeholder images and anything inside <footer>, <nav> or <svg>, the search
 * covers the candidates POSITIONED above the end of the first content section
 * plus any candidate the builder already marked fetchpriority="high", and the
 * winner is the largest DECLARED width*height among them. When that search
 * finds nobody the pass declines to act rather than guess — see
 * electLcpImage.
 *
 * KNOWN INTERACTION. The editor's image swap deliberately drops srcset and
 * sizes when a user replaces an image (ops.ts, editor-script.ts): the old
 * renditions point at the old asset. That is intended degradation — the next
 * publish re-emits renditions for the new asset.
 *
 * Idempotent, and byte-stable when there is nothing to do: a document that
 * needs no edit comes back as the identical string, never reserialized.
 * Plain module, NO NestJS imports: the site-builder finalize pass and the
 * sites publish pipeline both share it.
 */

import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import {
	isWanditHostedUrl,
	publicAssetKeyFromUrl,
	publicAssetUrl,
	VARIANT_FILENAME_PATTERN,
	variantKey,
} from "../../../infrastructure/storage/r2";
import { topLevelSections } from "./stamp";

type ImageNode = ReturnType<CheerioAPI>[number];

// Cheap gate so a page without a single image never pays a cheerio parse and
// keeps its exact bytes. Non-global on purpose: a /g regex carries lastIndex
// between calls and would answer false every other time.
const IMG_TAG_PATTERN = /<img\b/i;

// Never the LCP. Brand marks and editor placeholders are chrome, <footer> is
// by definition below the fold, <nav> is chrome too, and an <img> inside
// <svg> is artwork markup rather than a layout image (the same exclusion
// isStampableLeaf makes).
const NEVER_LCP_SELF_SELECTOR =
	"[data-wandit-brand-image], [data-wandit-placeholder]";
const NEVER_LCP_ANCESTOR_SELECTOR = "footer, nav, svg, [data-brand]";

// Left exactly as found by the lazy/decoding normalization: chrome that sits
// ABOVE the fold (a header brand mark, a hero brand badge) loses LCP time
// when it is lazy-loaded, and ops.ts owns the brand image's attributes.
// Their fetchpriority is NOT left alone — see optimizeImageMarkup: at most
// one element in a document may claim the high priority.
const NEVER_NORMALIZED_SELF_SELECTOR = "[data-wandit-brand-image]";
const NEVER_NORMALIZED_ANCESTOR_SELECTOR = "svg, nav, [data-brand]";

// The ladder storeImageVariants writes (DEFAULT_VARIANT_WIDTHS in
// infrastructure/storage/optimize-image.ts). Duplicated rather than imported
// so this module stays free of sharp: every width is probed before it is
// emitted, so a drift between the two lists costs a rendition, never a 404.
const VARIANT_WIDTHS = [480, 960, 1600];

// The descriptor for the primary object. optimizeImage resizes every stored
// image to at most MAX_WIDTH = 1920, and buildImageVariants skips any width
// at or above the source, so the primary is always the widest candidate.
// Declared width/height attributes are NOT used for this: they are the
// guessed numbers this whole pass exists because of.
const PRIMARY_WIDTH_DESCRIPTOR = 1920;

// The pass cannot know an image's CSS box, and 100vw is the one answer that
// never under-fetches. A too-small pick would ship a visibly soft image;
// a too-large pick only forfeits part of the saving.
const RESPONSIVE_SIZES = "100vw";

// Six in flight, like the publish asset preflight, and a hard 5 s ceiling on
// the whole probe phase: renditions are an optimization and must never hold
// a publish open.
const PROBE_CONCURRENCY = 6;
const PROBE_BUDGET_MS = 5_000;

type VariantCandidate = { url: string; width: number };

type ResponsiveTarget = {
	candidates: VariantCandidate[];
	node: ImageNode;
	src: string;
};

/** Storage probe for one candidate rendition URL. */
export type ResponsiveImageOptions = {
	exists: (url: string) => Promise<boolean>;
};

function matchesAncestor(
	$: CheerioAPI,
	node: ImageNode,
	selector: string,
): boolean {
	return $(node).parents(selector).length > 0;
}

function isLcpCandidate($: CheerioAPI, node: ImageNode): boolean {
	return (
		!$(node).is(NEVER_LCP_SELF_SELECTOR) &&
		!matchesAncestor($, node, NEVER_LCP_ANCESTOR_SELECTOR)
	);
}

function isNeverNormalized($: CheerioAPI, node: ImageNode): boolean {
	return (
		$(node).is(NEVER_NORMALIZED_SELF_SELECTOR) ||
		matchesAncestor($, node, NEVER_NORMALIZED_ANCESTOR_SELECTOR)
	);
}

function positiveInteger(value: string | undefined): number | null {
	if (value === undefined || !/^\d+$/.test(value.trim())) {
		return null;
	}

	const parsed = Number.parseInt(value.trim(), 10);

	return parsed > 0 ? parsed : null;
}

/** Declared box in square pixels, 0 when either attribute is missing. */
function declaredArea($: CheerioAPI, node: ImageNode): number {
	const width = positiveInteger($(node).attr("width"));
	const height = positiveInteger($(node).attr("height"));

	return width === null || height === null ? 0 : width * height;
}

function setAttribute(
	$: CheerioAPI,
	node: ImageNode,
	name: string,
	value: string,
): boolean {
	if ($(node).attr(name) === value) {
		return false;
	}

	$(node).attr(name, value);

	return true;
}

function dropAttribute($: CheerioAPI, node: ImageNode, name: string): boolean {
	if ($(node).attr(name) === undefined) {
		return false;
	}

	$(node).removeAttr(name);

	return true;
}

// Chrome at the top level: never the first CONTENT section, however early it
// sits. A page whose <nav> precedes its hero would otherwise scope the search
// to the nav and elect nothing.
const NON_CONTENT_SECTION_SELECTOR = "header, nav, footer";

/**
 * The outcome of the election, three-valued on purpose.
 *
 * "unscoped" is the one that matters: candidates exist, but none of them sits
 * in the region this module can reason about, so the pass knows nothing and
 * must CHANGE NOTHING. Collapsing that case into "no winner" is what made a
 * real hero lazy — a lazily loaded LCP is a Lighthouse penalty in itself, so
 * a wrong guess here costs more than doing nothing.
 */
type LcpElection =
	| { kind: "elected"; winner: ImageNode }
	| { kind: "no-candidate" }
	| { kind: "unscoped" };

/**
 * The candidates that sit from the top of the document down to the END of the
 * first top-level CONTENT section — the site header, anything before that
 * section, and the section itself. Null when the page has no top-level
 * content section at all, so the caller knows the fold is unknown.
 *
 * POSITION, not containment. A hero written as
 * `<main><div class="hero"><img>` belongs to no top-level section (only
 * header/section/footer/aside/nav qualify), so a containment test dropped it
 * from the search and handed fetchpriority to a below-fold section instead.
 * Document position keeps such a hero eligible without widening the search
 * past the first screen.
 */
function candidatesAboveTheFold(
	$: CheerioAPI,
	candidates: ImageNode[],
): ImageNode[] | null {
	const firstContent = topLevelSections($)
		.toArray()
		.find((node) => !$(node).is(NON_CONTENT_SECTION_SELECTOR));

	if (firstContent === undefined) {
		return null;
	}

	const documentOrder = new Map(
		$("*")
			.toArray()
			.map((node, index) => [node, index] as const),
	);
	const start = documentOrder.get(firstContent);

	if (start === undefined) {
		return null;
	}

	// Preorder traversal, so the last descendant of a section sits exactly
	// `descendantCount` positions after it.
	const end = start + $(firstContent).find("*").length;

	return candidates.filter((node) => (documentOrder.get(node) ?? -1) <= end);
}

function declaresHighPriority($: CheerioAPI, node: ImageNode): boolean {
	return ($(node).attr("fetchpriority") ?? "").trim().toLowerCase() === "high";
}

/**
 * How good an LCP candidate this image looks, compared field by field in this
 * order. The first field that differs decides; document order breaks a full
 * tie because the earlier image is the one nearer the fold.
 */
function lcpScore($: CheerioAPI, node: ImageNode): number[] {
	return [
		declaredArea($, node),
		// The builder's own fetchpriority on its own layout: measured correct
		// on every live page inspected, and worth more than a coin flip. It
		// cannot outrank a genuinely larger box, and re-electing it is what
		// makes a second run byte-stable.
		declaresHighPriority($, node) ? 1 : 0,
		// A <header> image is a logo far more often than it is the LCP. This
		// only bites when nothing declares a box, which is when the area is 0
		// for every candidate.
		matchesAncestor($, node, "header") ? 0 : 1,
	];
}

function outranks(left: number[], right: number[]): boolean {
	for (const [index, value] of left.entries()) {
		const other = right[index] as number;

		if (value !== other) {
			return value > other;
		}
	}

	return false;
}

/**
 * Which image should carry fetchpriority="high": the best-scoring candidate
 * above the fold, plus any candidate the builder already marked high — that
 * one competes wherever it sits, so a hero the position scope cannot see is
 * never demoted to lazy.
 */
function electLcpImage($: CheerioAPI, images: ImageNode[]): LcpElection {
	const candidates = images.filter((node) => isLcpCandidate($, node));

	if (candidates.length === 0) {
		return { kind: "no-candidate" };
	}

	const aboveTheFold = candidatesAboveTheFold($, candidates) ?? [];
	const pool = candidates.filter(
		(node) => aboveTheFold.includes(node) || declaresHighPriority($, node),
	);

	if (pool.length === 0) {
		return { kind: "unscoped" };
	}

	let winner = pool[0] as ImageNode;
	let winningScore = lcpScore($, winner);

	for (const node of pool.slice(1)) {
		const score = lcpScore($, node);

		if (outranks(score, winningScore)) {
			winner = node;
			winningScore = score;
		}
	}

	return { kind: "elected", winner };
}

/**
 * Normalize loading, decoding and fetchpriority across one document.
 *
 * The elected LCP image gets fetchpriority="high", decoding="async" and NO
 * loading attribute (a lazy LCP is a penalty in itself). Every other image
 * loses any fetchpriority it carried — the priority is a document-wide
 * singleton — and, unless it is above-the-fold chrome, gains loading="lazy"
 * and decoding="async". No width, height, srcset, sizes, data-wid or element
 * order is read or written, and no <style> is injected.
 *
 * A page whose candidates all sit outside the region the election understands
 * comes back UNTOUCHED: marking images lazy there could only demote an image
 * that may well be the LCP, and no image is better off lazy than a correct
 * LCP is off being eager.
 */
export function optimizeImageMarkup(html: string): string {
	if (!IMG_TAG_PATTERN.test(html)) {
		return html;
	}

	const $ = cheerio.load(html);
	const images = $("img").toArray();

	if (images.length === 0) {
		return html;
	}

	const election = electLcpImage($, images);

	if (election.kind === "unscoped") {
		return html;
	}

	const winner = election.kind === "elected" ? election.winner : null;
	let changed = false;

	for (const node of images) {
		if (node === winner) {
			changed =
				[
					setAttribute($, node, "fetchpriority", "high"),
					setAttribute($, node, "decoding", "async"),
					dropAttribute($, node, "loading"),
				].some(Boolean) || changed;
			continue;
		}

		// Document-wide, chrome included: two elements claiming the high
		// priority is the same as none claiming it.
		changed = dropAttribute($, node, "fetchpriority") || changed;

		if (isNeverNormalized($, node)) {
			continue;
		}

		changed =
			[
				setAttribute($, node, "loading", "lazy"),
				setAttribute($, node, "decoding", "async"),
			].some(Boolean) || changed;
	}

	return changed ? $.html() : html;
}

function escapeAttributeValue(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll('"', "&quot;");
}

/**
 * One <link rel="preload" as="image"> for the LCP image, idempotent by href.
 * Landed before the page's inline <style> when there is one, so the preload
 * scanner sees it in the first bytes of <head> rather than after 20-40 KB of
 * CSS. Returns true when it wrote the link.
 *
 * INDEPENDENT OF RENDITIONS. Preloading the plain src needs no variant at
 * all, and it is the highest-yield change available on these pages: the hero
 * <img> is discovered only after a 22-37 KB inline <style>. Renditions exist
 * only for objects written since the variant pipeline landed, so tying the
 * preload to them would have left today's whole fleet with no preload.
 * imagesrcset/imagesizes are added only when the image really carries a
 * srcset — a preload advertising renditions that do not exist would fetch the
 * wrong bytes.
 */
function ensurePreloadLink(
	$: CheerioAPI,
	href: string,
	srcset: string | undefined,
): boolean {
	const head = $("head").first();

	if (head.length === 0) {
		return false;
	}

	const alreadyPreloaded = head
		.find('link[rel~="preload"][as="image"]')
		.toArray()
		.some((node) => ($(node).attr("href") ?? "").trim() === href);

	if (alreadyPreloaded) {
		return false;
	}

	const responsive =
		srcset === undefined
			? ""
			: ` imagesrcset="${escapeAttributeValue(srcset)}"` +
				` imagesizes="${RESPONSIVE_SIZES}"`;
	const link =
		`<link rel="preload" as="image" href="${escapeAttributeValue(href)}"` +
		`${responsive}>`;
	const style = head.find("style").first();

	if (style.length > 0) {
		style.before(link);
	} else {
		head.append(link);
	}

	return true;
}

/**
 * Probe every candidate URL once, six at a time, and give up on the whole
 * phase after the budget. FAIL-OPEN by construction: a URL that errors or
 * never answers is simply absent from the answer, so its image keeps its
 * plain src.
 */
async function probeExistingVariants(
	urls: string[],
	exists: (url: string) => Promise<boolean>,
): Promise<Set<string>> {
	const pending = [...new Set(urls)];
	const found = new Set<string>();
	const deadline = Date.now() + PROBE_BUDGET_MS;
	let next = 0;

	const worker = async (): Promise<void> => {
		while (next < pending.length && Date.now() < deadline) {
			const url = pending[next] as string;
			next += 1;

			try {
				if (await exists(url)) {
					found.add(url);
				}
			} catch {
				// A storage hiccup costs this rendition, never the publish.
			}
		}
	};

	const pool = Promise.all(
		Array.from({ length: Math.min(PROBE_CONCURRENCY, pending.length) }, () =>
			worker(),
		),
	).catch(() => undefined);

	// The deadline above only stops work BETWEEN probes; this stops waiting on
	// a probe that never settles. Stragglers keep running harmlessly — the
	// caller reads `found` synchronously on the next line.
	let timer: ReturnType<typeof setTimeout> | undefined;
	const budget = new Promise<void>((resolve) => {
		timer = setTimeout(resolve, PROBE_BUDGET_MS);
	});

	try {
		await Promise.race([pool, budget]);
	} finally {
		if (timer !== undefined) {
			clearTimeout(timer);
		}
	}

	return found;
}

/**
 * Add srcset/sizes to every eligible <img> whose src is a Wandit-hosted
 * object with renditions that VERIFIABLY exist, and preload the LCP one.
 *
 * Publish-only by design: the editor's swap path strips srcset anyway, so a
 * draft that carried one would just lose it on the first user edit, and the
 * probe is network work a generation must not pay for. Every URL it emits
 * has been probed, which is what keeps the publish asset preflight (which
 * expands img[srcset] and link[rel=preload][as=image]) from blocking the
 * publish on a rendition that was never written.
 *
 * Images that already carry a srcset are left alone, so a second run — a
 * republish, or a rollback replaying an archive — returns the same bytes.
 *
 * The LCP preload is emitted even when NOTHING here has a rendition, because
 * it is worth more than the srcset and costs no stored object.
 */
export async function emitResponsiveImages(
	html: string,
	options: ResponsiveImageOptions,
): Promise<string> {
	if (!IMG_TAG_PATTERN.test(html)) {
		return html;
	}

	const $ = cheerio.load(html);
	const images = $("img").toArray();
	const election = electLcpImage($, images);
	const winner = election.kind === "elected" ? election.winner : null;
	const targets: ResponsiveTarget[] = [];

	for (const node of images) {
		const image = $(node);

		if (image.attr("srcset") !== undefined || !isLcpCandidate($, node)) {
			continue;
		}

		const src = (image.attr("src") ?? "").trim();

		if (src === "" || !isWanditHostedUrl(src)) {
			continue;
		}

		const key = publicAssetKeyFromUrl(src);

		// A rendition never gets renditions of its own.
		if (key === null || VARIANT_FILENAME_PATTERN.test(key)) {
			continue;
		}

		targets.push({
			candidates: VARIANT_WIDTHS.map((width) => ({
				url: publicAssetUrl(variantKey(key, width)),
				width,
			})),
			node,
			src,
		});
	}

	if (targets.length === 0 && winner === null) {
		return html;
	}

	const existing =
		targets.length === 0
			? new Set<string>()
			: await probeExistingVariants(
					targets.flatMap((target) =>
						target.candidates.map((candidate) => candidate.url),
					),
					options.exists,
				);
	let changed = false;

	for (const target of targets) {
		const found = target.candidates.filter((candidate) =>
			existing.has(candidate.url),
		);

		if (found.length === 0) {
			continue;
		}

		const srcset = [
			...found.map((candidate) => `${candidate.url} ${candidate.width}w`),
			`${target.src} ${PRIMARY_WIDTH_DESCRIPTOR}w`,
		].join(", ");

		$(target.node).attr("srcset", srcset).attr("sizes", RESPONSIVE_SIZES);
		changed = true;
	}

	// After the loop, so the preload advertises the srcset this run just wrote
	// (or the one the image already carried), and so it lands even when the
	// LCP image has no rendition and no eligible srcset at all.
	if (winner !== null) {
		const src = ($(winner).attr("src") ?? "").trim();

		// A data: URI is already in the bytes — preloading it only inflates the
		// head. A relative src cannot resolve on the served host at all, and
		// the publish preflight already rejects one.
		if (src !== "" && !src.startsWith("data:")) {
			changed = ensurePreloadLink($, src, $(winner).attr("srcset")) || changed;
		}
	}

	return changed ? $.html() : html;
}
