import {
	academyGuideSchema,
	listAcademyGuidesResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const LIST_ITEM = {
	category: "Landing pages",
	description: "Build a focused page that converts visitors into customers.",
	id: "11111111-1111-4111-8111-111111111111",
	publishedAt: "2026-08-15T10:00:00.000Z",
	title: "Create a high-converting landing page",
	youtubeVideoId: "dQw4w9WgXcQ",
} as const;

const GUIDE = {
	...LIST_ITEM,
	bodyHtml: "<p>Start with one clear promise.</p>",
	createdAt: "2026-08-14T09:00:00.000Z",
	status: "published",
	updatedAt: "2026-08-15T10:00:00.000Z",
	youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
} as const;

describe("academy contracts", () => {
	it("parses published guide list and detail payloads", () => {
		expect(listAcademyGuidesResponseSchema.parse([LIST_ITEM])).toEqual([
			LIST_ITEM,
		]);
		expect(academyGuideSchema.parse(GUIDE)).toEqual(GUIDE);
	});

	it("rejects a list item with a malformed YouTube id", () => {
		expect(
			listAcademyGuidesResponseSchema.safeParse([
				{ ...LIST_ITEM, youtubeVideoId: "too-short" },
			]).success,
		).toBe(false);
	});

	it("rejects a detail payload that drifts from the strict contract", () => {
		expect(
			academyGuideSchema.safeParse({ ...GUIDE, unexpected: true }).success,
		).toBe(false);
		expect(
			academyGuideSchema.safeParse({ ...GUIDE, bodyHtml: undefined }).success,
		).toBe(false);
	});
});
