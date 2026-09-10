import { describe, expect, it } from "vitest";

import { appendReadyMediaAssets } from "./ready-media-assets";

describe("appendReadyMediaAssets", () => {
	const IMAGE = "https://assets.example.com/images/p1/a1/img-1.png";
	const VIDEO = "https://assets.example.com/sites/p1/assets/a2/vid-1.mp4";

	it("appends a READY MEDIA ASSETS section for URLs the brief forgot", () => {
		const brief = appendReadyMediaAssets("Build the page.", [
			{ kind: "image", url: IMAGE },
			{ kind: "video", url: VIDEO },
		]);

		expect(brief).toContain("READY MEDIA ASSETS");
		expect(brief).toContain(`- image: ${IMAGE}`);
		expect(brief).toContain(`- video: ${VIDEO}`);
		expect(brief.startsWith("Build the page.")).toBe(true);
	});

	it("returns the brief unchanged when every asset URL is already listed", () => {
		const diligent = `Build the page.\nMEDIA ASSETS:\n- hero shot: ${IMAGE}`;

		expect(
			appendReadyMediaAssets(diligent, [{ kind: "image", url: IMAGE }]),
		).toBe(diligent);
	});

	it("returns the brief unchanged when the conversation has no assets", () => {
		expect(appendReadyMediaAssets("Build the page.", [])).toBe(
			"Build the page.",
		);
	});

	it("bounds the appended section to 16 asset lines", () => {
		const assets = Array.from({ length: 20 }, (_, index) => ({
			kind: "image",
			url: `https://assets.example.com/img-${index}.png`,
		}));

		const brief = appendReadyMediaAssets("Build the page.", assets);

		expect(brief.match(/^- image: /gm)).toHaveLength(16);
	});
});
