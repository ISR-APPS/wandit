import { describe, expect, it } from "vitest";
import { isMediaGenerationGeneratingStale } from "./media-generation-staleness";

const NOW = new Date("2026-08-22T12:00:00.000Z");

describe("isMediaGenerationGeneratingStale", () => {
	it("keeps an extension active when its parent is old but a leg completed ten minutes ago", () => {
		expect(
			isMediaGenerationGeneratingStale(
				{
					kind: "video-extension",
					latestLegActivityAt: new Date(NOW.getTime() - 10 * 60 * 1_000),
					startedAt: new Date(NOW.getTime() - 50 * 60 * 1_000),
				},
				NOW,
			),
		).toBe(false);
	});

	it("marks an extension stale after 36 minutes without leg activity", () => {
		expect(
			isMediaGenerationGeneratingStale(
				{
					kind: "video-extension",
					latestLegActivityAt: null,
					startedAt: new Date(NOW.getTime() - 36 * 60 * 1_000),
				},
				NOW,
			),
		).toBe(true);
	});
});
