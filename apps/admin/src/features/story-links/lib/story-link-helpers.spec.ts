import { describe, expect, it } from "vitest";

import {
	buildStoryLinkUrl,
	sortStoryLinksArchivedLast,
	suggestStoryLinkSlug,
} from "./story-link-helpers";

describe("suggestStoryLinkSlug", () => {
	it.each([
		["Summer launch", "summer-launch"],
		["  TikTok / Story #12  ", "tiktok-story-12"],
		["Crème Brûlée", "creme-brulee"],
		["Already---Slugged", "already-slugged"],
		["Symbols & punctuation!", "symbols-punctuation"],
	])("turns %j into %j", (name, expected) => {
		expect(suggestStoryLinkSlug(name)).toBe(expected);
	});

	it("caps suggestions at the contract maximum without a trailing dash", () => {
		const suggestion = suggestStoryLinkSlug(`${"a".repeat(63)} extra`);

		expect(suggestion).toHaveLength(63);
		expect(suggestion.endsWith("-")).toBe(false);
		expect(suggestStoryLinkSlug("b".repeat(64))).toBe("b".repeat(64));
		expect(suggestStoryLinkSlug("c".repeat(80))).toBe("c".repeat(64));
	});
});

describe("buildStoryLinkUrl", () => {
	it("builds a canonical Wandit short URL", () => {
		expect(buildStoryLinkUrl("summer-story")).toBe(
			"https://wandit.dev/s/summer-story",
		);
	});

	it("normalizes a custom origin and safely encodes the path segment", () => {
		expect(buildStoryLinkUrl("launch story", "https://preview.test///")).toBe(
			"https://preview.test/s/launch%20story",
		);
	});
});

describe("sortStoryLinksArchivedLast", () => {
	it("moves archived links last without changing the order within each group", () => {
		const links = [
			{
				id: "archived-new",
				archivedAt: "2026-08-12T00:00:00.000Z",
				createdAt: "2026-08-12T00:00:00.000Z",
			},
			{
				id: "active-old",
				archivedAt: null,
				createdAt: "2026-08-08T00:00:00.000Z",
			},
			{
				id: "archived-old",
				archivedAt: "2026-08-10T00:00:00.000Z",
				createdAt: "2026-08-10T00:00:00.000Z",
			},
			{
				id: "active-new",
				archivedAt: null,
				createdAt: "2026-08-14T00:00:00.000Z",
			},
		];

		expect(sortStoryLinksArchivedLast(links).map((link) => link.id)).toEqual([
			"active-old",
			"active-new",
			"archived-new",
			"archived-old",
		]);
		expect(links.map((link) => link.id)).toEqual([
			"archived-new",
			"active-old",
			"archived-old",
			"active-new",
		]);
	});
});
