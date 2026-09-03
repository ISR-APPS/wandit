import {
	academyGuideSchema,
	adminAcademyGuideListItemSchema,
	adminListAcademyGuidesResponseSchema,
	createAcademyGuideInputSchema,
	deleteAcademyGuideResponseSchema,
	updateAcademyGuideInputSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const guideId = "00000000-0000-4000-8000-000000000001";
const now = "2026-08-15T10:00:00.000Z";

const guidePayload = {
	id: guideId,
	title: "Build your first landing page",
	description: "A practical walkthrough.",
	category: "Landing pages",
	youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	youtubeVideoId: "dQw4w9WgXcQ",
	bodyHtml: "<p>Start with a clear offer.</p>",
	status: "published",
	publishedAt: now,
	createdAt: now,
	updatedAt: now,
};

const adminGuideListPayload = {
	id: guideId,
	title: "Build your first landing page",
	description: "A practical walkthrough.",
	category: "Landing pages",
	youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	youtubeVideoId: "dQw4w9WgXcQ",
	status: "published",
	publishedAt: now,
	createdAt: now,
	updatedAt: now,
};

describe("Academy API DTO schemas", () => {
	it("parses a full guide payload", () => {
		expect(academyGuideSchema.parse(guidePayload)).toEqual(guidePayload);
	});

	it("accepts legacy category strings in read payloads", () => {
		expect(academyGuideSchema.parse(guidePayload).category).toBe(
			"Landing pages",
		);
		expect(
			adminAcademyGuideListItemSchema.parse(adminGuideListPayload).category,
		).toBe("Landing pages");
	});

	it("parses the paginated admin list payload", () => {
		const payload = {
			items: [adminGuideListPayload],
			page: 1,
			pageSize: 20,
			total: 1,
		};

		expect(adminListAcademyGuidesResponseSchema.parse(payload)).toEqual(
			payload,
		);
	});

	it("rejects body HTML in admin list items", () => {
		expect(
			adminAcademyGuideListItemSchema.safeParse(guidePayload).success,
		).toBe(false);
		expect(() =>
			adminListAcademyGuidesResponseSchema.parse({
				items: [guidePayload],
				page: 1,
				pageSize: 20,
				total: 1,
			}),
		).toThrow();
	});

	it("rejects malformed guide and list response payloads", () => {
		expect(() =>
			academyGuideSchema.parse({
				...guidePayload,
				youtubeVideoId: "too-short",
			}),
		).toThrow();
		expect(() =>
			adminListAcademyGuidesResponseSchema.parse({
				items: [adminGuideListPayload],
				page: 1,
				pageSize: 20,
				total: "1",
			}),
		).toThrow();
	});

	it("enforces create content and supported YouTube URLs", () => {
		expect(
			createAcademyGuideInputSchema.parse({
				title: "Video guide",
				category: "landing-pages",
				youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
			}),
		).toMatchObject({
			title: "Video guide",
			category: "landing-pages",
			youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
			bodyHtml: "",
		});

		expect(() =>
			createAcademyGuideInputSchema.parse({
				title: "Empty guide",
				bodyHtml: "   ",
			}),
		).toThrow();
		expect(() =>
			createAcademyGuideInputSchema.parse({
				title: "Other video",
				youtubeUrl: "https://example.com/video",
			}),
		).toThrow();
	});

	it("enforces non-empty update objects and strict fields", () => {
		expect(
			updateAcademyGuideInputSchema.parse({
				category: "apps",
				status: "draft",
			}),
		).toEqual({ category: "apps", status: "draft" });
		expect(() => updateAcademyGuideInputSchema.parse({})).toThrow();
		expect(() =>
			updateAcademyGuideInputSchema.parse({
				status: "published",
				unexpected: true,
			}),
		).toThrow();
	});

	it("rejects unknown categories in write payloads", () => {
		expect(
			createAcademyGuideInputSchema.safeParse({
				title: "Legacy guide",
				category: "Legacy tutorials",
				bodyHtml: "<p>Guide content</p>",
			}).success,
		).toBe(false);
		expect(
			updateAcademyGuideInputSchema.safeParse({
				category: "Legacy tutorials",
			}).success,
		).toBe(false);
	});

	it("accepts only the documented delete response", () => {
		expect(deleteAcademyGuideResponseSchema.parse({ deleted: true })).toEqual({
			deleted: true,
		});
		expect(() =>
			deleteAcademyGuideResponseSchema.parse({ deleted: false }),
		).toThrow();
	});
});
