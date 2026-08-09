import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import {
	extractElementsHtml,
	extractOutline,
	extractSectionHtml,
	isStampableContainer,
	isStampableLeaf,
	isTopLevelSection,
	STAMPABLE_LEAF_SELECTOR,
	stampHtml,
} from "./stamp";

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

	it("pierces up to two generic wrappers and excludes nested sections", () => {
		const html = `<!doctype html><html><body>
<div class="page">
<header id="wrapped-header"><h1>Header</h1></header>
<main><section id="twice-wrapped"><p>Offer</p>
<div><aside id="nested-aside"><p>Nested</p></aside></div>
</section></main>
</div>
<div><div><main><footer id="too-deep"><p>Deep</p></footer></main></div></div>
<article><nav id="non-generic"><a href="#x">Nav</a></nav></article>
</body></html>`;
		const $ = cheerio.load(stampHtml(html));

		expect($("#wrapped-header").attr("data-wid")).toBe("sec-1");
		expect($("#twice-wrapped").attr("data-wid")).toBe("sec-2");
		expect($("#nested-aside").attr("data-wid")).toBeUndefined();
		expect($("#too-deep").attr("data-wid")).toBeUndefined();
		expect($("#non-generic").attr("data-wid")).toBeUndefined();

		expect(isTopLevelSection($, $("#wrapped-header")[0])).toBe(true);
		expect(isTopLevelSection($, $("#twice-wrapped")[0])).toBe(true);
		expect(isTopLevelSection($, $("#nested-aside")[0])).toBe(false);
		expect(isTopLevelSection($, $("#too-deep")[0])).toBe(false);
		expect(isTopLevelSection($, $("#non-generic")[0])).toBe(false);
	});

	it("keeps fallback and uniqueness rules across generic wrappers", () => {
		const html = `<!doctype html><html><body>
<div data-wid="sec-1"><main>
<section data-wid="offer"><p data-wid="e-5">First</p></section>
<section data-wid="offer"><p data-wid="e-5">Second</p></section>
</main></div>
</body></html>`;
		const $ = cheerio.load(stampHtml(html));
		const allWids = $("[data-wid]")
			.map((_, node) => $(node).attr("data-wid"))
			.get();

		expect($("section").first().attr("data-wid")).toBe("offer");
		expect($("section").last().attr("data-wid")).toBe("sec-2");
		expect($("section").last().find("p").attr("data-wid")).toBe("e-6");
		expect(new Set(allWids).size).toBe(allWids.length);
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

	it("stamps form leaves and spans containing only inline formatting", () => {
		const html = `<!doctype html><html><body><section>
<form><fieldset><legend>Order</legend>
<label for="name">Name</label><input id="name" placeholder="Your name">
<label for="note">Note</label><textarea id="note"></textarea>
<span id="text-span">Cash on delivery</span>
<span id="nested-span">Price: <strong>1 000 DZD</strong></span>
	<span id="formatted-span">A quiet <em>corner<br>of <span>the city</span></em></span>
</fieldset></form>
</section></body></html>`;
		const $ = cheerio.load(stampHtml(html));

		for (const selector of [
			"legend",
			"label",
			"input",
			"textarea",
			"#text-span",
			"#nested-span",
			"#formatted-span",
			"#formatted-span span",
		]) {
			expect($(selector).attr("data-wid"), selector).toMatch(/^e-\d+$/);
		}

		expect(isStampableLeaf($, $("#text-span")[0])).toBe(true);
		expect(isStampableLeaf($, $("#nested-span")[0])).toBe(true);
		expect(isStampableLeaf($, $("#formatted-span")[0])).toBe(true);
	});

	it("does not stamp spans containing non-inline descendants", () => {
		const html = `<!doctype html><html><body><section>
<span id="div-span">Copy <div>block</div></span>
<span id="img-span">Copy <img src="/photo.jpg" alt=""></span>
<span id="svg-span">Rating <svg viewBox="0 0 10 10"><path d="M0 0h10v10z"></path></svg></span>
</section></body></html>`;
		const $ = cheerio.load(stampHtml(html));

		for (const selector of ["#div-span", "#img-span", "#svg-span"]) {
			expect($(selector).attr("data-wid"), selector).toBeUndefined();
			expect(isStampableLeaf($, $(selector)[0]), selector).toBe(false);
		}
	});

	it("is idempotent with nested inline spans", () => {
		const html = FIXTURE.replace(
			"</body>",
			"<span>A quiet <em>corner <span>of the city</span></em></span></body>",
		);
		const once = stampHtml(html);

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

	it("stamps section containers after leaves without changing leaf semantics", () => {
		const html = `<!doctype html><html><body><section data-wid="hero">
			<div id="card"><p data-wid="e-7">Copy</p><img id="photo" src="/photo.jpg"></div>
			<figure id="semantic" data-wid="price-card"><figcaption>Price</figcaption></figure>
			<article id="article"><h2>Details</h2></article>
		</section></body></html>`;
		const $ = cheerio.load(stampHtml(html));

		expect($("#semantic").attr("data-wid")).toBe("price-card");
		expect($("#photo").attr("data-wid")).toBe("e-8");
		expect($("#card").attr("data-wid")).toMatch(/^e-\d+$/);
		expect($("#article").attr("data-wid")).toMatch(/^e-\d+$/);
		expect(
			Number.parseInt($("#card").attr("data-wid")?.slice(2) ?? "0", 10),
		).toBeGreaterThan(8);
		expect(isStampableContainer($, $("#card")[0])).toBe(true);
		expect(isStampableLeaf($, $("#card")[0])).toBe(false);
		expect(STAMPABLE_LEAF_SELECTOR).not.toContain("div");
		expect(STAMPABLE_LEAF_SELECTOR).not.toContain("figure");
		expect(STAMPABLE_LEAF_SELECTOR).not.toContain("article");
	});

	it("replaces invalid and duplicate container wids but preserves valid semantic wids", () => {
		const html = `<!doctype html><html><body><section data-wid="hero">
			<div id="valid" data-wid="brand-lockup"></div>
			<div id="duplicate" data-wid="brand-lockup"></div>
			<article id="invalid" data-wid="Brand Card"></article>
		</section></body></html>`;
		const $ = cheerio.load(stampHtml(html));

		expect($("#valid").attr("data-wid")).toBe("brand-lockup");
		expect($("#duplicate").attr("data-wid")).toMatch(/^e-\d+$/);
		expect($("#invalid").attr("data-wid")).toMatch(/^e-\d+$/);
		expect($("#duplicate").attr("data-wid")).not.toBe(
			$("#invalid").attr("data-wid"),
		);
	});

	it("excludes page wrappers, SVG artwork, forms, and form descendants from container stamping", () => {
		const html = `<!doctype html><html><body><div id="page-shell">
			<section data-wid="order"><div id="surface"></div>
				<form><div id="form-wrapper"></div><article id="form-article"></article></form>
				<svg><foreignObject><div id="svg-wrapper"></div></foreignObject></svg>
			</section>
		</div></body></html>`;
		const $ = cheerio.load(stampHtml(html));

		expect($("#surface").attr("data-wid")).toMatch(/^e-\d+$/);
		for (const selector of [
			"#page-shell",
			"#form-wrapper",
			"#form-article",
			"#svg-wrapper",
		]) {
			expect($(selector).attr("data-wid"), selector).toBeUndefined();
			expect(isStampableContainer($, $(selector)[0]), selector).toBe(false);
		}
	});

	it("is idempotent after adding container stamps", () => {
		const html = `<!doctype html><html><body><section data-wid="hero">
			<div><article data-wid="feature-plate"><p>Copy</p></article></div>
		</section></body></html>`;
		const once = stampHtml(html);

		expect(stampHtml(once)).toBe(once);
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

	it("maps wrapper-pierced sections and counts the extended leaf set", () => {
		const html = stampHtml(`<!doctype html><html><body>
<div class="page"><main><section data-wid="order-form">
<form><legend>Order</legend><label>Name</label><input>
<textarea></textarea><span>COD only</span><span><b>Nested</b></span></form>
</section></main></div>
</body></html>`);

		expect(extractOutline(html)).toEqual({
			sections: [
				{
					elements: 6,
					snippet: "OrderName COD onlyNested",
					tag: "section",
					wid: "order-form",
				},
			],
		});
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

describe("extractElementsHtml", () => {
	it("returns ordered results for multiple wids from one document load", () => {
		const stamped = stampHtml(FIXTURE);
		const results = extractElementsHtml(stamped, ["e-3", "hero", "missing"]);

		expect(results).toHaveLength(3);
		expect(results[0]).toMatchObject({
			found: true,
			html: expect.stringContaining('data-wid="e-3"'),
			wid: "e-3",
		});
		expect(results[1]).toMatchObject({
			found: true,
			html: expect.stringContaining("<header"),
			wid: "hero",
		});
		expect(results[2]).toEqual({ found: false, wid: "missing" });
	});

	it("requires one exact match for each wid", () => {
		const html = `<!doctype html><html><body>
			<p data-wid="e-1">First</p><p data-wid="e-1">Second</p>
			<p data-wid="e-10">Exact</p>
		</body></html>`;
		const results = extractElementsHtml(html, ["e-1", "e-10"]);

		expect(results[0]).toEqual({ found: false, wid: "e-1" });
		expect(results[1]).toMatchObject({
			found: true,
			html: expect.stringContaining(">Exact</p>"),
			wid: "e-10",
		});
	});
});
