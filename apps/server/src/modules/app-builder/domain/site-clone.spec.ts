import { describe, expect, it } from "vitest";

import {
	assetFileNameOf,
	bandRectsOf,
	diffBandPixels,
	fontFacesOf,
	hasActiveSvgContent,
	STYLE_MAP_SCRIPT,
} from "./site-clone";

// Raw RGB of `pixelCount` pixels, each channel at `value`.
function rgbOf(pixelCount: number, value: number): Uint8Array {
	return new Uint8Array(pixelCount * 3).fill(value);
}

describe("diffBandPixels", () => {
	it.each([
		{ name: "an equal clone", clone: rgbOf(8, 200), percent: 0 },
		{
			name: "one changed quarter",
			clone: Uint8Array.of(...rgbOf(6, 200), ...rgbOf(2, 0)),
			percent: 25,
		},
		{
			name: "a channel difference of 10",
			clone: rgbOf(8, 210),
			percent: 0,
		},
		{ name: "a clone of half height", clone: rgbOf(4, 200), percent: 50 },
	])("gives $percent percent for $name", ({ clone, percent }) => {
		expect(diffBandPixels(rgbOf(8, 200), clone).mismatchPercent).toBe(percent);
	});

	it("marks only the different pixels in the mask", () => {
		const clone = Uint8Array.of(...rgbOf(6, 200), ...rgbOf(2, 0));

		expect([...diffBandPixels(rgbOf(8, 200), clone).isDifferent]).toEqual([
			0, 0, 0, 0, 0, 0, 1, 1,
		]);
	});
});

describe("fontFacesOf", () => {
	const sheetUrl = "https://cdn.site.test/css/app.css";

	it.each([
		{
			name: "a quoted URL",
			css: `@font-face { font-family: "Inter"; font-weight: 700; font-style: italic; src: url("https://f.test/inter.woff2") format("woff2"); }`,
			faces: [
				{
					family: "Inter",
					weight: "700",
					style: "italic",
					url: "https://f.test/inter.woff2",
				},
			],
		},
		{
			name: "a bare URL with the default weight and style",
			css: "@font-face{font-family:Inter;src:url(https://f.test/inter.woff)}",
			faces: [
				{
					family: "Inter",
					weight: "400",
					style: "normal",
					url: "https://f.test/inter.woff",
				},
			],
		},
		{
			name: "a URL relative to the sheet",
			css: "@font-face { font-family: 'Inter'; src: url(../fonts/inter.ttf); }",
			faces: [
				{
					family: "Inter",
					weight: "400",
					style: "normal",
					url: "https://cdn.site.test/fonts/inter.ttf",
				},
			],
		},
		{
			name: "a data: font before a file",
			css: `@font-face { font-family: Inter; src: url(data:font/woff2;base64,AAAA) format("woff2"), url(/inter.woff) format("woff"); }`,
			faces: [
				{
					family: "Inter",
					weight: "400",
					style: "normal",
					url: "https://cdn.site.test/inter.woff",
				},
			],
		},
		{
			name: "a block with only a data: font",
			css: "@font-face { font-family: Inter; src: url(data:font/woff2;base64,AAAA); }",
			faces: [],
		},
		{
			name: "woff2 after woff and an old format",
			css: `@font-face { font-family: Inter; src: url(/a.eot); src: url(/a.eot?#iefix) format("embedded-opentype"), url(/a.woff) format("woff"), url(/a.woff2) format("woff2"); }`,
			faces: [
				{
					family: "Inter",
					weight: "400",
					style: "normal",
					url: "https://cdn.site.test/a.woff2",
				},
			],
		},
		{
			name: "two blocks and a comment",
			css: `/* latin; */ @font-face { font-family: A; src: url(/a.woff2); } body { color: red } @font-face { /* bold; */ font-family: B; font-weight: 100 900; src: url(/b.otf) format("opentype"); }`,
			faces: [
				{
					family: "A",
					weight: "400",
					style: "normal",
					url: "https://cdn.site.test/a.woff2",
				},
				{
					family: "B",
					weight: "100 900",
					style: "normal",
					url: "https://cdn.site.test/b.otf",
				},
			],
		},
		{
			name: "a comment with no end",
			css: "@font-face { font-family: A; src: url(/a.woff2); } /* open @font-face { font-family: B; src: url(/b.woff2); }",
			faces: [
				{
					family: "A",
					weight: "400",
					style: "normal",
					url: "https://cdn.site.test/a.woff2",
				},
			],
		},
	])("reads $name", ({ css, faces }) => {
		expect(fontFacesOf(css, sheetUrl)).toEqual(faces);
	});
});

