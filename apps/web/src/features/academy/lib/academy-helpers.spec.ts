import type { AcademyGuideListItem } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	academyCategoryLabel,
	academyCategoryTranslationKey,
	deriveCategories,
	filterGuidesByCategory,
	guideGradient,
	hasAcademyGuideBodyContent,
} from "./academy-helpers";

const GUIDES = [
	guide({ category: "Websites", id: "11111111-1111-4111-8111-111111111111" }),
	guide({ category: "Ads", id: "22222222-2222-4222-8222-222222222222" }),
	guide({ category: "websites", id: "33333333-3333-4333-8333-333333333333" }),
	guide({
		category: "  Landing pages  ",
		id: "44444444-4444-4444-8444-444444444444",
	}),
	guide({ category: null, id: "55555555-5555-4555-8555-555555555555" }),
] satisfies AcademyGuideListItem[];

describe("academy category labels", () => {
	it.each([
		["getting-started", "academy.categories.gettingStarted"],
		["websites", "academy.categories.websites"],
		["landing-pages", "academy.categories.landingPages"],
		["ads", "academy.categories.ads"],
		["leads", "academy.categories.leads"],
		["marketing", "academy.categories.marketing"],
		["domains", "academy.categories.domains"],
		["apps", "academy.categories.apps"],
	] as const)("maps %s to %s", (category, key) => {
		expect(academyCategoryTranslationKey(category)).toBe(key);
	});

	it("returns an unknown legacy category unchanged", () => {
		const translate = (key: string) => `translated:${key}`;

		expect(academyCategoryTranslationKey("Legacy category")).toBeNull();
		expect(academyCategoryLabel("Legacy category", translate)).toBe(
			"Legacy category",
		);
	});

	it("uses the translator for a canonical category slug", () => {
		const translate = (key: string) => `translated:${key}`;

		expect(academyCategoryLabel("websites", translate)).toBe(
			"translated:academy.categories.websites",
		);
	});
});

describe("hasAcademyGuideBodyContent", () => {
	it("rejects whitespace-only and structurally empty HTML", () => {
		expect(hasAcademyGuideBodyContent("  \n\t ")).toBe(false);
		expect(hasAcademyGuideBodyContent("<p></p>")).toBe(false);
		expect(hasAcademyGuideBodyContent("<p><br></p>")).toBe(false);
		expect(hasAcademyGuideBodyContent("<p>&nbsp;</p>")).toBe(false);
	});

	it("accepts visible text and image-only HTML", () => {
		expect(hasAcademyGuideBodyContent("<p>Guide body</p>")).toBe(true);
		expect(
			hasAcademyGuideBodyContent(
				'<p><img src="https://example.com/a.png"></p>',
			),
		).toBe(true);
	});
});

describe("deriveCategories", () => {
	it("sorts and deduplicates categories while preserving display casing", () => {
		expect(deriveCategories(GUIDES)).toEqual([
			"Ads",
			"Landing pages",
			"Websites",
		]);
	});

	it("ignores empty categories", () => {
		expect(
			deriveCategories([
				guide({ category: "" }),
				guide({ category: "   " }),
				guide({ category: null }),
			]),
		).toEqual([]);
	});
});

describe("filterGuidesByCategory", () => {
	it("returns every guide when the category is null", () => {
		expect(filterGuidesByCategory(GUIDES, null)).toEqual(GUIDES);
	});

	it("matches categories without changing their published casing", () => {
		expect(filterGuidesByCategory(GUIDES, "Websites")).toEqual([
			GUIDES[0],
			GUIDES[2],
		]);
		expect(filterGuidesByCategory(GUIDES, "Landing pages")).toEqual([
			GUIDES[3],
		]);
	});

	it("returns an empty list for an unavailable category", () => {
		expect(filterGuidesByCategory(GUIDES, "Email")).toEqual([]);
	});
});

describe("guideGradient", () => {
	it("is stable for the same guide and uses theme tokens", () => {
		const gradient = guideGradient("11111111-1111-4111-8111-111111111111");

		expect(guideGradient("11111111-1111-4111-8111-111111111111")).toBe(
			gradient,
		);
		expect(gradient).toContain("var(--secondary)");
		expect(gradient).toContain("var(--muted)");
		expect(gradient).toContain("var(--accent)");
	});

	it("varies the placeholder by guide id", () => {
		expect(guideGradient("guide-one")).not.toBe(guideGradient("guide-two"));
	});
});

function guide(
	overrides: Partial<AcademyGuideListItem> = {},
): AcademyGuideListItem {
	return {
		category: null,
		description: null,
		id: "00000000-0000-4000-8000-000000000001",
		publishedAt: "2026-08-15T10:00:00.000Z",
		title: "Academy guide",
		youtubeVideoId: null,
		...overrides,
	};
}
