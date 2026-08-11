import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	collectAssetUrls,
	parseCssUrls,
	parseSrcset,
	verifyAssetUrls,
} from "./asset-validator";

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

describe("collectAssetUrls", () => {
	it("collects src, poster, and srcset URLs across media tags and dedupes", () => {
		const html = `
			<html><body>
				<img src=" https://a.test/hero.png " srcset="https://a.test/hero.png 1x, https://a.test/hero@2x.png 2x">
				<picture><source srcset="https://a.test/hero@2x.png 2x" src="https://a.test/fallback.png"></picture>
				<video src="https://a.test/v.mp4" poster="https://a.test/p.jpg"></video>
				<img src="data:image/gif;base64,R0lGOD">
			</body></html>`;

		expect(collectAssetUrls(html).sort()).toEqual([
			"data:image/gif;base64,R0lGOD",
			"https://a.test/fallback.png",
			"https://a.test/hero.png",
			"https://a.test/hero@2x.png",
			"https://a.test/p.jpg",
			"https://a.test/v.mp4",
		]);
	});

	it("collects url() references from style attributes", () => {
		const html = `
			<html><body>
				<div style="background-image: url('https://a.test/bg.jpg'); color: red"></div>
				<section style='background: url(https://a.test/tile.png) repeat'></section>
			</body></html>`;

		expect(collectAssetUrls(html).sort()).toEqual([
			"https://a.test/bg.jpg",
			"https://a.test/tile.png",
		]);
	});

	it("collects quoted and unquoted url() references from style blocks", () => {
		const html = `
			<html><head><style>
				.hero { background: url( "https://a.test/hero.webp" ) center / cover; }
				@font-face { src: url(/fonts/body.woff2) format("woff2"); }
			</style></head><body>
				<style>.badge::before { content: url('badge.svg'); }</style>
			</body></html>`;

		expect(collectAssetUrls(html).sort()).toEqual([
			"/fonts/body.woff2",
			"badge.svg",
			"https://a.test/hero.webp",
		]);
	});

	it("collects preloaded image hrefs but not other preloads", () => {
		const html = `
			<html><head>
				<link rel="preload" as="image" href="https://a.test/lcp.avif">
				<link rel="PRELOAD" as="Image" href="/hero.png">
				<link rel="preload" as="font" href="https://a.test/body.woff2">
				<link rel="stylesheet" href="https://a.test/site.css">
			</head><body></body></html>`;

		expect(collectAssetUrls(html).sort()).toEqual([
			"/hero.png",
			"https://a.test/lcp.avif",
		]);
	});

	it("keeps data: URIs from CSS on the passing classification path", async () => {
		const html = `
			<html><body>
				<div style="background: url(data:image/png;base64,iVBORw0KGgo=)"></div>
			</body></html>`;
		const urls = collectAssetUrls(html);

		expect(urls).toEqual(["data:image/png;base64,iVBORw0KGgo="]);

		// data: already passes classification — nothing is probed.
		expect(await verifyAssetUrls(urls)).toEqual({ broken: [], warnings: [] });
	});

	it("collects nothing from url()-free CSS such as gradients", () => {
		const html = `
			<html><head><style>
				.hero { background: linear-gradient(135deg, #0ea5e9, #6366f1); }
			</style></head><body>
				<div style="background: radial-gradient(circle, #fff, #000)"></div>
			</body></html>`;

		expect(collectAssetUrls(html)).toEqual([]);
	});

	it("returns nothing for asset-free HTML", () => {
		expect(collectAssetUrls("<html><body><p>hi</p></body></html>")).toEqual([]);
	});
});