describe("hostile text", () => {
	// Each text made an earlier pattern go back on each character: 200 KB took 2 s or more.
	it.each([
		{
			name: "fontFacesOf on comments with no end",
			run: () => fontFacesOf("/* ".repeat(66_000), "https://site.test/a.css"),
		},
	])("$name takes linear time", ({ run }) => {
		const startMs = performance.now();
		run();
		// 1 s. The linear patterns take less than 20 ms on this text.
		expect(performance.now() - startMs).toBeLessThan(1000);
	});
});

describe("hasActiveSvgContent", () => {
	it.each([
		{ svg: "<svg><script>alert(1)</script></svg>", expected: true },
		{
			svg: '<svg><x:SCRIPT xmlns:x="http://www.w3.org/2000/svg"/></svg>',
			expected: true,
		},
		{
			svg: '<svg><é:script xmlns:é="http://www.w3.org/2000/svg">alert(1)</é:script></svg>',
			expected: true,
		},
		{ svg: '<svg onload="alert(1)"></svg>', expected: true },
		{ svg: '<svg><a href="javascript:alert(1)"/></svg>', expected: true },
		{ svg: '<svg><a href="java\nscript:alert(1)"/></svg>', expected: true },
		{ svg: '<svg><a href="&#106;avascript:alert(1)"/></svg>', expected: true },
		{ svg: "<svg><foreignObject><div/></foreignObject></svg>", expected: true },
		{
			svg: '<svg><h:iframe xmlns:h="http://www.w3.org/1999/xhtml" srcdoc="&lt;b&gt;"/></svg>',
			expected: true,
		},
		{
			svg: '<!DOCTYPE svg [<!ENTITY x "<script>">]><svg>&x;</svg>',
			expected: true,
		},
		// With an XHTML DOCTYPE, a browser knows `&colon;` with no ENTITY line.
		{
			svg: '<!DOCTYPE svg PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "x"><svg><a href="javascript&colon;alert(1)"/></svg>',
			expected: true,
		},
		{
			svg: '<!DOCTYPE svg [<!ATTLIST svg onload CDATA "alert(1)">]><svg/>',
			expected: true,
		},
		// UTF-16 text, read as UTF-8: a NUL divides the letters.
		{ svg: "<\0s\0c\0r\0i\0p\0t\0>\0", expected: true },
		{
			svg: '<?xml-stylesheet type="text/xsl" href="#s"?><svg/>',
			expected: true,
		},
		{
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="#000" d="M4 6h16M4 12h16"/></svg>',
			expected: false,
		},
		// An Illustrator file: the SVG DOCTYPE and an entity of XML itself.
		{
			svg: '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg><title>A &amp; B</title></svg>',
			expected: false,
		},
	])("answers $expected for $svg", ({ svg, expected }) => {
		expect(hasActiveSvgContent(svg)).toBe(expected);
	});
});

describe("assetFileNameOf", () => {
	it.each([
		{
			url: "https://a.test/img/Hero%20Image.PNG?w=2",
			name: "03-hero-image.png",
		},
		{ url: "https://a.test/a/../../x", name: "03-x.png" },
		{ url: "https://a.test/%2e%2e%2f", name: "03-asset.png" },
		{
			url: "https://a.test/a%2f..%2f..%2fetc%2fpasswd",
			name: "03-a-etc-passwd.png",
		},
		{ url: "https://a.test/", name: "03-asset.png" },
		{ url: "https://a.test/%E0%A4%A.png", name: "03-e0-a4-a.png" },
		{ url: "not a url", name: "03-asset.png" },
		{
			url: `https://a.test/${"a".repeat(200)}.png`,
			name: `03-${"a".repeat(40)}.png`,
		},
	])("names $url as $name", ({ url, name }) => {
		expect(assetFileNameOf(3, url, "png")).toBe(name);
	});
});

describe("bandRectsOf", () => {
	it.each([
		{
			name: "a page shorter than one band",
			imageHeightPx: 400,
			rects: [{ top: 0, height: 400 }],
		},
		{
			name: "an exact multiple",
			imageHeightPx: 1800,
			rects: [
				{ top: 0, height: 900 },
				{ top: 900, height: 900 },
			],
		},
		{
			name: "a short last band",
			imageHeightPx: 1801,
			rects: [
				{ top: 0, height: 900 },
				{ top: 900, height: 900 },
				{ top: 1800, height: 1 },
			],
		},
		{
			name: "a page over the cap",
			imageHeightPx: 5000,
			rects: [
				{ top: 0, height: 900 },
				{ top: 900, height: 900 },
				{ top: 1800, height: 900 },
			],
		},
	])("cuts $name", ({ imageHeightPx, rects }) => {
		expect(bandRectsOf(imageHeightPx, 900, 3)).toEqual(rects);
	});
});

describe("STYLE_MAP_SCRIPT", () => {
	// The compiler does not read the script text. A syntax error gives every capture no style map.
	it("is one valid JavaScript expression", () => {
		expect(() => new Function(`return ${STYLE_MAP_SCRIPT}`)).not.toThrow();
	});
});
