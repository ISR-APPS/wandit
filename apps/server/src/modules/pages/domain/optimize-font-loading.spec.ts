import { describe, expect, it } from "vitest";

import { optimizeFontLoading } from "./optimize-font-loading";

const GOOGLE_PRECONNECT =
	'<link rel="preconnect" href="https://fonts.googleapis.com">';
const GSTATIC_PRECONNECT =
	'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
const CAIRO_LINK =
	'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap">';
const FONTSHARE_LINK =
	'<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@700,400&display=swap">';

function page(head: string, body = "<h1>Page</h1>"): string {
	return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>`;
}

function indexOfTag(html: string, needle: string): number {
	return html.indexOf(needle);
}

describe("optimizeFontLoading", () => {
	it("moves a trailing font stylesheet above the first inline style", () => {
		const html = page(
			`${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n<style>:root{--x:1}</style>\n${CAIRO_LINK}`,
		);
		const optimized = optimizeFontLoading(html);

		expect(indexOfTag(optimized, CAIRO_LINK)).toBeLessThan(
			indexOfTag(optimized, "<style>"),
		);
		// The preconnects keep leading the request they warm up.
		expect(indexOfTag(optimized, GSTATIC_PRECONNECT)).toBeLessThan(
			indexOfTag(optimized, CAIRO_LINK),
		);
		// href and rel are byte-identical: the editor matches them exactly.
		expect(optimized).toContain(CAIRO_LINK);
		expect(optimized.match(/fonts\.googleapis\.com\/css2/g)).toHaveLength(1);
		// Nothing outside <head> moves.
		expect(optimized).toContain("<body>\n<h1>Page</h1>\n</body>");
	});

	it("is idempotent: a second run returns the identical string", () => {
		const html = page(
			`${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n<style>:root{--x:1}</style>\n${CAIRO_LINK}`,
		);
		const once = optimizeFontLoading(html);
		const twice = optimizeFontLoading(once);

		expect(twice).toBe(once);
	});

	it("keeps a page whose links already precede the style byte-identical", () => {
		const html = page(
			`${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n${CAIRO_LINK}\n<style>:root{--x:1}</style>`,
		);

		expect(optimizeFontLoading(html)).toBe(html);
	});

	it("preserves every link and their relative order, Fontshare included", () => {
		const second =
			'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400&display=swap">';
		const html = page(
			`${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n<style>:root{--x:1}</style>\n${CAIRO_LINK}\n${FONTSHARE_LINK}\n${second}`,
		);
		const optimized = optimizeFontLoading(html);

		// A third family's link must survive: the worlds mandate three families
		// while only two of them have tokens.
		expect(indexOfTag(optimized, CAIRO_LINK)).toBeLessThan(
			indexOfTag(optimized, FONTSHARE_LINK),
		);
		expect(indexOfTag(optimized, FONTSHARE_LINK)).toBeLessThan(
			indexOfTag(optimized, second),
		);
		expect(indexOfTag(optimized, second)).toBeLessThan(
			indexOfTag(optimized, "<style>"),
		);
	});

	it("regroups links that straddle the preconnects and the style", () => {
		const html = page(
			`${CAIRO_LINK}\n${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n<style>:root{--x:1}</style>\n${FONTSHARE_LINK}`,
		);
		const optimized = optimizeFontLoading(html);

		expect(indexOfTag(optimized, GSTATIC_PRECONNECT)).toBeLessThan(
			indexOfTag(optimized, CAIRO_LINK),
		);
		expect(indexOfTag(optimized, CAIRO_LINK)).toBeLessThan(
			indexOfTag(optimized, FONTSHARE_LINK),
		);
		expect(indexOfTag(optimized, FONTSHARE_LINK)).toBeLessThan(
			indexOfTag(optimized, "<style>"),
		);
		expect(optimized.match(/rel="stylesheet"/g)).toHaveLength(2);
		expect(optimizeFontLoading(optimized)).toBe(optimized);
	});

	it("adds exactly the two sanctioned preconnects when they are missing", () => {
		const html = page(`<style>:root{--x:1}</style>\n${CAIRO_LINK}`);
		const optimized = optimizeFontLoading(html);

		expect(optimized).toContain(GOOGLE_PRECONNECT);
		expect(optimized).toContain(GSTATIC_PRECONNECT);
		expect(optimized.match(/rel="preconnect"/g)).toHaveLength(2);
		expect(indexOfTag(optimized, GOOGLE_PRECONNECT)).toBeLessThan(
			indexOfTag(optimized, CAIRO_LINK),
		);
		expect(optimizeFontLoading(optimized)).toBe(optimized);
	});

	it("adds no preconnect when only a Fontshare sheet is loaded", () => {
		const html = page(`${FONTSHARE_LINK}\n<style>:root{--x:1}</style>`);

		expect(optimizeFontLoading(html)).toBe(html);
	});

	it("appends display=swap only when the css2 href has none", () => {
		const bare =
			'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400">';
		const html = page(
			`${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n${bare}\n<style>:root{--x:1}</style>`,
		);
		const optimized = optimizeFontLoading(html);

		expect(optimized).toContain(
			'href="https://fonts.googleapis.com/css2?family=Cairo:wght@400&display=swap"',
		);
		expect(optimized.match(/display=swap/g)).toHaveLength(1);
		expect(optimizeFontLoading(optimized)).toBe(optimized);
	});

	it("mirrors the page's &amp; encoding when it appends display=swap", () => {
		const encoded =
			'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400&amp;family=Tajawal:wght@400">';
		const html = page(
			`${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n${encoded}\n<style>:root{--x:1}</style>`,
		);

		expect(optimizeFontLoading(html)).toContain("&amp;display=swap");
	});

	it("leaves Fontshare hrefs untouched", () => {
		const bare =
			'<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@700">';
		const html = page(`<style>:root{--x:1}</style>\n${bare}`);
		const optimized = optimizeFontLoading(html);

		expect(optimized).toContain(bare);
		expect(optimized).not.toContain("display=swap");
	});

	it("returns pages with no font link byte-identical", () => {
		const html = page(
			'<link rel="icon" href="data:image/svg+xml,x">\n<style>:root{--x:1}</style>\n<link rel="stylesheet" href="https://example.com/app.css">',
		);

		expect(optimizeFontLoading(html)).toBe(html);
		expect(optimizeFontLoading("<p>fragment, no head</p>")).toBe(
			"<p>fragment, no head</p>",
		);
	});

	it("never reads or writes the body", () => {
		const bodyLink = `<div>${CAIRO_LINK}</div>`;
		const html = page(`<style>:root{--x:1}</style>\n${CAIRO_LINK}`, bodyLink);
		const optimized = optimizeFontLoading(html);
		const body = optimized.slice(optimized.indexOf("<body>"));

		expect(body).toBe(html.slice(html.indexOf("<body>")));
	});

	it("ignores a commented-out font link", () => {
		const html = page(`<!-- ${CAIRO_LINK} -->\n<style>:root{--x:1}</style>`);

		expect(optimizeFontLoading(html)).toBe(html);
	});

	// Regression: the <style> probe used to see the commented-out one, so the
	// whole hoisted block was spliced INSIDE the comment while the real link
	// was cut out — publishing a page with no font stylesheet at all.
	it("ignores a commented-out style when it looks for the first style", () => {
		const html = page(
			`<!-- <style>.dead{color:red}</style> -->\n${CAIRO_LINK}\n<style>:root{--x:1}</style>`,
		);
		const optimized = optimizeFontLoading(html);

		expect(optimized).toContain(CAIRO_LINK);
		expect(optimized).toContain("<!-- <style>.dead{color:red}</style> -->");
		expect(indexOfTag(optimized, CAIRO_LINK)).toBeLessThan(
			indexOfTag(optimized, "<style>:root"),
		);
		// Already early enough: only the two preconnects are added.
		expect(optimized.match(/rel="preconnect"/g)).toHaveLength(2);
		expect(optimizeFontLoading(optimized)).toBe(optimized);
	});

	// A comment does not need to contain a whole element: the bare word is
	// enough to have fooled the probe.
	it("ignores the word <style inside a comment when it hoists", () => {
		const html = page(
			`<!-- the inline <style below is intentional -->\n<style>:root{--x:1}</style>\n${CAIRO_LINK}`,
		);
		const optimized = optimizeFontLoading(html);

		expect(optimized).toContain(CAIRO_LINK);
		expect(indexOfTag(optimized, CAIRO_LINK)).toBeLessThan(
			indexOfTag(optimized, "<style>:root"),
		);
		expect(indexOfTag(optimized, CAIRO_LINK)).toBeGreaterThan(
			indexOfTag(optimized, "intentional -->"),
		);
	});

	it("ignores a font link whose href carries a control character", () => {
		const broken =
			'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo\n&display=swap">';
		const html = page(`<style>:root{--x:1}</style>\n${broken}`);

		expect(optimizeFontLoading(html)).toBe(html);
	});

	it("hoists to just before the style when no preconnect precedes it", () => {
		const html = page(
			`<title>t</title>\n<style>:root{--x:1}</style>\n${CAIRO_LINK}\n${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}`,
		);
		const optimized = optimizeFontLoading(html);

		expect(indexOfTag(optimized, CAIRO_LINK)).toBeLessThan(
			indexOfTag(optimized, "<style>"),
		);
		// The late preconnects are not touched, and no duplicate is added.
		expect(optimized.match(/rel="preconnect"/g)).toHaveLength(2);
		expect(optimizeFontLoading(optimized)).toBe(optimized);
	});

	it("adds nothing when the head has no style at all", () => {
		const html = page(
			`${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n${CAIRO_LINK}`,
		);

		expect(optimizeFontLoading(html)).toBe(html);
	});

	it("handles a rel with several tokens and single-quoted attributes", () => {
		const link =
			"<link rel='stylesheet preload' href='https://fonts.googleapis.com/css2?family=Cairo:wght@400&display=swap'>";
		const html = page(
			`${GOOGLE_PRECONNECT}\n${GSTATIC_PRECONNECT}\n<style>:root{--x:1}</style>\n${link}`,
		);
		const optimized = optimizeFontLoading(html);

		expect(optimized).toContain(link);
		expect(indexOfTag(optimized, link)).toBeLessThan(
			indexOfTag(optimized, "<style>"),
		);
	});
});
