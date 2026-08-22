import { describe, expect, it } from "vitest";

import {
	buildContinuationPrompt,
	buildEditPrompt,
} from "./video-edit-extension-prompts";

describe("video edit and extension prompts", () => {
	it("builds the provider-proven surgical edit prompt without inventing direction", () => {
		expect(buildEditPrompt("make the jacket forest green")).toBe(
			"Surgical edit of [Video 1]: make the jacket forest green. " +
				"Keep everything else exactly the same as the source video: the framing, " +
				"the lighting, the camera movement, and the timing.",
		);
	});

	it("builds the fixed final-frame continuation prompt", () => {
		expect(
			buildContinuationPrompt(
				"the cyclist rounds the corner and enters the plaza",
			),
		).toBe(
			"Continue this exact scene from the final frame: the cyclist rounds the corner and enters the plaza. " +
				"Keep the same setting, subjects, lighting, color grade, and camera style. " +
				"No scene change, no new characters, no on-screen text.",
		);
	});
});
