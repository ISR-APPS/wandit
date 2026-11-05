import { createHash } from "node:crypto";

import {
	APP_THEME_TEMPLATE_SELECTION,
	type AppThemeFile,
	buildAppThemeFile,
} from "@wandit/contracts/v2/app-theme";
import { describe, expect, it } from "vitest";

import { bundleThemeFonts } from "./theme-fonts";

const CSS_URL =
	"https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap";
const GOOD_FONT_URL = "https://fonts.gstatic.com/s/inter/v1/latin.woff2";
const EVIL_FONT_URL = "https://evil.test/a.woff2";
const LATIN_RANGE = "U+0000-00FF, U+0131";

// Every theme face points at CSS_URL, so the spec controls the one css answer.
function themeWithOneCss(): AppThemeFile {
	const base = buildAppThemeFile({
		origin: "host",
		selection: APP_THEME_TEMPLATE_SELECTION,
	});
	const font = { family: "Inter", href: CSS_URL };
	return {
		...base,
		resolved: {
			...base.resolved,
			fonts: {
				arabicDisplay: font,
				arabicSans: font,
				display: font,
				sans: font,
			},
		},
	};
}

function woff2Bytes(bytes: number, seed: number): Uint8Array {
	const content = Buffer.alloc(bytes, seed);
	content.write("wOF2", 0, "latin1");
	return content;
}

function goodBlock(url: string): string {
	return `@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${url}) format('woff2');
  unicode-range: ${LATIN_RANGE};
}`;
}

// A fake fetch that answers from a map by url and records every request.
async function bundle(answers: Map<string, () => Response>) {
	const requested: string[] = [];
	const warnings: string[] = [];
	const answerOf = (url: string) =>
		answers.get(url)?.() ?? new Response(null, { status: 404 });
	const files = await bundleThemeFonts(
		{
			fetch: async (input: string | URL | Request, init?: RequestInit) => {
				const url = String(input);
				requested.push(url);
				const response = answerOf(url);
				if (response.status < 300 || response.status >= 400) {
					return response;
				}
				// Like Node fetch: `redirect: "error"` rejects a 3xx answer. The default follows it.
				if (init?.redirect === "error") {
					throw new TypeError("fetch failed: unexpected redirect");
				}
				return answerOf(response.headers.get("location") ?? "");
			},
			logFields: { buildId: "build-1", projectId: "project-1" },
			logger: {
				error: () => undefined,
				info: () => undefined,
				warn: (message) => {
					warnings.push(message);
				},
			},
		},
		themeWithOneCss(),
	);
	const css =
		files.find((file) => file.path === "wandit-fonts/theme.css")?.content ??
		new Uint8Array();
	return {
		css: new TextDecoder().decode(css),
		fontFiles: files.filter((file) => file.path !== "wandit-fonts/theme.css"),
		requested,
		warnings,
	};
}

describe("bundleThemeFonts", () => {
	it("keeps only the checked block, with a local url, and never fetches another host", async () => {
		const font = woff2Bytes(64, 1);
		const css = [
			'@import url("https://evil.test/x.css");',
			"@font-face { font-family: 'Inter'; src: url(https://evil.test/a.woff2) format('woff2'); }",
			"@font-face { font-family: 'Inter'; src: url(http://fonts.gstatic.com/b.woff2) format('woff2'); }",
			goodBlock(GOOD_FONT_URL),
		].join("\n");

		const result = await bundle(
			new Map([
				[CSS_URL, () => new Response(css)],
				[GOOD_FONT_URL, () => new Response(font)],
			]),
		);

		const name = `${createHash("sha256").update(font).digest("hex").slice(0, 16)}.woff2`;
		expect(result.css).toBe(
			`@font-face {
	font-family: "Inter";
	font-style: normal;
	font-weight: 400;
	font-display: swap;
	unicode-range: ${LATIN_RANGE};
	src: url("/wandit-fonts/${name}") format("woff2");
}
`,
		);
		expect(result.fontFiles).toEqual([
			{ content: font, path: `wandit-fonts/${name}` },
		]);
		expect(result.requested).toEqual([CSS_URL, GOOD_FONT_URL]);
	});

	it.each<[string, Map<string, () => Response>]>([
		[
			"the css answers 500",
			new Map([[CSS_URL, () => new Response("oops", { status: 500 })]]),
		],
		[
			// The redirect target is a valid font: only `redirect: "error"` keeps it out.
			"the font file redirects to another host",
			new Map([
				[CSS_URL, () => new Response(goodBlock(GOOD_FONT_URL))],
				[
					GOOD_FONT_URL,
					() =>
						new Response(null, {
							headers: { location: EVIL_FONT_URL },
							status: 302,
						}),
				],
				[EVIL_FONT_URL, () => new Response(woff2Bytes(64, 2))],
			]),
		],
		[
			"the font file is not woff2",
			new Map([
				[CSS_URL, () => new Response(goodBlock(GOOD_FONT_URL))],
				[GOOD_FONT_URL, () => new Response("<html>not a font</html>")],
			]),
		],
	])("writes an empty theme.css and no font when %s", async (_label, answers) => {
		const result = await bundle(answers);

		expect(result.css).toBe("");
		expect(result.fontFiles).toEqual([]);
		expect(result.warnings).toHaveLength(1);
	});

	it.each<[string, number, number, number]>([
		// Each file differs, so each one gets its own name.
		["the count cap", 41, 128, 40],
		["the size cap of one file", 1, 2 * 1024 * 1024 + 1, 0],
		// 4 files of 1.9 MB fit in 8 MB. The fifth does not.
		["the total size cap", 5, 1.9 * 1024 * 1024, 4],
	])("drops the faces above %s", async (_label, fileCount, fileBytes, keptFiles) => {
		const urls = Array.from(
			{ length: fileCount },
			(_, index) => `https://fonts.gstatic.com/s/inter/v1/${index}.woff2`,
		);
		const answers = new Map<string, () => Response>([
			[CSS_URL, () => new Response(urls.map(goodBlock).join("\n"))],
			...urls.map((url, index): [string, () => Response] => [
				url,
				() => new Response(woff2Bytes(Math.floor(fileBytes), index + 1)),
			]),
		]);

		const result = await bundle(answers);

		expect(result.fontFiles).toHaveLength(keptFiles);
		expect(result.css.match(/@font-face/g) ?? []).toHaveLength(keptFiles);
	});
});