describe("parseCssUrls", () => {
	it("strips CSS quoting and whitespace from url() tokens", () => {
		expect(
			parseCssUrls(
				`a { background: url( 'a.png' ); mask: url("b.svg"); cursor: url(  c.cur  ); }`,
			),
		).toEqual(["a.png", "b.svg", "c.cur"]);
	});

	it("ignores non-url functions and empty input", () => {
		expect(
			parseCssUrls("a { filter: blur(4px); width: calc(1% + 2px); }"),
		).toEqual([]);
		expect(parseCssUrls(undefined)).toEqual([]);
		expect(parseCssUrls("")).toEqual([]);
	});
});

describe("parseSrcset", () => {
	it("parses width and density candidates", () => {
		expect(parseSrcset("a.png 640w, b.png 1280w")).toEqual(["a.png", "b.png"]);
	});

	it("splits candidates whose separator comma has no following space", () => {
		expect(parseSrcset("a.png 1x,b.png 2x")).toEqual(["a.png", "b.png"]);
	});

	it("strips trailing commas glued to a URL", () => {
		expect(parseSrcset("a.png, b.png")).toEqual(["a.png", "b.png"]);
	});

	it("keeps commas inside data URIs", () => {
		expect(
			parseSrcset("data:image/png;base64,iVBOR 1x, https://a.test/b.png 2x"),
		).toEqual(["data:image/png;base64,iVBOR", "https://a.test/b.png"]);
	});

	it("returns nothing for empty input", () => {
		expect(parseSrcset(undefined)).toEqual([]);
		expect(parseSrcset("  ")).toEqual([]);
	});
});

describe("verifyAssetUrls", () => {
	type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchMock);
		lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		lookupMock.mockReset();
	});

	it("blocks on 404/410 but only warns on 403", async () => {
		fetchMock.mockImplementation(async (input) => {
			const url = String(input);
			const status = url.includes("gone")
				? 404
				: url.includes("purged")
					? 410
					: url.includes("guarded")
						? 403
						: 200;

			return new Response(null, { status });
		});

		const result = await verifyAssetUrls([
			"https://cdn.test/ok.png",
			"https://cdn.test/gone.png",
			"https://cdn.test/purged.png",
			"https://cdn.test/guarded.png",
		]);

		expect(result.broken.sort()).toEqual([
			"https://cdn.test/gone.png",
			"https://cdn.test/purged.png",
		]);
		expect(result.warnings).toEqual(["https://cdn.test/guarded.png"]);
	});

	it("treats an unfollowed redirect as reachable", async () => {
		fetchMock.mockResolvedValue(
			new Response(null, {
				headers: { location: "https://cdn.test/moved.png" },
				status: 302,
			}),
		);

		const result = await verifyAssetUrls(["https://cdn.test/a.png"]);

		expect(result).toEqual({ broken: [], warnings: [] });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("manual");
	});

	it("hard-fails private, loopback, and localhost URLs without fetching", async () => {
		const urls = [
			"http://169.254.169.254/latest/meta-data/",
			"http://10.0.0.5:8080/internal/admin",
			"http://192.168.1.10/a.png",
			"http://127.0.0.1/a.png",
			"http://localhost:3000/a.png",
			"http://[::1]/a.png",
		];

		const result = await verifyAssetUrls(urls);

		expect(result.broken.sort()).toEqual([...urls].sort());
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("warns without fetching when a hostname resolves to a private address", async () => {
		lookupMock.mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);

		const result = await verifyAssetUrls(["https://internal.test/a.png"]);

		expect(result).toEqual({
			broken: [],
			warnings: ["https://internal.test/a.png"],
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("probes normally when a hostname resolves to a public address", async () => {
		lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
		fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

		const result = await verifyAssetUrls(["https://cdn.test/a.png"]);

		expect(result).toEqual({ broken: [], warnings: [] });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("turns unprobed URLs into warnings once the total budget is spent", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

		const result = await verifyAssetUrls(
			["https://cdn.test/a.png", "https://cdn.test/b.png"],
			{ budgetMs: 0 },
		);

		expect(result.broken).toEqual([]);
		expect(result.warnings.sort()).toEqual([
			"https://cdn.test/a.png",
			"https://cdn.test/b.png",
		]);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
