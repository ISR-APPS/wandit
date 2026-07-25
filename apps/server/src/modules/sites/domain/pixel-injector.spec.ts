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

	it("injects the Meta pixel before </body>", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: null,
		});

		expect(html).toContain('data-wandit-pixel="meta"');
		expect(html).toContain("fbq('init','1234567890')");
		expect(html).not.toContain("tiktok");
	});

	it("injects the TikTok pixel alone", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: null,
			tiktokPixelId: "CABC123",
		});

		expect(html).toContain('data-wandit-pixel="tiktok"');
		expect(html).toContain("ttq.load('CABC123')");
		expect(html).not.toContain("fbq");
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
