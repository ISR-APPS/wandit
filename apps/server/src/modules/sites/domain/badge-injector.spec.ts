import { describe, expect, it } from "vitest";

import { injectWanditBadge, WANDIT_BADGE_ID } from "./badge-injector";

const PAGE =
	"<!doctype html><html><head></head><body><h1>Hi</h1></body></html>";

describe("injectWanditBadge", () => {
	it("inserts the badge immediately before the last </body>", () => {
		const result = injectWanditBadge(PAGE, { hide: false });

		expect(result).toContain(`id="${WANDIT_BADGE_ID}"`);
		expect(result).toContain("Made with Wandit");
		expect(result.toLowerCase().indexOf("</body>")).toBeGreaterThan(
			result.indexOf(`id="${WANDIT_BADGE_ID}"`),
		);
		// The page content itself stays byte-identical around the insertion.
		expect(result).toContain("<h1>Hi</h1>");
	});

	it("appends the badge when the document has no </body>", () => {
		const result = injectWanditBadge("<h1>Hi</h1>", { hide: false });

		expect(result.startsWith("<h1>Hi</h1>")).toBe(true);
		expect(result).toContain(`id="${WANDIT_BADGE_ID}"`);
	});

	it("replaces a canonical badge with a fresh one", () => {
		const once = injectWanditBadge(PAGE, { hide: false });
		const stale = once.replaceAll("Made with Wandit", "Old Badge");
		const refreshed = injectWanditBadge(stale, { hide: false });

		expect(refreshed).toBe(once);
		expect(refreshed).not.toContain("Old Badge");
	});

	it("returns a badge-free document untouched when hide is set", () => {
		expect(injectWanditBadge(PAGE, { hide: true })).toBe(PAGE);
	});

	it("removes every canonical badge when hide is set", () => {
		// Rollback replays archived bytes through the same transform: an
		// entitled owner who hid the badge must not get it back from an old
		// free-plan archive.
		const withBadge = injectWanditBadge(PAGE, { hide: false });
		const block = withBadge.match(
			/<div id="wandit-badge">[\s\S]*?<\/div>/,
		)?.[0];
		const repeated = PAGE.replace("<h1>Hi</h1>", `${block}<h1>Hi</h1>${block}`);

		expect(injectWanditBadge(repeated, { hide: true })).toBe(PAGE);
	});

	it.each([
		false,
		true,
	])("returns an unrecognized badge carrier untouched when hide is %s", (hide) => {
		const merchant = PAGE.replace(
			"<h1>Hi</h1>",
			'<div id="wandit-badge">Merchant content</div><h1>Hi</h1>',
		);

		expect(injectWanditBadge(merchant, { hide })).toBe(merchant);
	});

	it("returns the original document when canonical and unrecognized badges are mixed", () => {
		const canonical = injectWanditBadge(PAGE, { hide: false });
		const mixed = canonical.replace(
			"<h1>Hi</h1>",
			'<div id="wandit-badge">Merchant content</div><h1>Hi</h1>',
		);

		expect(injectWanditBadge(mixed, { hide: true })).toBe(mixed);
	});

	it("splices correctly when a Turkish İ precedes </body>", () => {
		// toLowerCase("İ") is two code units — an index taken from a lowered
		// copy would cut inside the closing tag and corrupt the publish.
		const page =
			"<!doctype html><html><body><h1>İstanbul Grand Bazaar İ</h1></body></html>";
		const result = injectWanditBadge(page, { hide: false });

		expect(result).toContain("</a></div></body></html>");
		expect(result).toContain("<h1>İstanbul Grand Bazaar İ</h1>");
	});

	it("lifts above the sticky order bar on phone viewports", () => {
		// COD pages pin their order CTA to a bottom sticky bar; the badge's
		// z-index beats every page value, so at the default corner it would
		// steal order taps on mobile.
		const result = injectWanditBadge(PAGE, { hide: false });

		expect(result).toContain("@media (max-width:640px)");
		expect(result).toContain("inset-block-end:76px");
	});

	it("positions with logical properties so RTL pages flip it themselves", () => {
		const result = injectWanditBadge(PAGE, { hide: false });

		expect(result).toContain("inset-inline-end");
		expect(result).toContain("inset-block-end");
		expect(result).not.toMatch(/#wandit-badge\{[^}]*(right|left|bottom):/);
	});

	it("adds no external requests: the only URL is the wandit.app link", () => {
		const result = injectWanditBadge("<body></body>", { hide: false });
		const injected = result.replace("<body></body>", "");
		const urls = injected.match(/https?:\/\/[^"'\s)]+/g) ?? [];

		expect(urls).toEqual([
			"https://wandit.app/?utm_source=wandit-badge&utm_medium=referral&utm_campaign=made-with-wandit",
		]);
		expect(injected).not.toContain("<script");
	});

	it("never uses the reserved editor-artifact id prefix", () => {
		// stampHtml strips [id^="__wandit-"] and assertNoEditorArtifacts throws
		// on it — the badge must survive both.
		expect(WANDIT_BADGE_ID.startsWith("__wandit-")).toBe(false);
		expect(injectWanditBadge(PAGE, { hide: false })).not.toContain("__wandit-");
	});
});
