import { describe, expect, it } from "vitest";

import { extractMediaUrls } from "./extract-media-urls";

describe("extractMediaUrls", () => {
	it("keeps up to the Personal Clipper maximum of 20 media URLs", () => {
		const clips = Array.from(
			{ length: 21 },
			(_, index) => `https://media.example/clip-${index + 1}.mp4`,
		);

		expect(extractMediaUrls({ clips })).toEqual(
			clips.slice(0, 20).map((url) => ({ kind: "video", url })),
		);
	});

	it("still deduplicates media and excludes preview assets", () => {
		expect(
			extractMediaUrls({
				content: [
					"https://media.example/final.mp4",
					"https://media.example/final.mp4",
					"https://media.example/preset/demo.mp4",
					"https://media.example/poster_min.webp",
				],
			}),
		).toEqual([{ kind: "video", url: "https://media.example/final.mp4" }]);
	});
});
