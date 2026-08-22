import { describe, expect, it } from "vitest";

import { videoSourceImageSpecForModel } from "./video-source-image-spec";

const MEBIBYTE = 1024 * 1024;

describe("videoSourceImageSpecForModel", () => {
	it.each([
		"klingai/kling-v2.1-i2v",
		"klingai/future-model",
	])("resolves Kling-family constraints for %s", (modelId) => {
		expect(videoSourceImageSpecForModel(modelId)).toEqual({
			acceptedMediaTypes: ["image/jpeg", "image/png"],
			aspectRatio: { max: 2.5, min: 1 / 2.5 },
			maxSourceBytes: 10 * MEBIBYTE,
			minSidePx: 300,
		});
	});

	it.each([
		"",
		"google/veo-3",
		"future-provider/video-v1",
	])("falls back to a permissive descriptor for %s", (modelId) => {
		expect(videoSourceImageSpecForModel(modelId)).toEqual({
			acceptedMediaTypes: ["image/jpeg", "image/png", "image/webp"],
			aspectRatio: { max: 4, min: 1 / 4 },
			maxSourceBytes: 20 * MEBIBYTE,
			minSidePx: 64,
		});
	});

	it("returns independent value objects", () => {
		const first = videoSourceImageSpecForModel("klingai/model");
		first.aspectRatio.max = 99;
		const second = videoSourceImageSpecForModel("klingai/model");

		expect(second.aspectRatio.max).toBe(2.5);
	});
});
