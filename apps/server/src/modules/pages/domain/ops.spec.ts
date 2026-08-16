import {
	clientEditOpSchema,
	editOpSchema,
	elementStyleOpSchema,
	PLACEHOLDER_IMAGE_SRC,
	setPlaceholderOpSchema,
} from "@wandit/contracts";
import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { applyOps, extractRootTokens } from "./ops";
import { stampHtml } from "./stamp";

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

function applied(
	html: string,
	ops: Parameters<typeof applyOps>[1],
	context?: Parameters<typeof applyOps>[2],
) {
	const result = applyOps(html, ops, context);

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

	it.each([
		[
			"label-wrapped form field",
			'<label data-wid="e-1">Phone <input data-wid="e-2"></label>',
		],
		[
			"paragraph-wrapped image",
			'<p data-wid="e-1">Product <img data-wid="e-2" src="/product.png"></p>',
		],
	])("rejects a text edit that would destroy a nested %s", (_, target) => {
		const html = `<!doctype html><html><body>${target}</body></html>`;
		const result = applyOps(html, [
			{ kind: "text", value: "Updated copy", wid: "e-1" },
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason:
				"text edits are not supported on elements with non-inline child elements",
		});
	});

	it.each([
		[
			"stamped span",
			'<p data-wid="e-1">Price <span data-wid="e-2">4 500 DZD</span></p>',
		],
		[
			"nested stamped link",
			'<p data-wid="e-1"><em>Order <a data-wid="e-2" href="/order">today</a></em></p>',
		],
	])("flattens a nested %s when replacing text", (_, target) => {
		const html = `<!doctype html><html><body>${target}</body></html>`;
		const result = applied(html, [
			{ kind: "text", value: "Updated copy", wid: "e-1" },
		]);
		const edited = cheerio.load(result.html)('[data-wid="e-1"]');

		expect(edited.text()).toBe("Updated copy");
		expect(edited.children()).toHaveLength(0);
		expect(result.editedWids).toEqual(["e-1"]);
	});

	it("applies a child removal before its parent text edit", () => {
		const html = `<!doctype html><html><body>
			<h1 data-wid="e-1">Fast <span data-wid="e-2">delivery</span></h1>
		</body></html>`;
		const result = applied(html, [
			{ kind: "remove-element", wid: "e-2" },
			{ kind: "text", value: "Updated delivery", wid: "e-1" },
		]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="e-1"]').text()).toBe("Updated delivery");
		expect($('[data-wid="e-1"]').children()).toHaveLength(0);
		expect($('[data-wid="e-2"]')).toHaveLength(0);
		expect(result.editedWids).toEqual(["e-2", "e-1"]);
	});

	it("flattens inline formatting when replacing text", () => {
		const html = `<!doctype html><html><body>
			<p data-wid="e-1">By <em>appointment</em>, seven days</p>
		</body></html>`;
		const result = applied(html, [
			{ kind: "text", value: "Open <daily> & late", wid: "e-1" },
		]);
		const paragraph = cheerio.load(result.html)('[data-wid="e-1"]');

		expect(paragraph.text()).toBe("Open <daily> & late");
		expect(paragraph.children().length).toBe(0);
		expect(result.html).toContain("Open &lt;daily&gt; &amp; late");
	});

	it("rejects a text edit with an unstamped non-inline child", () => {
		const html = `<!doctype html><html><body>
			<blockquote data-wid="e-1">Before<div>Nested block</div></blockquote>
		</body></html>`;

		expect(
			applyOps(html, [{ kind: "text", value: "After", wid: "e-1" }]),
		).toEqual({
			index: 0,
			ok: false,
			reason:
				"text edits are not supported on elements with non-inline child elements",
		});
	});

	it("reports the zero-based index of the first failing op in a batch", () => {
		const result = applyOps(PAGE, [
			{ kind: "text", value: "ok", wid: "e-1" },
			{ kind: "element-style", value: { color: "#123456" }, wid: "e-2" },
			{ kind: "text", value: "nope", wid: "e-99" },
		]);

		expect(result).toEqual({
			index: 2,
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

	it("swaps a brand wrapper to a constrained logo and preserves its outer contract", () => {
		const originalHtml =
			'<span data-wid="e-2"> Wandit <strong data-wid="e-3">Studio</strong> </span>';
		const cleanOriginalHtml = "<span> Wandit <strong>Studio</strong> </span>";
		const html = `<!doctype html><html><body><header data-wid="hero"><nav>
			<a class="wordmark" data-wid="e-1" href="/">${originalHtml}</a>
		</nav></header></body></html>`;
		const result = applied(html, [
			{
				kind: "brand-logo",
				value: "https://assets.example.com/uploads/user/logo.png",
				wid: "e-1",
			},
		]);
		const $ = cheerio.load(result.html);
		const wrapper = $('[data-wid="e-1"]');
		const image = wrapper.children("img[data-wandit-brand-image]");

		expect(wrapper.prop("tagName")?.toLowerCase()).toBe("a");
		expect(wrapper.attr("href")).toBe("/");
		expect(wrapper.attr("class")).toBe("wordmark");
		expect(wrapper.attr("data-brand")).toBe("nav");
		expect(wrapper.attr("data-wandit-brand-logo")).toBe("1");
		expect(wrapper.attr("data-wandit-orig-brand-snapshot")).toBe("1");
		expect(wrapper.attr("data-wandit-orig-brand-html")).toBe(cleanOriginalHtml);
		expect(image.attr("src")).toBe(
			"https://assets.example.com/uploads/user/logo.png",
		);
		expect(image.attr("alt")).toBe("Wandit Studio");
		expect(image.attr("style")).toBe(
			"display:block;width:auto;height:auto;max-width:min(12rem,40vw);max-height:3rem;object-fit:contain;object-position:center",
		);

		const restamped = cheerio.load(stampHtml(result.html));

		expect(restamped('[data-wid="e-1"]')).toHaveLength(1);
		expect(restamped('span[data-wid="e-2"]')).toHaveLength(0);
		expect(
			restamped('[data-wid="e-1"] > img[data-wandit-brand-image]').attr(
				"data-wid",
			),
		).toMatch(/^e-\d+$/);
	});

	it("replaces a brand logo again without overwriting the original snapshot", () => {
		const html = `<!doctype html><html><body><header><a data-wid="brand" href="/">
			<span>Original brand</span>
		</a></header></body></html>`;
		const first = applied(html, [
			{
				kind: "brand-logo",
				value: "https://assets.example.com/uploads/user/first.png",
				wid: "brand",
			},
		]);
		const originalSnapshot = cheerio
			.load(first.html)('[data-wid="brand"]')
			.attr("data-wandit-orig-brand-html");
		const second = applied(first.html, [
			{
				kind: "brand-logo",
				value: "https://assets.example.com/uploads/user/second.webp",
				wid: "brand",
			},
		]);
		const wrapper = cheerio.load(second.html)('[data-wid="brand"]');

		expect(wrapper.attr("data-wandit-orig-brand-html")).toBe(originalSnapshot);
		expect(wrapper.find("img")).toHaveLength(1);
		expect(wrapper.find("img").attr("src")).toBe(
			"https://assets.example.com/uploads/user/second.webp",
		);
	});

	it("restores wid-free original brand HTML and clears only swap metadata", () => {
		const html = `<!doctype html><html><body><footer>
			<figure data-wid="footer-mark" data-brand="footer"><span data-wid="e-2">Wandit</span><small data-wid="e-3">Studio</small></figure>
		</footer></body></html>`;
		const swapped = applied(html, [
			{
				kind: "brand-logo",
				value: "https://assets.example.com/uploads/user/logo.avif",
				wid: "footer-mark",
			},
		]);
		const restored = applied(swapped.html, [
			{ kind: "brand-logo", value: null, wid: "footer-mark" },
		]);
		const wrapper = cheerio.load(restored.html)('[data-wid="footer-mark"]');

		expect(wrapper.html()).toBe("<span>Wandit</span><small>Studio</small>");
		expect(wrapper.find("[data-wid]")).toHaveLength(0);
		expect(wrapper.attr("data-brand")).toBe("footer");
		expect(wrapper.attr("data-wandit-brand-logo")).toBeUndefined();
		expect(wrapper.attr("data-wandit-orig-brand-html")).toBeUndefined();
		expect(wrapper.attr("data-wandit-orig-brand-snapshot")).toBeUndefined();
	});

	it("uses an aria label for accessibility without duplicating it in img alt", () => {
		const html = `<!doctype html><html><body><header>
			<a data-wid="brand" href="/" aria-label="Wandit home">Wandit</a>
		</header></body></html>`;
		const result = applied(html, [
			{
				kind: "brand-logo",
				value: "https://assets.example.com/uploads/user/logo.gif",
				wid: "brand",
			},
		]);

		expect(
			cheerio.load(result.html)('[data-wid="brand"] img').attr("alt"),
		).toBe("");
	});

	it("restores legacy no-snapshot logos from aria-label or img alt", () => {
		const html = `<!doctype html><html><body><footer>
			<a data-wid="aria-brand" aria-label="Wandit Home"><img alt=""></a>
			<figure data-wid="alt-brand"><img alt="Wandit Footer"></figure>
		</footer></body></html>`;
		const result = applied(html, [
			{ kind: "brand-logo", value: null, wid: "aria-brand" },
			{ kind: "brand-logo", value: null, wid: "alt-brand" },
		]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="aria-brand"]').text()).toBe("Wandit Home");
		expect($('[data-wid="alt-brand"]').text()).toBe("Wandit Footer");
		expect($('[data-wid="aria-brand"]').attr("data-brand")).toBe("footer");
		expect($('[data-wid="alt-brand"]').attr("data-brand")).toBe("footer");
	});

	it("fails legacy brand restore without text and keeps an already-restored target idempotent", () => {
		const missingText = `<!doctype html><html><body><header>
			<a data-wid="brand" data-wandit-brand-logo="1"><img data-wandit-brand-image alt=""></a>
		</header></body></html>`;

		expect(
			applyOps(missingText, [
				{ kind: "brand-logo", value: null, wid: "brand" },
			]),
		).toEqual({
			index: 0,
			ok: false,
			reason: "no original brand text to restore",
		});

		const restored = `<!doctype html><html><body><header>
			<a data-brand="nav" data-wid="brand">Wandit</a>
		</header></body></html>`;

		expect(
			applied(restored, [{ kind: "brand-logo", value: null, wid: "brand" }])
				.html,
		).toBe(cheerio.load(restored).html());
	});

	it("rejects brand-logo targets outside the allowed scope or wrapper tags", () => {
		const outside = `<!doctype html><html><body><main><a data-wid="brand">Wandit</a></main></body></html>`;
		const wrongTag = `<!doctype html><html><body><header><h1 data-wid="brand">Wandit</h1></header></body></html>`;
		const op = {
			kind: "brand-logo" as const,
			value: "https://assets.example.com/uploads/user/logo.png",
			wid: "brand",
		};

		for (const html of [outside, wrongTag]) {
			expect(applyOps(html, [op])).toEqual({
				index: 0,
				ok: false,
				reason: "target is not a brand wrapper inside header, nav, or footer",
			});
		}
	});

	it("replaces an image with a dimension-preserving placeholder", () => {
		const result = applied(PAGE, [
			{
				kind: "placeholder-image",
				value: { height: 600, width: 800 },
				wid: "e-3",
			},
		]);
		const image = cheerio.load(result.html)('[data-wid="e-3"]');

		expect(image.attr("src")).toBe(PLACEHOLDER_IMAGE_SRC);
		expect(image.attr("srcset")).toBeUndefined();
		expect(image.attr("sizes")).toBeUndefined();
		expect(image.attr("alt")).toBe("");
		expect(image.attr("data-wandit-placeholder")).toBe("1");
		expect(image.attr("data-wandit-orig-snapshot")).toBe("1");
		expect(image.attr("data-wandit-orig-srcset")).toBe("a 1x");
		expect(image.attr("data-wandit-orig-sizes")).toBe("100vw");
		expect(image.attr("data-wandit-orig-width")).toBeUndefined();
		expect(image.attr("data-wandit-orig-height")).toBeUndefined();
		expect(image.attr("data-wandit-orig-style")).toBeUndefined();
		expect(image.attr("width")).toBe("800");
		expect(image.attr("height")).toBe("600");
		expect(image.attr("style")).toContain("aspect-ratio: 800 / 600");
		expect(result.editedWids).toEqual(["e-3"]);

		const restamped = cheerio.load(stampHtml(result.html))('[data-wid="e-3"]');

		expect(restamped.attr("data-wid")).toBe("e-3");
		expect(restamped.attr("data-wandit-placeholder")).toBe("1");
	});

	it("replaces an image with a placeholder without inventing dimensions", () => {
		const html = `<!doctype html><html><body>
			<img data-wid="e-1" src="https://assets.example.com/a.png" srcset="a 1x" sizes="100vw">
		</body></html>`;
		const result = applied(html, [{ kind: "placeholder-image", wid: "e-1" }]);
		const image = cheerio.load(result.html)('[data-wid="e-1"]');

		expect(image.attr("src")).toBe(PLACEHOLDER_IMAGE_SRC);
		expect(image.attr("data-wandit-placeholder")).toBe("1");
		expect(image.attr("width")).toBeUndefined();
		expect(image.attr("height")).toBeUndefined();
		expect(image.attr("style")).toBeUndefined();
		expect(image.attr("srcset")).toBeUndefined();
		expect(image.attr("sizes")).toBeUndefined();
	});

	it("rejects placeholder-image on non-images, SVG artwork, and unknown wids", () => {
		expect(applyOps(PAGE, [{ kind: "placeholder-image", wid: "e-1" }])).toEqual(
			{
				index: 0,
				ok: false,
				reason: "target is not an <img>",
			},
		);

		const svgArtwork = `<!doctype html><html><body><svg>
			<foreignObject><img data-wid="e-1" src="/art.png"></foreignObject>
		</svg></body></html>`;

		expect(
			applyOps(svgArtwork, [{ kind: "placeholder-image", wid: "e-1" }]),
		).toEqual({
			index: 0,
			ok: false,
			reason: "target is not a stamped editable leaf",
		});

		expect(
			applyOps(PAGE, [{ kind: "placeholder-image", wid: "e-99" }]),
		).toEqual({
			index: 0,
			ok: false,
			reason: 'no element with data-wid="e-99"',
		});
	});

	it("restores a legacy placeholder without sizing residue", () => {
		const html = `<!doctype html><html><body>
			<img data-wid="e-1" src="${PLACEHOLDER_IMAGE_SRC}"
				data-wandit-placeholder="1" width="800" height="600"
				style="object-fit: cover; aspect-ratio: 800 / 600; border-radius: 1rem"
				srcset="placeholder 1x" sizes="100vw">
		</body></html>`;
		const result = applied(html, [
			{
				kind: "image-src",
				value: "https://assets.example.com/replacement.png",
				wid: "e-1",
			},
		]);
		const image = cheerio.load(result.html)('[data-wid="e-1"]');
		const style = image.attr("style") ?? "";

		expect(image.attr("src")).toBe(
			"https://assets.example.com/replacement.png",
		);
		expect(image.attr("data-wandit-placeholder")).toBeUndefined();
		expect(image.attr("data-wandit-orig-snapshot")).toBeUndefined();
		expect(image.attr("width")).toBeUndefined();
		expect(image.attr("height")).toBeUndefined();
		expect(image.attr("srcset")).toBeUndefined();
		expect(image.attr("sizes")).toBeUndefined();
		expect(style).not.toContain("aspect-ratio");
		expect(style).toContain("object-fit: cover");
		expect(style).toContain("border-radius: 1rem");
	});

	it("round-trips builder image sizing, style, srcset, and sizes safely", () => {
		const originalSrcset =
			"https://assets.example.com/product-480.jpg 480w, https://assets.example.com/product-960.jpg 960w";
		const originalSizes = "(max-width: 640px) 100vw, 50vw";
		const originalStyle =
			'object-fit: cover; background-image: url("https://assets.example.com/frame.png"); border-radius: 1rem';
		const html = `<!doctype html><html><body>
			<img data-wid="e-1" src="https://assets.example.com/product.jpg"
				width="1200" height="800" srcset="${originalSrcset}"
				sizes="${originalSizes}" style='${originalStyle}'>
		</body></html>`;
		const placeholder = applied(html, [
			{
				kind: "placeholder-image",
				value: { height: 600, width: 800 },
				wid: "e-1",
			},
		]);
		const placeholderImage = cheerio.load(placeholder.html)('[data-wid="e-1"]');

		expect(placeholderImage.attr("data-wandit-orig-width")).toBe("1200");
		expect(placeholderImage.attr("data-wandit-orig-height")).toBe("800");
		expect(placeholderImage.attr("data-wandit-orig-srcset")).toBe(
			originalSrcset,
		);
		expect(placeholderImage.attr("data-wandit-orig-sizes")).toBe(originalSizes);
		expect(placeholderImage.attr("data-wandit-orig-style")).toBe(originalStyle);

		const restored = applied(placeholder.html, [
			{
				kind: "image-src",
				value: "https://assets.example.com/replacement.png",
				wid: "e-1",
			},
		]);
		const image = cheerio.load(restored.html)('[data-wid="e-1"]');

		expect(image.attr("src")).toBe(
			"https://assets.example.com/replacement.png",
		);
		expect(image.attr("width")).toBe("1200");
		expect(image.attr("height")).toBe("800");
		expect(image.attr("srcset")).toBe(originalSrcset);
		expect(image.attr("sizes")).toBe(originalSizes);
		expect(image.attr("style")).toBe(originalStyle);
		expect(image.attr("data-wandit-placeholder")).toBeUndefined();
		expect(image.attr("data-wandit-orig-snapshot")).toBeUndefined();

		for (const name of ["width", "height", "srcset", "sizes", "style"]) {
			expect(image.attr(`data-wandit-orig-${name}`)).toBeUndefined();
		}
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

	it("writes the extended typography element styles", () => {
		const result = applied(PAGE, [
			{
				kind: "element-style",
				value: {
					borderRadius: "0.75rem",
					fontStyle: "italic",
					fontWeight: 600,
					letterSpacing: "-0.025em",
					lineHeight: 1.6,
					textAlign: "end",
				},
				wid: "e-2",
			},
		]);
		const style = cheerio.load(result.html)('[data-wid="e-2"]').attr("style");

		expect(style).toContain("border-radius: 0.75rem");
		expect(style).toContain("font-style: italic");
		expect(style).toContain("font-weight: 600");
		expect(style).toContain("letter-spacing: -0.025em");
		expect(style).toContain("line-height: 1.6");
		expect(style).toContain("text-align: end");
	});

	it("writes image-only width and object-fit styles", () => {
		const result = applied(PAGE, [
			{
				kind: "element-style",
				value: { objectFit: "contain", width: "80%" },
				wid: "e-3",
			},
		]);
		const style = cheerio.load(result.html)('[data-wid="e-3"]').attr("style");

		expect(style).toContain("object-fit: contain");
		expect(style).toContain("width: 80%");
	});

	it("rejects width and object-fit on non-image targets", () => {
		expect(
			applyOps(PAGE, [
				{ kind: "element-style", value: { width: "80%" }, wid: "e-2" },
			]),
		).toEqual({
			index: 0,
			ok: false,
			reason: "width is only supported for <img> elements",
		});
		expect(
			applyOps(PAGE, [
				{
					kind: "element-style",
					value: { objectFit: "cover" },
					wid: "e-2",
				},
			]),
		).toEqual({
			index: 0,
			ok: false,
			reason: "object-fit is only supported for <img> elements",
		});
	});

	it("allows background-color on links, buttons, surfaces, and top-level sections", () => {
		const html = PAGE.replace(
			'<h1 data-wid="e-1">Old title</h1>',
			'<div data-wid="surface"><h1 data-wid="e-1">Old title</h1></div>',
		).replace(
			'<a data-wid="e-5"',
			'<button data-wid="e-6">Order</button><a data-wid="e-5"',
		);
		const result = applied(html, [
			{
				kind: "element-style",
				value: { backgroundColor: "#112233" },
				wid: "hero",
			},
			{
				kind: "element-style",
				value: { backgroundColor: "#223344" },
				wid: "e-5",
			},
			{
				kind: "element-style",
				value: { backgroundColor: "#334455" },
				wid: "e-6",
			},
			{
				kind: "element-style",
				value: { backgroundColor: "#445566" },
				wid: "surface",
			},
		]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="hero"]').attr("style")).toContain(
			"background-color: #112233",
		);
		expect($('[data-wid="e-5"]').attr("style")).toContain(
			"background-color: #223344",
		);
		expect($('[data-wid="e-6"]').attr("style")).toContain(
			"background-color: #334455",
		);
		expect($('[data-wid="surface"]').attr("style")).toContain(
			"background-color: #445566",
		);
	});

	it("rejects background-color on other leaf targets", () => {
		const result = applyOps(PAGE, [
			{
				kind: "element-style",
				value: { backgroundColor: "#112233" },
				wid: "e-2",
			},
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason:
				"background-color is only supported for links, buttons, stampable containers, and top-level sections",
		});
	});

	it("rejects physical text-align values in the contract", () => {
		expect(
			elementStyleOpSchema.safeParse({
				kind: "element-style",
				value: { textAlign: "left" },
				wid: "e-2",
			}).success,
		).toBe(false);
		expect(
			elementStyleOpSchema.safeParse({
				kind: "element-style",
				value: { textAlign: "right" },
				wid: "e-2",
			}).success,
		).toBe(false);
	});

	it.each([
		["font-weight 100", { fontWeight: 100 }],
		["font-weight 900", { fontWeight: 900 }],
		["font-weight normal", { fontWeight: "normal" }],
		["font-weight bold", { fontWeight: "bold" }],
		["line-height 1", { lineHeight: 1 }],
		["line-height 2.5", { lineHeight: 2.5 }],
		["letter-spacing -0.05em", { letterSpacing: "-0.05em" }],
		["letter-spacing 0.5em", { letterSpacing: "0.5em" }],
		["border-radius 0px", { borderRadius: "0px" }],
		["border-radius 64px", { borderRadius: "64px" }],
		["border-radius rem", { borderRadius: "1.5rem" }],
		["pill border-radius", { borderRadius: "9999px" }],
		["width 10%", { width: "10%" }],
		["width 100%", { width: "100%" }],
	])("accepts the %s element-style boundary", (_, value) => {
		expect(
			elementStyleOpSchema.safeParse({
				kind: "element-style",
				value,
				wid: "e-2",
			}).success,
		).toBe(true);
	});

	it.each([
		["font-weight step", { fontWeight: 550 }],
		["font-weight range", { fontWeight: 1_000 }],
		["line-height minimum", { lineHeight: 0.99 }],
		["line-height maximum", { lineHeight: 2.51 }],
		["letter-spacing minimum", { letterSpacing: "-0.051em" }],
		["letter-spacing maximum", { letterSpacing: "0.501em" }],
		["letter-spacing unit", { letterSpacing: "0.1px" }],
		["border-radius range", { borderRadius: "65px" }],
		["border-radius sign", { borderRadius: "-1px" }],
		["width minimum", { width: "9%" }],
		["width maximum", { width: "101%" }],
		["width fraction", { width: "10.5%" }],
	])("rejects an invalid %s element style", (_, value) => {
		expect(
			elementStyleOpSchema.safeParse({
				kind: "element-style",
				value,
				wid: "e-2",
			}).success,
		).toBe(false);
	});

	it("keeps client ops visible and raw-HTML operations internal", () => {
		const placeholder = {
			kind: "set-placeholder",
			value: "Name",
			wid: "e-1",
		};
		const replacement = {
			kind: "replace-section",
			value: "<section><p>Replacement copy</p></section>",
			wid: "hero",
		};
		const elementInsertion = {
			kind: "insert-element",
			position: "append",
			value: "<button>Order now</button>",
			wid: "hero",
		};
		const sectionInsertion = {
			kind: "insert-section",
			position: "before",
			value: "<aside><p>Free delivery today</p></aside>",
			wid: "hero",
		};
		const imagePlaceholder = { kind: "placeholder-image", wid: "e-3" };
		const brandLogo = {
			kind: "brand-logo",
			value: "https://assets.example.com/uploads/user/logo.png",
			wid: "e-5",
		};
		const tokenReset = { kind: "reset-tokens" };

		expect(clientEditOpSchema.safeParse(placeholder).success).toBe(true);
		expect(clientEditOpSchema.safeParse(imagePlaceholder).success).toBe(true);
		expect(clientEditOpSchema.safeParse(brandLogo).success).toBe(true);
		expect(clientEditOpSchema.safeParse(tokenReset).success).toBe(true);
		expect(editOpSchema.safeParse(imagePlaceholder).success).toBe(true);
		expect(editOpSchema.safeParse({ ...brandLogo, value: null }).success).toBe(
			true,
		);
		expect(editOpSchema.safeParse(tokenReset).success).toBe(true);
		expect(clientEditOpSchema.safeParse(replacement).success).toBe(false);
		expect(editOpSchema.safeParse(replacement).success).toBe(true);
		expect(clientEditOpSchema.safeParse(elementInsertion).success).toBe(false);
		expect(editOpSchema.safeParse(elementInsertion).success).toBe(true);
		expect(clientEditOpSchema.safeParse(sectionInsertion).success).toBe(false);
		expect(editOpSchema.safeParse(sectionInsertion).success).toBe(true);
		expect(
			setPlaceholderOpSchema.safeParse({
				...placeholder,
				value: "x".repeat(200),
			}).success,
		).toBe(true);
		expect(
			setPlaceholderOpSchema.safeParse({
				...placeholder,
				value: "x".repeat(201),
			}).success,
		).toBe(false);
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

	it("leaves literal button radii untouched when the radius token changes", () => {
		const html = PAGE.replace(
			"body { color: var(--foreground); }",
			"body { color: var(--foreground); }\nbutton { border-radius: 999px; }",
		);
		const result = applied(html, [
			{ kind: "set-tokens", value: { radius: "0.25rem" } },
		]);

		expect(result.html).toContain("--radius: 0.25rem;");
		expect(result.html).toContain("button { border-radius: 999px; }");
	});

	it("resets tokens to raw original values and restores original font links", () => {
		const googleHref =
			"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700&display=swap";
		const fontshareHref = "https://api.fontshare.com/v2/css?family=Sentient";
		const html = PAGE.replace(
			"<style>:root {",
			`<link rel="stylesheet" href="${googleHref}">\n<style>:root {`,
		);
		const originalValues = {
			background: "oklch(0.92 0.04 82)",
			"font-body": '"Sentient", Georgia, serif',
			"font-heading": '"Cormorant Garamond", Georgia, serif',
			primary: "color(display-p3 0.62 0.21 0.08)",
			radius: "clamp(2px, 0.4vw, 7px)",
		} as const;
		const result = applied(html, [{ kind: "reset-tokens" }], {
			originalTheme: {
				fontLinkHrefs: [googleHref, googleHref, fontshareHref, fontshareHref],
				values: originalValues,
			},
		});
		const $ = cheerio.load(result.html);
		const stylesheetHrefs = $('link[rel="stylesheet"]')
			.map((_, node) => $(node).attr("href"))
			.get();

		expect(extractRootTokens(result.html)).toMatchObject(originalValues);
		expect(result.html).toContain("--background: oklch(0.92 0.04 82);");
		expect(result.html).toContain(
			'--font-heading: "Cormorant Garamond", Georgia, serif;',
		);
		expect(result.html).toContain('--font-body: "Sentient", Georgia, serif;');
		expect(result.html).toContain(
			"--primary: color(display-p3 0.62 0.21 0.08);",
		);
		expect(stylesheetHrefs.filter((href) => href === googleHref)).toHaveLength(
			1,
		);
		expect(
			stylesheetHrefs.filter((href) => href === fontshareHref),
		).toHaveLength(1);
		expect(
			$('link[rel="preconnect"][href="https://fonts.googleapis.com"]'),
		).toHaveLength(1);
		expect(
			$('link[rel="preconnect"][href="https://fonts.gstatic.com"]'),
		).toHaveLength(1);
		expect(result.editedWids).toEqual(["__tokens__"]);
	});

	it("fails reset-tokens without server-resolved original theme context", () => {
		expect(applyOps(PAGE, [{ kind: "reset-tokens" }])).toEqual({
			index: 0,
			ok: false,
			reason: "no original theme is available for this page",
		});
	});

	it("extracts raw values from the first :root token block", () => {
		const html = `<!doctype html><html><head>
			<style>:root { --primary: oklch(0.7 0.1 200); --font-heading: "Newsreader", serif; --custom: ignored; }</style>
			<style>:root { --primary: #000000; --radius: 2px; }</style>
		</head><body></body></html>`;

		expect(extractRootTokens(html)).toEqual({
			"font-heading": '"Newsreader", serif',
			primary: "oklch(0.7 0.1 200)",
		});
	});

	it("returns no theme values when the page has no :root block", () => {
		expect(
			extractRootTokens(
				"<!doctype html><html><head><style>body { color: red; }</style></head><body></body></html>",
			),
		).toEqual({});
	});

	it("creates a style and :root block when set-tokens finds neither", () => {
		const html =
			'<!doctype html><html><head></head><body><p data-wid="e-1">x</p></body></html>';
		const result = applied(html, [
			{ kind: "set-tokens", value: { primary: "#123456" } },
		]);
		const $ = cheerio.load(result.html);

		expect($("head > style").length).toBe(1);
		expect($("head > style").text()).toContain(":root {");
		expect($("head > style").text()).toContain("--primary: #123456;");
	});

	it("prepends a :root block to the first existing style", () => {
		const html = `<!doctype html><html><head>
			<style>body { color: red; }</style><style>.card { color: blue; }</style>
			</head><body><p data-wid="e-1">x</p></body></html>`;
		const result = applied(html, [
			{ kind: "set-tokens", value: { primary: "#123456" } },
		]);
		const styles = cheerio.load(result.html)("style");

		expect(styles.first().text().startsWith(":root {")).toBe(true);
		expect(styles.first().text()).toContain("--primary: #123456;");
		expect(styles.first().text()).toContain("body { color: red; }");
		expect(styles.eq(1).text()).toBe(".card { color: blue; }");
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

	it("preserves legacy font links when set-tokens injects the first :root", () => {
		const originalHref =
			"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap";
		const html = `<!doctype html><html><head>
			<link rel="stylesheet" href="${originalHref}">
			<style>h1 { font-family: "Playfair Display", serif; }</style>
			</head><body><h1 data-wid="e-1">Legacy title</h1></body></html>`;
		const result = applied(html, [
			{
				kind: "set-tokens",
				value: { "font-body": "cairo", "font-heading": "manrope" },
			},
		]);
		const $ = cheerio.load(result.html);
		const fontHrefs = $('link[href*="fonts.googleapis.com/css"]')
			.map((_, node) => $(node).attr("href"))
			.get();

		expect(fontHrefs).toContain(originalHref);
		expect(fontHrefs).toContain(
			"https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Cairo:wght@400;600;700;800;900&display=swap",
		);
		expect($("style").first().text()).toContain(
			'--font-heading: "Manrope", sans-serif;',
		);
		expect($("style").first().text()).toContain(
			'--font-body: "Cairo", sans-serif;',
		);
	});

	it("inserts elements in batch order and removes fragment-provided wids", () => {
		const result = applied(PAGE, [
			{
				kind: "insert-element",
				position: "before",
				value:
					'<p data-wid="stolen-before"><span data-wid="stolen-child">Before</span></p>',
				wid: "e-1",
			},
			{
				kind: "insert-element",
				position: "after",
				value: '<button data-wid="stolen-after">After</button>',
				wid: "e-1",
			},
			{
				kind: "insert-element",
				position: "append",
				value: '<a data-wid="stolen-append" href="#order">Append</a>',
				wid: "hero",
			},
		]);
		const $ = cheerio.load(result.html);
		const children = $('[data-wid="hero"]')
			.children()
			.map((_, node) => `${$(node).prop("tagName")}:${$(node).text()}`)
			.get();

		expect(children).toEqual([
			"P:Before",
			"H1:Old title",
			"BUTTON:After",
			"P:Old copy",
			"IMG:",
			"A:+212 600 000 000",
			"A:Append",
		]);
		expect($('[data-wid^="stolen-"]').length).toBe(0);
		expect(result.editedWids).toEqual(["e-1", "hero"]);
	});

	it.each([
		["img", PAGE, "e-3"],
		[
			"input",
			'<!doctype html><html><body><input data-wid="field"></body></html>',
			"field",
		],
	])("rejects appending an element into a stamped <%s>", (_, html, wid) => {
		expect(
			applyOps(html, [
				{
					kind: "insert-element",
					position: "append",
					value: "<span>New content</span>",
					wid,
				},
			]),
		).toEqual({
			index: 0,
			ok: false,
			reason:
				"append is not supported for a void element like <img> or <input> — use position before or after",
		});
	});

	it("inserts elements before and after a stamped <img>", () => {
		const result = applied(PAGE, [
			{
				kind: "insert-element",
				position: "before",
				value: '<span class="before-image">Before image</span>',
				wid: "e-3",
			},
			{
				kind: "insert-element",
				position: "after",
				value: '<span class="after-image">After image</span>',
				wid: "e-3",
			},
		]);
		const $ = cheerio.load(result.html);
		const image = $('[data-wid="e-3"]');

		expect(image.prev().attr("class")).toBe("before-image");
		expect(image.prev().text()).toBe("Before image");
		expect(image.next().attr("class")).toBe("after-image");
		expect(image.next().text()).toBe("After image");
	});

	it("inserts section roots before and after top-level anchors", () => {
		const result = applied(PAGE, [
			{
				kind: "insert-section",
				position: "before",
				value:
					'<aside data-wid="stolen-top"><p data-wid="stolen-copy">Notice</p></aside>',
				wid: "hero",
			},
			{
				kind: "insert-section",
				position: "after",
				value:
					'<footer data-wid="stolen-bottom"><p data-wid="stolen-footer-copy">Footer</p></footer>',
				wid: "reviews",
			},
		]);
		const $ = cheerio.load(result.html);
		const sections = $("body")
			.children("header, section, footer, aside, nav")
			.map((_, node) => $(node).text().replace(/\s+/g, " ").trim())
			.get();

		expect(sections).toEqual([
			"Notice",
			"Old title Old copy +212 600 000 000",
			"Reviews",
			"Footer",
		]);
		expect($('[data-wid^="stolen-"]').length).toBe(0);
		expect(result.editedWids).toEqual(["hero", "reviews"]);
	});

	it.each([
		[
			"insert-element target",
			{
				kind: "insert-element" as const,
				position: "after" as const,
				value: "<p>New copy</p>",
				wid: "missing",
			},
			'no element with data-wid="missing"',
		],
		[
			"insert-section anchor",
			{
				kind: "insert-section" as const,
				position: "after" as const,
				value: "<section><p>New section</p></section>",
				wid: "e-1",
			},
			"anchor is not a top-level section",
		],
	])("rejects an invalid %s", (_, op, reason) => {
		expect(applyOps(PAGE, [op])).toEqual({
			index: 0,
			ok: false,
			reason,
		});
	});

	it.each([
		[
			"multiple element roots",
			{
				kind: "insert-element" as const,
				position: "append" as const,
				value: "<p>One</p><p>Two</p>",
				wid: "hero",
			},
			"inserted HTML must contain exactly one element",
		],
		[
			"non-section root",
			{
				kind: "insert-section" as const,
				position: "after" as const,
				value: "<div><p>Not a section</p></div>",
				wid: "hero",
			},
			"inserted HTML root is not a section element",
		],
	])("rejects inserted HTML with %s", (_, op, reason) => {
		expect(applyOps(PAGE, [op])).toEqual({
			index: 0,
			ok: false,
			reason,
		});
	});

	it.each([
		[
			"a forbidden tag",
			"<script>alert(1)</script>",
			"must not contain <script> elements",
		],
		[
			"an event handler",
			'<button onclick="alert(1)">Buy</button>',
			'must not carry event-handler attributes ("onclick")',
		],
		[
			"srcdoc",
			'<div srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></div>',
			'must not carry "srcdoc" attributes',
		],
		[
			"a script-scheme URL",
			'<a href="java&#x09;script:alert(1)">Buy</a>',
			'must not use script-scheme URLs ("href")',
		],
		[
			"CSS @import",
			'<style>@import url("https://evil.example/style.css");</style>',
			"must not use CSS @import",
		],
	])("rejects raw HTML carrying %s before insertion", (_, active, reason) => {
		const rawOps = [
			{
				kind: "insert-element" as const,
				position: "append" as const,
				value: `<div>${active}</div>`,
				wid: "hero",
			},
			{
				kind: "insert-section" as const,
				position: "after" as const,
				value: `<section>${active}</section>`,
				wid: "hero",
			},
			{
				kind: "replace-section" as const,
				value: `<section>${active}</section>`,
				wid: "reviews",
			},
		];

		for (const [index, op] of rawOps.entries()) {
			const label = index === 2 ? "replacement HTML" : "inserted HTML";

			expect(applyOps(PAGE, [op])).toEqual({
				index: 0,
				ok: false,
				reason: `${label} ${reason}`,
			});
		}
	});

	it.each([
		["YouTube", "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"],
		[
			"YouTube privacy-enhanced",
			"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
		],
		["Vimeo", "https://player.vimeo.com/video/123456789"],
		["Google Maps", "https://www.google.com/maps/embed?pb=map"],
		["Google Maps legacy path", "https://maps.google.com/maps/embed?pb=map"],
		["Google Maps short path", "https://maps.google.com/embed?pb=map"],
	])("accepts an HTTPS %s iframe embed", (_, src) => {
		const result = applied(PAGE, [
			{
				kind: "replace-section",
				value: `<section><iframe src="${src}" title="Map"></iframe></section>`,
				wid: "reviews",
			},
		]);
		const iframe = cheerio.load(result.html)("iframe");

		expect(iframe).toHaveLength(1);
		expect(iframe.attr("src")).toBe(src);
	});

	it("allows constrained iframe embeds through every raw-HTML fragment op", () => {
		const src = "https://www.youtube.com/embed/dQw4w9WgXcQ";
		const result = applied(PAGE, [
			{
				kind: "insert-element",
				position: "append",
				value: `<iframe src="${src}" title="Element embed"></iframe>`,
				wid: "hero",
			},
			{
				kind: "insert-section",
				position: "after",
				value: `<aside><iframe src="${src}" title="Section embed"></iframe></aside>`,
				wid: "hero",
			},
			{
				kind: "replace-section",
				value: `<section><iframe src="${src}" title="Replacement embed"></iframe></section>`,
				wid: "reviews",
			},
		]);

		expect(cheerio.load(result.html)("iframe")).toHaveLength(3);
	});

	it.each([
		["HTTP", '<iframe src="http://www.youtube.com/embed/video"></iframe>'],
		["a missing src", "<iframe></iframe>"],
		[
			"a lookalike YouTube host",
			'<iframe src="https://www.youtube.com.evil.example/embed/video"></iframe>',
		],
		[
			"a YouTube watch path",
			'<iframe src="https://www.youtube.com/watch?v=video"></iframe>',
		],
		[
			"a non-numeric Vimeo ID",
			'<iframe src="https://player.vimeo.com/video/not-numeric"></iframe>',
		],
		[
			"a non-embed Google Maps path",
			'<iframe src="https://www.google.com/maps/place/Algiers"></iframe>',
		],
		[
			"URL credentials",
			'<iframe src="https://attacker@www.youtube.com/embed/video"></iframe>',
		],
		[
			"a nonstandard port",
			'<iframe src="https://www.youtube.com:444/embed/video"></iframe>',
		],
		[
			"an explicit default port",
			'<iframe src="https://www.youtube.com:443/embed/video"></iframe>',
		],
	])("rejects an iframe embed using %s", (_, iframe) => {
		expect(
			applyOps(PAGE, [
				{
					kind: "replace-section",
					value: `<section>${iframe}</section>`,
					wid: "reviews",
				},
			]),
		).toEqual({
			index: 0,
			ok: false,
			reason:
				"replacement HTML <iframe> src must be an allowed HTTPS embed URL (YouTube, Vimeo, or Google Maps)",
		});
	});

	it.each([
		[
			"srcdoc",
			'<iframe src="https://www.youtube.com/embed/video" srcdoc="&lt;p&gt;Injected&lt;/p&gt;"></iframe>',
			'replacement HTML must not carry "srcdoc" attributes',
		],
		[
			"a script-scheme src",
			'<iframe src="java&#x09;script:alert(1)"></iframe>',
			'replacement HTML must not use script-scheme URLs ("src")',
		],
		[
			"an event handler",
			'<iframe src="https://www.youtube.com/embed/video" onload="alert(1)"></iframe>',
			'replacement HTML must not carry event-handler attributes ("onload")',
		],
		[
			"another forbidden active-content tag",
			'<iframe src="https://www.youtube.com/embed/video"></iframe><object></object>',
			"replacement HTML must not contain <object> elements",
		],
	])("rejects an otherwise allowed iframe carrying %s", (_, active, reason) => {
		expect(
			applyOps(PAGE, [
				{
					kind: "replace-section",
					value: `<section>${active}</section>`,
					wid: "reviews",
				},
			]),
		).toEqual({ index: 0, ok: false, reason });
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

	it("removes a placeholder image for real", () => {
		const result = applied(PAGE, [
			{ kind: "placeholder-image", wid: "e-3" },
			{ kind: "remove-element", wid: "e-3" },
		]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="e-3"]').length).toBe(0);
		expect(result.editedWids).toEqual(["e-3"]);
	});

	it("removes every kind of stamped text, form, media, and action leaf", () => {
		const html = `<!doctype html><html><body><section data-wid="hero">
			<h2 data-wid="e-1">Title</h2><p data-wid="e-2">Copy</p>
			<ul><li data-wid="e-3">Item</li></ul>
			<blockquote data-wid="e-4">Quote</blockquote>
			<figure><figcaption data-wid="e-5">Caption</figcaption></figure>
			<fieldset><legend data-wid="e-6">Order</legend></fieldset>
			<label data-wid="e-7">Name</label><span data-wid="e-8">COD</span>
			<input data-wid="e-9"><textarea data-wid="e-10"></textarea>
			<img data-wid="e-11" src="/product.png"><a data-wid="e-12">Call</a>
			<button data-wid="e-13">Order</button>
		</section></body></html>`;
		const wids = Array.from({ length: 13 }, (_, index) => `e-${index + 1}`);
		const result = applied(
			html,
			wids.map((wid) => ({ kind: "remove-element" as const, wid })),
		);
		const $ = cheerio.load(result.html);

		expect($('[data-wid^="e-"]').length).toBe(0);
		expect($('[data-wid="hero"]').length).toBe(1);
		expect(result.editedWids).toEqual(wids);
	});

	it.each([
		["input", '<input data-wid="field" name="phone" type="tel">'],
		["textarea", '<textarea data-wid="field" name="notes"></textarea>'],
	])("rejects removing a form %s", (_, control) => {
		const html = `<!doctype html><html><body><form>${control}<button data-wid="submit">Order</button></form></body></html>`;

		expect(applyOps(html, [{ kind: "remove-element", wid: "field" }])).toEqual({
			index: 0,
			ok: false,
			reason: "form input and textarea fields cannot be removed",
		});
	});

	it.each([
		["implicit submit button", '<button data-wid="submit">Order</button>'],
		[
			"explicit submit button",
			'<button data-wid="submit" type="submit">Order</button>',
		],
	])("rejects removing a form's only %s", (_, control) => {
		const html = `<!doctype html><html><body><form><input data-wid="field" type="tel">${control}</form></body></html>`;

		expect(applyOps(html, [{ kind: "remove-element", wid: "submit" }])).toEqual(
			{
				index: 0,
				ok: false,
				reason: "a form's only submit control cannot be removed",
			},
		);
	});

	it("allows removing one submit control when the form retains another", () => {
		const html = `<!doctype html><html><body><form>
			<button data-wid="submit-1">Order now</button>
			<button data-wid="submit-2" type="submit">Order another way</button>
		</form></body></html>`;
		const result = applied(html, [{ kind: "remove-element", wid: "submit-1" }]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="submit-1"]').length).toBe(0);
		expect($('[data-wid="submit-2"]').length).toBe(1);
	});

	it("never removes a section or an arbitrary stamped wrapper", () => {
		const sectionResult = applyOps(PAGE, [
			{ kind: "remove-element", wid: "hero" },
		]);
		const wrapperResult = applyOps(
			'<html><body><div data-wid="wrapper">x</div></body></html>',
			[{ kind: "remove-element", wid: "wrapper" }],
		);

		expect(sectionResult).toEqual({
			index: 0,
			ok: false,
			reason: "target is not a stamped editable leaf",
		});
		expect(wrapperResult).toEqual({
			index: 0,
			ok: false,
			reason: "target is not a stamped editable leaf",
		});
	});

	it("removes a span containing only inline formatting", () => {
		const result = applied(
			'<html><body><span data-wid="e-1">Price <strong>now</strong></span></body></html>',
			[{ kind: "remove-element", wid: "e-1" }],
		);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="e-1"]').length).toBe(0);
		expect(result.editedWids).toEqual(["e-1"]);
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

	it("sets escaped placeholders on input and textarea targets", () => {
		const html = `<!doctype html><html><body><section data-wid="form">
			<input data-wid="e-1"><textarea data-wid="e-2"></textarea>
		</section></body></html>`;
		const value = 'Your "full" name & <details>';
		const result = applied(html, [
			{ kind: "set-placeholder", value, wid: "e-1" },
			{ kind: "set-placeholder", value: "Notes", wid: "e-2" },
		]);
		const $ = cheerio.load(result.html);

		expect($('[data-wid="e-1"]').attr("placeholder")).toBe(value);
		expect($('[data-wid="e-2"]').attr("placeholder")).toBe("Notes");
		expect(result.html).not.toContain(`placeholder="${value}"`);
	});

	it("rejects set-placeholder on non-form targets", () => {
		const result = applyOps(PAGE, [
			{ kind: "set-placeholder", value: "Nope", wid: "e-2" },
		]);

		expect(result).toEqual({
			index: 0,
			ok: false,
			reason: "target is not an <input> or <textarea>",
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

	it("applies a background color through section-style", () => {
		const result = applied(PAGE, [
			{
				kind: "section-style",
				value: { backgroundColor: "#1234ab" },
				wid: "hero",
			},
		]);
		const style = cheerio.load(result.html)('[data-wid="hero"]').attr("style");

		expect(style).toContain("background-color: #1234ab");
		expect(result.editedWids).toEqual(["hero"]);
	});

	it("applies section styles through two generic wrappers", () => {
		const html = `<!doctype html><html><body><div><main>
			<section data-wid="order-form"><p data-wid="e-1">Order</p></section>
		</main></div></body></html>`;
		const result = applied(html, [
			{
				kind: "section-style",
				value: { paddingTop: "l" },
				wid: "order-form",
			},
		]);
		const style = cheerio
			.load(result.html)('[data-wid="order-form"]')
			.attr("style");

		expect(style).toContain("padding-top: clamp(4rem, 7vw, 6rem)");
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

	it("percent-encodes inline-style delimiters inside background image urls", () => {
		const result = applied(PAGE, [
			{
				kind: "section-style",
				value: {
					backgroundImage: "https://assets.example.com/banners/hero;(wide).png",
				},
				wid: "hero",
			},
		]);
		const style = cheerio.load(result.html)('[data-wid="hero"]').attr("style");

		expect(style).toContain(
			'url("https://assets.example.com/banners/hero%3B%28wide%29.png")',
		);
		expect(style).toContain("background-size: cover");
		expect(style).toContain("background-position: center");
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
