import {
	ACADEMY_GUIDE_CATEGORIES,
	academyGuideCategorySchema,
	academyGuideListItemSchema,
	academyGuideSchema,
	academyRoutes,
	adminAcademyGuideListItemSchema,
	adminListAcademyGuidesQuerySchema,
	adminListAcademyGuidesResponseSchema,
	createAcademyGuideInputSchema,
	parseYouTubeVideoId,
	updateAcademyGuideInputSchema,
	youtubeEmbedUrl,
	youtubeThumbnailUrl,
	youtubeWatchUrl,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const VIDEO_ID = "dQw4w9WgXcQ";
const GUIDE_ID = "11111111-1111-4111-8111-111111111111";

describe("Academy YouTube helpers", () => {
	it.each([
		[`https://www.youtube.com/watch?v=${VIDEO_ID}`, "watch"],
		[`https://youtube.com/shorts/${VIDEO_ID}`, "shorts"],
		[`https://youtu.be/${VIDEO_ID}`, "short URL"],
		[`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`, "embed"],
		[`https://youtube.com/live/${VIDEO_ID}`, "live"],
		[`https://m.youtube.com/watch?v=${VIDEO_ID}`, "mobile host"],
		[`https://M.YOUTUBE.COM/watch?v=${VIDEO_ID}`, "uppercase host"],
		[`http://youtube.com/watch?v=${VIDEO_ID}`, "HTTP"],
		[
			`https://music.youtube.com/watch?v=${VIDEO_ID}&list=RD${VIDEO_ID}`,
			"music host",
		],
		[
			`https://www.youtube.com/watch?feature=share&v=${VIDEO_ID}&t=43s`,
			"extra query parameters",
		],
		[`https://youtu.be/${VIDEO_ID}?t=1m20s`, "short URL timestamp"],
	])("parses a valid %s (%s)", (url) => {
		expect(parseYouTubeVideoId(url)).toBe(VIDEO_ID);
	});

	it.each([
		`https://vimeo.com/${VIDEO_ID}`,
		`https://notyoutube.com/watch?v=${VIDEO_ID}`,
		`https://youtube.com.evil.com/watch?v=${VIDEO_ID}`,
		"https://youtube.com/watch?v=abcdefghij",
		`https://user:password@youtube.com/watch?v=${VIDEO_ID}`,
		`https://user@youtu.be/${VIDEO_ID}`,
		"this is not a URL",
	])("rejects an invalid or untrusted URL: %s", (url) => {
		expect(parseYouTubeVideoId(url)).toBeNull();
	});

	it("builds canonical thumbnail, embed, and watch URLs", () => {
		expect(youtubeThumbnailUrl(VIDEO_ID)).toBe(
			`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
		);
		expect(youtubeEmbedUrl(VIDEO_ID)).toBe(
			`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
		);
		expect(youtubeWatchUrl(VIDEO_ID)).toBe(
			`https://www.youtube.com/watch?v=${VIDEO_ID}`,
		);
	});
});

describe("Academy guide input contracts", () => {
	it("exports the canonical guide categories", () => {
		expect(ACADEMY_GUIDE_CATEGORIES).toEqual([
			"getting-started",
			"websites",
			"landing-pages",
			"ads",
			"leads",
			"marketing",
			"domains",
			"apps",
		]);
		expect(academyGuideCategorySchema.parse("landing-pages")).toBe(
			"landing-pages",
		);
	});

	it("accepts and normalizes a body-backed guide", () => {
		expect(
			createAcademyGuideInputSchema.parse({
				title: "  Build a landing page  ",
				description: "  A short walkthrough  ",
				category: "landing-pages",
				bodyHtml: "<p>Start here</p>",
				status: "draft",
			}),
		).toEqual({
			title: "Build a landing page",
			description: "A short walkthrough",
			category: "landing-pages",
			bodyHtml: "<p>Start here</p>",
			status: "draft",
		});
	});

	it("accepts a video-backed guide and defaults its body", () => {
		expect(
			createAcademyGuideInputSchema.parse({
				title: "Video guide",
				youtubeUrl: `https://youtu.be/${VIDEO_ID}`,
			}),
		).toEqual({
			title: "Video guide",
			youtubeUrl: `https://youtu.be/${VIDEO_ID}`,
			bodyHtml: "",
		});
	});

	it.each([
		["blank title", { title: "  ", bodyHtml: "<p>Body</p>" }],
		["title over 200 characters", { title: "t".repeat(201), bodyHtml: "x" }],
		[
			"description over 300 characters",
			{ title: "Guide", description: "d".repeat(301), bodyHtml: "x" },
		],
		[
			"unknown category",
			{ title: "Guide", category: "legacy-category", bodyHtml: "x" },
		],
		[
			"unsupported video host",
			{ title: "Guide", youtubeUrl: `https://vimeo.com/${VIDEO_ID}` },
		],
		["malformed video URL", { title: "Guide", youtubeUrl: "not a URL" }],
		["missing content", { title: "Guide" }],
		["blank body", { title: "Guide", bodyHtml: "  \n\t" }],
		[
			"body over 300,000 characters",
			{ title: "Guide", bodyHtml: "x".repeat(300_001) },
		],
		["unknown field", { title: "Guide", bodyHtml: "x", unknown: true }],
	])("rejects create input with %s", (_case, input) => {
		expect(createAcademyGuideInputSchema.safeParse(input).success).toBe(false);
	});

	it("supports PATCH fields independently so the service can merge persisted content", () => {
		expect(
			updateAcademyGuideInputSchema.parse({ title: "  Renamed  " }),
		).toEqual({ title: "Renamed" });
		expect(updateAcademyGuideInputSchema.parse({ category: null })).toEqual({
			category: null,
		});
		expect(
			updateAcademyGuideInputSchema.safeParse({ youtubeUrl: null }).success,
		).toBe(true);
		expect(
			updateAcademyGuideInputSchema.safeParse({ bodyHtml: "" }).success,
		).toBe(true);
	});

	it("rejects empty, invalid, or self-evidently contentless PATCH input", () => {
		expect(updateAcademyGuideInputSchema.safeParse({}).success).toBe(false);
		expect(
			updateAcademyGuideInputSchema.safeParse({ category: "legacy-category" })
				.success,
		).toBe(false);
		expect(
			updateAcademyGuideInputSchema.safeParse({
				youtubeUrl: "https://youtube.com/watch?v=short",
			}).success,
		).toBe(false);
		expect(
			updateAcademyGuideInputSchema.safeParse({
				youtubeUrl: null,
				bodyHtml: "  ",
			}).success,
		).toBe(false);
	});

	it("parses admin pagination/filter input", () => {
		expect(adminListAcademyGuidesQuerySchema.parse({})).toEqual({
			page: 1,
			pageSize: 20,
		});
		expect(
			adminListAcademyGuidesQuerySchema.parse({
				page: "2",
				pageSize: "10",
				q: "  launch  ",
				status: "published",
			}),
		).toEqual({
			page: 2,
			pageSize: 10,
			q: "launch",
			status: "published",
		});
	});
});

describe("Academy response and route contracts", () => {
	it("accepts arbitrary legacy categories on every read schema", () => {
		const category = "Legacy category";
		const listItem = {
			id: GUIDE_ID,
			title: "Legacy guide",
			description: null,
			category,
			youtubeVideoId: VIDEO_ID,
			publishedAt: "2026-08-15T10:00:00.000Z",
		};
		const adminListItem = {
			...listItem,
			youtubeUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
			status: "published",
			createdAt: "2026-08-14T10:00:00.000Z",
			updatedAt: "2026-08-15T10:00:00.000Z",
		};
		const guide = {
			...adminListItem,
			bodyHtml: "<p>Legacy content</p>",
		};

		expect(academyGuideSchema.parse(guide).category).toBe(category);
		expect(academyGuideListItemSchema.parse(listItem).category).toBe(category);
		expect(adminAcademyGuideListItemSchema.parse(adminListItem).category).toBe(
			category,
		);
	});

	it("keeps body HTML out of library cards", () => {
		const card = {
			id: GUIDE_ID,
			title: "Launch guide",
			description: null,
			category: "Growth",
			youtubeVideoId: VIDEO_ID,
			publishedAt: "2026-08-15T10:00:00.000Z",
		};

		expect(academyGuideListItemSchema.safeParse(card).success).toBe(true);
		expect(
			academyGuideListItemSchema.safeParse({
				...card,
				bodyHtml: "<p>Must not be on a card</p>",
			}).success,
		).toBe(false);
	});

	it("keeps body HTML out of paginated admin list items", () => {
		const adminListItem = {
			id: GUIDE_ID,
			title: "Launch guide",
			description: "A practical walkthrough",
			category: "Growth",
			youtubeUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
			youtubeVideoId: VIDEO_ID,
			status: "published",
			publishedAt: "2026-08-15T10:00:00.000Z",
			createdAt: "2026-08-14T10:00:00.000Z",
			updatedAt: "2026-08-15T10:00:00.000Z",
		};
		const response = {
			items: [adminListItem],
			page: 1,
			pageSize: 20,
			total: 1,
		};

		expect(adminAcademyGuideListItemSchema.parse(adminListItem)).toEqual(
			adminListItem,
		);
		expect(adminListAcademyGuidesResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(
			adminAcademyGuideListItemSchema.safeParse({
				...adminListItem,
				bodyHtml: "<p>Must be fetched from the detail endpoint</p>",
			}).success,
		).toBe(false);
	});

	it("exposes full frontend API paths", () => {
		expect(academyRoutes).toEqual({
			list: "/api/v1/academy/guides",
			byId: expect.any(Function),
			adminList: "/api/v1/admin/academy/guides",
			adminById: expect.any(Function),
		});
		expect(academyRoutes.byId(GUIDE_ID)).toBe(
			`/api/v1/academy/guides/${GUIDE_ID}`,
		);
		expect(academyRoutes.adminById(GUIDE_ID)).toBe(
			`/api/v1/admin/academy/guides/${GUIDE_ID}`,
		);
	});
});
