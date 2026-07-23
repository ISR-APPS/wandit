import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { extractOutline, extractSectionHtml, stampHtml } from "./stamp";

// A representative builder output: semantic section wids, a <main> wrapper,
// preview-editor junk, svg internals, and a few pre-existing element wids.
const FIXTURE = `<!doctype html><html><head><style>:root { --background: #fff; }</style></head><body>
<header data-wid="hero"><h1>Grand titre</h1><p>Sous-titre</p></header>
<main>
<section><h2>Benefits</h2><ul><li>One</li><li>Two</li></ul></section>
<section data-wid="hero"><p>duplicate section wid</p></section>
<section data-wid="e-9"><p>element-pattern wid on a section</p></section>
</main>
<div id="__wandit-editor">preview junk</div>
<p contenteditable="true" data-wid="e-3">Editable text</p>
<svg viewBox="0 0 10 10"><a href="#x"><text>svg link</text></a></svg>
<footer data-wid="footer"><a href="#order">CTA</a></footer>
</body></html>`;

describe("stampHtml", () => {
	it("preserves valid semantic section wids and assigns sec-N fallbacks", () => {
		const $ = cheerio.load(stampHtml(FIXTURE));

		expect($("header").attr("data-wid")).toBe("hero");
		expect($("footer").attr("data-wid")).toBe("footer");

		// Unnamed, duplicate, and e-pattern sections get fallbacks in order.
		const sectionWids = $("main > section")
			.map((_, node) => $(node).attr("data-wid"))
			.get();

		expect(sectionWids).toEqual(["sec-1", "sec-2", "sec-3"]);
	});

	it("stamps every leaf, preserving existing e- wids and numbering past the max", () => {
		const $ = cheerio.load(stampHtml(FIXTURE));

		// The pre-existing e-3 survives on its element.
		expect($("p[contenteditable]").length).toBe(0);
		expect($('p[data-wid="e-3"]').text()).toBe("Editable text");

		// Every stampable leaf outside svg carries a data-wid.
		const unstamped = $(
			"h1, h2, p, li, a, button, img, blockquote, figcaption",
		).filter(
			(_, node) =>
				$(node).closest("svg").length === 0 && !$(node).attr("data-wid"),
		);

		expect(unstamped.length).toBe(0);

		// New numbers continue past the document max (3), never reusing it.
		const numbers = $("[data-wid]")
			.map((_, node) => $(node).attr("data-wid"))
			.get()
			.filter((wid): wid is string => Boolean(wid?.startsWith("e-")))
			.map((wid) => Number.parseInt(wid.slice(2), 10));

		expect(new Set(numbers).size).toBe(numbers.length);
		expect(numbers).toContain(3);
		expect(Math.max(...numbers)).toBeGreaterThan(3);
	});

	it("is idempotent", () => {
		const once = stampHtml(FIXTURE);

		expect(stampHtml(once)).toBe(once);
	});

	it("removes duplicate wids (first occurrence wins) before stamping", () => {
		const html = `<!doctype html><html><body>
<section data-wid="offer"><p data-wid="e-5">first</p><p data-wid="e-5">second</p></section>
</body></html>`;
		const $ = cheerio.load(stampHtml(html));
		const wids = $("p")
			.map((_, node) => $(node).attr("data-wid"))
			.get();

		expect(wids[0]).toBe("e-5");
		expect(wids[1]).toBe("e-6");
	});

	it("strips __wandit-* elements and contenteditable attributes", () => {
		const stamped = stampHtml(FIXTURE);

		expect(stamped).not.toContain("__wandit-editor");
		expect(stamped).not.toContain("contenteditable");
	});

	it("never stamps elements inside svg", () => {
		const $ = cheerio.load(stampHtml(FIXTURE));

		expect($("svg [data-wid]").length).toBe(0);
	});

	it("skips fallback numbers already used in the document", () => {
		const html = `<!doctype html><html><body>
<div data-wid="sec-1"></div>
<section><p>unnamed</p></section>
</body></html>`;
		const $ = cheerio.load(stampHtml(html));

		expect($("section").attr("data-wid")).toBe("sec-2");
	});

	it("gives leaves carrying non-element wids a fresh e- wid", () => {
		const html = `<!doctype html><html><body>
<section data-wid="hero"><a data-wid="cta" href="#f">Order</a></section>
</body></html>`;
		const $ = cheerio.load(stampHtml(html));

		expect($("a").attr("data-wid")).toBe("e-1");
	});
});

describe("extractOutline", () => {
	it("maps sections with wid, tag, snippet and stamped-leaf counts", () => {
		const { sections } = extractOutline(stampHtml(FIXTURE));

		expect(sections.map((section) => section.wid)).toEqual([
			"hero",
			"sec-1",
			"sec-2",
			"sec-3",
			"footer",
		]);
		expect(sections[0]?.tag).toBe("header");
		expect(sections[0]?.snippet).toContain("Grand titre");
		// header: h1 + p = 2 stamped leaves; first main section: h2 + 2 li = 3.
		expect(sections[0]?.elements).toBe(2);
		expect(sections[1]?.elements).toBe(3);
	});

	it("normalizes whitespace and truncates snippets to 90 chars", () => {
		const longText = "word ".repeat(60);
		const html = stampHtml(
			`<!doctype html><html><body><section><p>  ${longText}  </p></section></body></html>`,
		);
		const { sections } = extractOutline(html);

		expect(sections[0]?.snippet.length).toBe(90);
		expect(sections[0]?.snippet).not.toMatch(/\s{2,}/);
	});
});

describe("extractSectionHtml", () => {
	it("returns the outerHTML of the unique matching element", () => {
		const stamped = stampHtml(FIXTURE);
		const html = extractSectionHtml(stamped, "hero");

		expect(html).toContain("<header");
		expect(html).toContain('data-wid="hero"');
		expect(html).toContain("Grand titre");
	});

	it("returns null for unknown wids", () => {
		expect(extractSectionHtml(stampHtml(FIXTURE), "missing")).toBeNull();
	});
});
