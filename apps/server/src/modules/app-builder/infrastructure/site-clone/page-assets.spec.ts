import { describe, expect, it } from "vitest";

import { stripPageHtml, styleSheetUrlsOf } from "./page-assets";

describe("stripPageHtml", () => {
	it("removes scripts, comments, and frames, and keeps the style and svg content", () => {
		const html = stripPageHtml(
			"<html><head><style>.a{color:red}</style><script>track()</script></head>" +
				'<body><!-- secret note --><svg viewBox="0 0 1 1"><path d="M0 0"></path><script>evil()</script></svg>' +
				'<noscript><img src="/pixel.gif"></noscript><iframe src="https://ads.example/frame"></iframe>' +
				"<p>Hello</p></body></html>",
		);

		expect(html).not.toMatch(
			/script|track\(\)|evil\(\)|secret note|iframe|pixel/,
		);
		expect(html).toContain("<style>.a{color:red}</style>");
		expect(html).toContain('<svg viewBox="0 0 1 1">\n<path d="M0 0">');
		expect(html).toContain("<p>Hello</p>");
	});

	it("replaces a data: URI above 1,000 chars and keeps a short one", () => {
		const longUri = `data:image/png;base64,${"A".repeat(2000)}`;
		const shortUri = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

		const html = stripPageHtml(
			`<img src="${longUri}"><img src="${shortUri}"><style>.b{background:url(${longUri})}</style>`,
		);

		expect(html).not.toContain("A".repeat(100));
		expect(html).toContain('<img src="data:removed">');
		expect(html).toContain(".b{background:url(data:removed)}");
		expect(html).toContain(shortUri);
	});
});

describe("styleSheetUrlsOf", () => {
	it.each([
		{ base: "", firstUrl: "https://example.com/shop/css/0.css" },
		// An Angular app has this tag, and its sheets are then not relative to the page path.
		{ base: '<base href="/">', firstUrl: "https://example.com/css/0.css" },
	])("resolves a relative href with the base '$base' and stops at 8 sheets", ({
		base,
		firstUrl,
	}) => {
		const links = Array.from(
			{ length: 10 },
			(_, index) => `<link rel="stylesheet" href="css/${index}.css">`,
		).join("");

		const urls = styleSheetUrlsOf(
			`<html><head>${base}${links}<link rel="icon" href="/favicon.ico"></head></html>`,
			"https://example.com/shop/page",
		);

		expect(urls).toHaveLength(8);
		expect(urls[0]).toBe(firstUrl);
	});
});
