import { describe, expect, it } from "vitest";

import {
	academyCategoryLabel,
	canSaveGuide,
	errorMessage,
	formatGuideDate,
	guideBodyText,
	hasGuideBodyContent,
	pageAfterListItemRemoval,
} from "./academy-helpers";

describe("Academy guide helpers", () => {
	describe("canSaveGuide", () => {
		it("requires a title and either a video or body content", () => {
			expect(
				canSaveGuide({
					title: "Getting started",
					youtubeVideoId: "dQw4w9WgXcQ",
					bodyHtml: "",
				}),
			).toBe(true);
			expect(
				canSaveGuide({
					title: "Getting started",
					youtubeVideoId: null,
					bodyHtml: "<p>A useful guide</p>",
				}),
			).toBe(true);
			expect(
				canSaveGuide({
					title: "Getting started",
					youtubeVideoId: null,
					bodyHtml: '<p><img src="https://example.com/guide.png"></p>',
				}),
			).toBe(true);
			expect(
				canSaveGuide({
					title: "Getting started",
					youtubeVideoId: null,
					bodyHtml: "<p> &nbsp;&#8203; </p>",
				}),
			).toBe(false);
			expect(
				canSaveGuide({
					title: "Getting started",
					youtubeVideoId: null,
					bodyHtml: "",
				}),
			).toBe(false);
			expect(
				canSaveGuide({
					title: "   ",
					youtubeVideoId: "dQw4w9WgXcQ",
					bodyHtml: "",
				}),
			).toBe(false);
		});
	});

	describe("hasGuideBodyContent", () => {
		it("accepts image-only HTML and rejects truly empty markup", () => {
			expect(
				hasGuideBodyContent(
					'<p><img src="https://example.com/guide.png" alt=""></p>',
				),
			).toBe(true);
			expect(hasGuideBodyContent("<p><br></p>")).toBe(false);
			expect(hasGuideBodyContent("<p>&nbsp;&#8203;</p>")).toBe(false);
		});
	});

	describe("pageAfterListItemRemoval", () => {
		it("moves to the previous page when the removed item was the last row", () => {
			expect(pageAfterListItemRemoval(2, 1)).toBe(1);
			expect(pageAfterListItemRemoval(4, 1)).toBe(3);
		});

		it("keeps the page when rows remain or the current page is the first", () => {
			expect(pageAfterListItemRemoval(3, 2)).toBe(3);
			expect(pageAfterListItemRemoval(1, 1)).toBe(1);
		});
	});

	describe("academyCategoryLabel", () => {
		it("returns the English label for a canonical category", () => {
			expect(academyCategoryLabel("getting-started")).toBe("Getting started");
			expect(academyCategoryLabel("landing-pages")).toBe("Landing pages");
			expect(academyCategoryLabel("apps")).toBe("Apps & integrations");
		});

		it("returns an unknown legacy category unchanged", () => {
			expect(academyCategoryLabel("Legacy tutorials")).toBe("Legacy tutorials");
		});
	});

	describe("formatGuideDate", () => {
		it("formats dates with the admin's en-US convention", () => {
			expect(formatGuideDate("2026-08-15T10:00:00.000Z")).toBe("Aug 15, 2026");
			expect(formatGuideDate(null)).toBe("—");
		});
	});

	describe("guideBodyText", () => {
		it("treats empty TipTap markup as empty text", () => {
			expect(guideBodyText("<p></p>")).toBe("");
			expect(guideBodyText("<p><br></p>")).toBe("");
			expect(guideBodyText("<p>&nbsp;&#8203;</p>")).toBe("");
		});

		it("extracts formatted text and decodes common entities", () => {
			expect(
				guideBodyText(
					"<h2>Start here</h2><p>Build <strong>ads</strong> &amp; pages.</p>",
				),
			).toBe("Start here Build ads & pages.");
		});
	});

	describe("errorMessage", () => {
		it("uses an Error message or the supplied fallback", () => {
			expect(errorMessage(new Error("Request failed"), "Try again")).toBe(
				"Request failed",
			);
			expect(errorMessage("Request failed", "Try again")).toBe("Try again");
		});
	});
});
