import { describe, expect, it } from "vitest";

import { assertNoEditorArtifacts, injectPixels } from "./pixel-injector";

const PAGE =
	"<!doctype html><html><head></head><body><h1>Hi</h1></body></html>";

describe("injectPixels", () => {
	it("returns the bytes untouched when no pixels are configured", () => {
		expect(injectPixels(PAGE, { metaPixelId: null, tiktokPixelId: null })).toBe(
			PAGE,
		);
	});

	it("puts the Meta script in <head> and its noscript image in <body>", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: null,
		});
		const head = html.slice(0, html.indexOf("</head>"));
		const body = html.slice(html.indexOf("<body"));

		expect(head).toContain('data-wandit-pixel="meta"');
		expect(head).toContain("fbq('init','1234567890')");
		expect(head).toContain("fbq('track','PageView')");
		expect(body).toContain("<noscript>");
		expect(body).toContain("facebook.com/tr?id=1234567890");
		expect(html).not.toContain("tiktok");
	});

	it("puts the TikTok pixel alone in <head>", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: null,
			tiktokPixelId: "CABC123",
		});
		const head = html.slice(0, html.indexOf("</head>"));

		expect(head).toContain('data-wandit-pixel="tiktok"');
		expect(head).toContain("ttq.load('CABC123')");
		expect(head).toContain("ttq.page()");
		expect(html).not.toContain("fbq");
	});

	it("executes the TikTok snippet: loader assigned, SDK injected, page() queued", () => {
		// Regression: an earlier snippet immediately invoked the loader, so
		// ttq.load was undefined and the pixel never registered anything.
		const html = injectPixels(PAGE, {
			metaPixelId: null,
			tiktokPixelId: "CABC123",
		});
		const script =
			/<script data-wandit-pixel="tiktok">(.*?)<\/script>/s.exec(html)?.[1] ??
			"";
		const created: Array<{ src?: string }> = [];
		const firstScript = {
			parentNode: {
				insertBefore: (node: unknown) => {
					created.push(node as { src?: string });
				},
			},
		};
		const documentStub = {
			createElement: () => ({}) as { async?: boolean; src?: string },
			getElementsByTagName: () => [firstScript],
		};
		const windowStub: Record<string, unknown> = {};

		expect(() =>
			new Function("window", "document", script)(windowStub, documentStub),
		).not.toThrow();

		const ttq = windowStub.ttq as unknown[] & {
			_i?: Record<string, unknown>;
		};
		expect(created).toHaveLength(1);
		expect(created[0]?.src).toContain("sdkid=CABC123");
		expect(ttq._i?.CABC123).toBeDefined();
		expect(
			ttq.some((entry) => Array.isArray(entry) && entry[0] === "page"),
		).toBe(true);
	});

	it("injects both pixels", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "111",
			tiktokPixelId: "222",
		});

		expect(html).toContain('data-wandit-pixel="meta"');
		expect(html).toContain('data-wandit-pixel="tiktok"');
	});

	it("is idempotent — a second pass adds nothing", () => {
		const once = injectPixels(PAGE, {
			metaPixelId: "111",
			tiktokPixelId: "222",
		});
		const twice = injectPixels(once, {
			metaPixelId: "111",
			tiktokPixelId: "222",
		});

		expect(twice.match(/data-wandit-pixel="meta"/g)).toHaveLength(1);
		expect(twice.match(/data-wandit-pixel="tiktok"/g)).toHaveLength(1);
	});

	it("strips script-breaking characters from pixel ids", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "12</script><script>alert(1)",
			tiktokPixelId: null,
		});

		expect(html).not.toContain("alert(1)</script>");
		expect(html).toContain("fbq('init','12scriptscriptalert1')");
	});
});

describe("assertNoEditorArtifacts", () => {
	it("passes clean HTML", () => {
		expect(() => assertNoEditorArtifacts(PAGE)).not.toThrow();
	});

	it("throws when editor artifacts survive", () => {
		expect(() =>
			assertNoEditorArtifacts('<div id="__wandit-toolbar"></div>'),
		).toThrow(/__wandit-/);
	});
});
