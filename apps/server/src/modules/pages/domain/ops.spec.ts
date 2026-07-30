import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { applyOps } from "./ops";

const PAGE = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Changa:wght@400;600;700;800&family=Almarai:wght@300;400;700;800&display=swap">
<style>:root {
  --background: #ffffff;
  --foreground: #111111;
  --primary: #aa3311;
  --primary-foreground: #ffffff;
  --radius: 0.75rem;
  --font-heading: "Changa", sans-serif;
  --font-body: "Almarai", sans-serif;
}
body { color: var(--foreground); }</style>
</head><body>
<section data-wid="hero">
<h1 data-wid="e-1">Old title</h1>
<p data-wid="e-2" style="color: red; font-weight: bold">Old copy</p>
<img data-wid="e-3" src="https://assets.example.com/a.png" srcset="a 1x" sizes="100vw">
<a data-wid="e-5" href="tel:+212600000000">+212 600 000 000</a>
</section>
<section data-wid="reviews"><p data-wid="e-4">Reviews</p></section>
</body></html>`;

function applied(html: string, ops: Parameters<typeof applyOps>[1]) {
	const result = applyOps(html, ops);

	if (!result.ok) {
		throw new Error(`expected ok, got op ${result.index}: ${result.reason}`);
	}

	return result;
}

describe("applyOps", () => {
	it("replaces an element's content with escaped plain text", () => {
		const result = applied(PAGE, [
			{ kind: "text", value: "New <b>title</b> & more", wid: "e-1" },
		]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="e-1"]').text()).toBe("New <b>title</b> & more");
		expect($('[data-wid="e-1"]').children().length).toBe(0);
		expect(result.editedWids).toEqual(["e-1"]);
	});

	it("fails the batch when a wid does not exist", () => {
		const result = applyOps(PAGE, [
			{ kind: "text", value: "ok", wid: "e-1" },
			{ kind: "text", value: "nope", wid: "e-99" },
		]);

		expect(result).toEqual({
			index: 1,
			ok: false,
			reason: 'no element with data-wid="e-99"',
		});
	});

	it("fails when a wid is not unique", () => {
		const html = PAGE.replace('data-wid="e-4"', 'data-wid="e-1"');
		const result = applyOps(html, [{ kind: "text", value: "x", wid: "e-1" }]);

		expect(result).toMatchObject({
			ok: false,
			reason: expect.stringContaining("not unique"),
		});
	});

	it("rejects image-src on a non-img element", () => {
		const result = applyOps(PAGE, [
			{
				kind: "image-src",
				value: "https://assets.example.com/b.png",
				wid: "e-1",
			},
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "target is not an <img>",
		});
	});

	it("swaps an img src and drops srcset/sizes", () => {
		const result = applied(PAGE, [
			{
				kind: "image-src",
				value: "https://assets.example.com/b.png",
				wid: "e-3",
			},
		]);
		const image = cheerio.load(result.html)('[data-wid="e-3"]');

		expect(image.attr("src")).toBe("https://assets.example.com/b.png");
		expect(image.attr("srcset")).toBeUndefined();
		expect(image.attr("sizes")).toBeUndefined();
	});

	it("merges element-style into existing inline style", () => {
		const result = applied(PAGE, [
			{
				kind: "element-style",
				value: { color: "#112233", fontSize: "18px" },
				wid: "e-2",
			},
		]);
		const style = cheerio.load(result.html)('[data-wid="e-2"]').attr("style");

		expect(style).toContain("font-weight: bold");
		expect(style).toContain("color: #112233");
		expect(style).toContain("font-size: 18px");
	});

	it("writes curated font stacks for element-style fontFamily", () => {
		const result = applied(PAGE, [
			{ kind: "element-style", value: { fontFamily: "cairo" }, wid: "e-2" },
		]);
		const style = cheerio.load(result.html)('[data-wid="e-2"]').attr("style");

		expect(style).toContain('font-family: "Cairo", sans-serif');
	});

	it("rewrites :root tokens, preserving untouched declarations", () => {
		const result = applied(PAGE, [
			{
				kind: "set-tokens",
				value: { accent: "#00ff00", primary: "#123456" },
			},
		]);

		expect(result.html).toContain("--primary: #123456;");
		// --primary-foreground must NOT be clobbered by the --primary rewrite.
		expect(result.html).toContain("--primary-foreground: #ffffff");
		expect(result.html).toContain("--background: #ffffff");
		// Missing token appended inside the block.
		expect(result.html).toContain("--accent: #00ff00;");
		expect(result.editedWids).toEqual(["__tokens__"]);
	});

	it("fails set-tokens when no :root block exists", () => {
		const html =
			'<!doctype html><html><head></head><body><p data-wid="e-1">x</p></body></html>';
		const result = applyOps(html, [
			{ kind: "set-tokens", value: { primary: "#123456" } },
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "no :root token block found",
		});
	});

	it("replaces google font links with one combined css2 link when both tokens are curated", () => {
		const result = applied(PAGE, [
			{
				kind: "set-tokens",
				value: { "font-body": "tajawal", "font-heading": "cairo" },
			},
		]);
		const $ = cheerio.load(result.html);
		const links = $('link[href*="fonts.googleapis.com/css"]');

		expect(links.length).toBe(1);
		expect(links.attr("href")).toBe(
			"https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap",
		);
		expect(result.html).toContain('--font-heading: "Cairo", sans-serif;');
		expect(result.html).toContain('--font-body: "Tajawal", sans-serif;');
		// Preconnects preserved.
		expect($('link[rel="preconnect"]').length).toBe(2);
	});

	it("only ADDS a link when one token stays non-curated", () => {
		const page = PAGE.replace(
			'--font-body: "Almarai", sans-serif;',
			'--font-body: "Comic Neue", sans-serif;',
		);
		const result = applied(page, [
			{ kind: "set-tokens", value: { "font-heading": "cairo" } },
		]);
		const $ = cheerio.load(result.html);
		const links = $('link[href*="fonts.googleapis.com/css"]');

		// The builder's original link survives; the curated link is appended.
		expect(links.length).toBe(2);
		expect(
			links
				.map((_, node) => $(node).attr("href"))
				.get()
				.some((href) => href?.includes("family=Cairo")),
		).toBe(true);
	});

	it("includes inline-pinned curated families in the reconciled link", () => {
		const result = applied(PAGE, [
			{ kind: "element-style", value: { fontFamily: "manrope" }, wid: "e-4" },
			{
				kind: "set-tokens",
				value: { "font-body": "tajawal", "font-heading": "cairo" },
			},
		]);
		const link = cheerio
			.load(result.html)('link[href*="fonts.googleapis.com/css"]')
			.attr("href");

		expect(link).toContain("family=Cairo");
		expect(link).toContain("family=Tajawal");
		expect(link).toContain("family=Manrope");
	});

	it("does not touch font links when no font-affecting op ran", () => {
		const result = applied(PAGE, [
			{ kind: "set-tokens", value: { primary: "#123456" } },
		]);
		const links = cheerio.load(result.html)(
			'link[href*="fonts.googleapis.com/css"]',
		);

		expect(links.length).toBe(1);
		expect(links.attr("href")).toContain("family=Changa");
	});

	it("applies replace-section and records the wid", () => {
		const replacement =
			'<section data-wid="reviews"><h2>آراء العملاء</h2><p>خدمة ممتازة</p></section>';
		const result = applied(PAGE, [
			{ kind: "replace-section", value: replacement, wid: "reviews" },
		]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="reviews"] h2').text()).toBe("آراء العملاء");
		expect(result.editedWids).toEqual(["reviews"]);
	});

	it("rejects replace-section fragments carrying <script>", () => {
		const result = applyOps(PAGE, [
			{
				kind: "replace-section",
				value:
					'<section data-wid="reviews"><script>alert(1)</script></section>',
				wid: "reviews",
			},
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "replacement HTML must not contain <script> elements",
		});
	});

	it("rejects replace-section fragments with no element", () => {
		const result = applyOps(PAGE, [
			{
				kind: "replace-section",
				value: "just some plain text content",
				wid: "reviews",
			},
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "replacement HTML contains no element",
		});
	});

	it("removes an <img> via remove-element", () => {
		const result = applied(PAGE, [{ kind: "remove-element", wid: "e-3" }]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="e-3"]').length).toBe(0);
		expect(result.editedWids).toEqual(["e-3"]);
	});

	it("rejects remove-element on a non-img target", () => {
		const result = applyOps(PAGE, [{ kind: "remove-element", wid: "e-1" }]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "removal is only supported for <img> elements",
		});
	});

	it("rejects remove-element on an unknown wid", () => {
		const result = applyOps(PAGE, [{ kind: "remove-element", wid: "e-99" }]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: 'no element with data-wid="e-99"',
		});
	});

	it("swaps an anchor's href via set-link-href", () => {
		const result = applied(PAGE, [
			{
				kind: "set-link-href",
				value: "https://wa.me/212611111111",
				wid: "e-5",
			},
		]);
		const link = cheerio.load(result.html)('[data-wid="e-5"]');

		expect(link.attr("href")).toBe("https://wa.me/212611111111");
		expect(result.editedWids).toEqual(["e-5"]);
	});

	it("accepts tel: hrefs on set-link-href", () => {
		const result = applied(PAGE, [
			{ kind: "set-link-href", value: "tel:+212611111111", wid: "e-5" },
		]);

		expect(cheerio.load(result.html)('[data-wid="e-5"]').attr("href")).toBe(
			"tel:+212611111111",
		);
	});

	it("rejects set-link-href on a non-anchor target", () => {
		const result = applyOps(PAGE, [
			{ kind: "set-link-href", value: "https://example.com/", wid: "e-1" },
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "target is not an <a>",
		});
	});

	it("re-rejects unsafe hrefs at the ops level", () => {
		// Constructed directly — zod catches this earlier on the HTTP path;
		// the ops-level recheck covers the AI path.
		const result = applyOps(PAGE, [
			{ kind: "set-link-href", value: "javascript:alert(1)", wid: "e-5" },
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "href must use https, http, tel: or mailto:",
		});
	});

	it("applies padding steps to a top-level section", () => {
		const result = applied(PAGE, [
			{
				kind: "section-style",
				value: { paddingBottom: "s", paddingTop: "m" },
				wid: "hero",
			},
		]);
		const style = cheerio.load(result.html)('[data-wid="hero"]').attr("style");

		expect(style).toContain("padding-top: clamp(2.5rem, 5vw, 4rem)");
		expect(style).toContain("padding-bottom: clamp(1.5rem, 3vw, 2.5rem)");
		expect(result.editedWids).toEqual(["hero"]);
	});

	it("sets a section background image with cover/center companions", () => {
		const result = applied(PAGE, [
			{
				kind: "section-style",
				value: { backgroundImage: "https://assets.example.com/bg.png" },
				wid: "hero",
			},
		]);
		const style = cheerio.load(result.html)('[data-wid="hero"]').attr("style");

		expect(style).toContain(
			'background-image: url("https://assets.example.com/bg.png")',
		);
		expect(style).toContain("background-size: cover");
		expect(style).toContain("background-position: center");
	});

	it('writes an explicit inline none on backgroundImage "none" and drops the companions', () => {
		const result = applied(PAGE, [
			{
				kind: "section-style",
				value: { backgroundImage: "https://assets.example.com/bg.png" },
				wid: "hero",
			},
			{
				kind: "section-style",
				value: { backgroundImage: "none" },
				wid: "hero",
			},
		]);
		const style =
			cheerio.load(result.html)('[data-wid="hero"]').attr("style") ?? "";

		expect(style).toContain("background-image: none");
		expect(style).not.toContain("url(");
		expect(style).not.toContain("background-size");
		expect(style).not.toContain("background-position");
	});

	it("overrides a stylesheet-rule background with inline none (no prior inline value)", () => {
		// The common builder case: the background comes from a <style> rule, so
		// a property DELETE would let it resurface — the override must be an
		// explicit inline "none".
		const result = applied(PAGE, [
			{
				kind: "section-style",
				value: { backgroundImage: "none" },
				wid: "hero",
			},
		]);
		const style =
			cheerio.load(result.html)('[data-wid="hero"]').attr("style") ?? "";

		expect(style).toContain("background-image: none");
	});

	it("escapes double quotes inside background image urls", () => {
		const result = applied(PAGE, [
			{
				kind: "section-style",
				value: { backgroundImage: 'https://assets.example.com/b"g.png' },
				wid: "hero",
			},
		]);
		const style = cheerio.load(result.html)('[data-wid="hero"]').attr("style");

		expect(style).toContain('url("https://assets.example.com/b\\"g.png")');
	});

	it("rejects section-style on a leaf target", () => {
		const result = applyOps(PAGE, [
			{ kind: "section-style", value: { paddingTop: "l" }, wid: "e-1" },
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "target is not a top-level section",
		});
	});

	it("collects edited wids across a mixed batch, with __tokens__ for set-tokens", () => {
		const result = applied(PAGE, [
			{ kind: "text", value: "T", wid: "e-1" },
			{ kind: "text", value: "T2", wid: "e-1" },
			{ kind: "set-tokens", value: { primary: "#123456" } },
			{ kind: "element-style", value: { color: "#000000" }, wid: "e-2" },
		]);

		expect(result.editedWids).toEqual(["e-1", "e-2", "__tokens__"]);
	});
});
