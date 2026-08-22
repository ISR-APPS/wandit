import { describe, expect, it } from "vitest";

import {
	assessVideoSourceImage,
	type VideoSourceImageMeta,
	videoSourceRejectionMessage,
} from "./assess-video-source-image";
import { videoSourceImageSpecForModel } from "./video-source-image-spec";

const MEBIBYTE = 1024 * 1024;
const KLING = videoSourceImageSpecForModel("klingai/kling-v2.1-i2v");
const DEFAULT = videoSourceImageSpecForModel("another-provider/video");
const BASE_META: VideoSourceImageMeta = {
	byteLength: MEBIBYTE,
	hasAlpha: false,
	height: 600,
	mediaType: "image/jpeg",
	width: 800,
};

describe("assessVideoSourceImage", () => {
	it.each([
		{
			label: "Kling JPEG passthrough",
			meta: BASE_META,
			repairs: [],
			spec: KLING,
		},
		{
			label: "Kling PNG passthrough",
			meta: { ...BASE_META, mediaType: "image/png" },
			repairs: [],
			spec: KLING,
		},
		{
			label: "Kling WebP format conversion",
			meta: { ...BASE_META, mediaType: "image/webp" },
			repairs: ["convert-format"],
			spec: KLING,
		},
		{
			label: "short-side upscale",
			meta: { ...BASE_META, height: 299, width: 600 },
			repairs: ["upscale-min-side"],
			spec: KLING,
		},
		{
			label: "wide aspect padding",
			meta: { ...BASE_META, height: 300, width: 900 },
			repairs: ["pad-aspect"],
			spec: KLING,
		},
		{
			label: "tall aspect padding",
			meta: { ...BASE_META, height: 900, width: 300 },
			repairs: ["pad-aspect"],
			spec: KLING,
		},
		{
			label: "provider-size recompression",
			meta: { ...BASE_META, byteLength: 10 * MEBIBYTE + 1 },
			repairs: ["recompress"],
			spec: KLING,
		},
		{
			label: "all compatible repairs retain policy order",
			meta: {
				...BASE_META,
				byteLength: 11 * MEBIBYTE,
				height: 200,
				mediaType: "image/webp",
				width: 600,
			},
			repairs: [
				"convert-format",
				"upscale-min-side",
				"pad-aspect",
				"recompress",
			],
			spec: KLING,
		},
		{
			label: "default-spec WebP passthrough",
			meta: { ...BASE_META, height: 64, mediaType: "image/webp", width: 256 },
			repairs: [],
			spec: DEFAULT,
		},
		{
			label: "default-spec unsupported-format conversion",
			meta: { ...BASE_META, mediaType: "image/avif" },
			repairs: ["convert-format"],
			spec: DEFAULT,
		},
		{
			label: "default-spec minimum-side upscale",
			meta: { ...BASE_META, height: 63, width: 252 },
			repairs: ["upscale-min-side"],
			spec: DEFAULT,
		},
		{
			label: "default-spec recompression",
			meta: { ...BASE_META, byteLength: 20 * MEBIBYTE + 1 },
			repairs: ["recompress"],
			spec: DEFAULT,
		},
	] as const)("returns the expected repairs for $label", ({
		meta,
		repairs,
		spec,
	}) => {
		expect(assessVideoSourceImage(meta, spec)).toEqual({
			ok: true,
			repairs,
		});
	});

	it.each([
		{
			code: "aspect_extreme",
			label: "wider than 4:1 under Kling",
			meta: { ...BASE_META, height: 100, width: 401 },
			spec: KLING,
		},
		{
			code: "aspect_extreme",
			label: "taller than 1:4 under Kling",
			meta: { ...BASE_META, height: 401, width: 100 },
			spec: KLING,
		},
		{
			code: "aspect_extreme",
			label: "wider than 4:1 under the default descriptor",
			meta: { ...BASE_META, height: 100, width: 401 },
			spec: DEFAULT,
		},
		{
			code: "too_large",
			label: "above the 40 MP source-pixel ceiling",
			meta: { ...BASE_META, height: 5_000, width: 8_201 },
			spec: KLING,
		},
	] as const)("rejects a source that is $label", ({ code, meta, spec }) => {
		expect(assessVideoSourceImage(meta, spec)).toEqual({
			code,
			ok: false,
		});
	});

	it("accepts the absolute 1:4 and 4:1 boundaries for padding", () => {
		expect(
			assessVideoSourceImage({ ...BASE_META, height: 100, width: 400 }, KLING),
		).toEqual({ ok: true, repairs: ["upscale-min-side", "pad-aspect"] });
		expect(
			assessVideoSourceImage(
				{ ...BASE_META, height: 400, width: 100 },
				DEFAULT,
			),
		).toEqual({ ok: true, repairs: [] });
	});

	it.each([
		KLING,
		DEFAULT,
	])("rejects bytes above the 25 MB processing ceiling", (spec) => {
		expect(
			assessVideoSourceImage(
				{ ...BASE_META, byteLength: 25 * MEBIBYTE + 1 },
				spec,
			),
		).toEqual({ code: "too_large", ok: false });
	});

	it("keeps exact provider and processing byte ceilings legal", () => {
		expect(
			assessVideoSourceImage(
				{ ...BASE_META, byteLength: KLING.maxSourceBytes },
				KLING,
			),
		).toEqual({ ok: true, repairs: [] });
		expect(
			assessVideoSourceImage(
				{ ...BASE_META, byteLength: 25 * MEBIBYTE },
				DEFAULT,
			),
		).toEqual({ ok: true, repairs: ["recompress"] });
	});
});

describe("videoSourceRejectionMessage", () => {
	it("describes the measured aspect and model-specific accepted range", () => {
		expect(
			videoSourceRejectionMessage(
				"aspect_extreme",
				{ height: 512, width: 8192 },
				KLING,
			),
		).toBe(
			"This image is 8192×512 px (16:1). The video model accepts shapes between 1:2.5 and 2.5:1. Please send a less stretched image.",
		);
	});

	it("uses the provider-agnostic absolute range without a descriptor", () => {
		expect(
			videoSourceRejectionMessage("aspect_extreme", {
				height: 500,
				width: 2500,
			}),
		).toContain("between 1:4 and 4:1");
	});

	it("describes the measured byte size and processing ceiling", () => {
		expect(
			videoSourceRejectionMessage("too_large", {
				byteLength: 26 * MEBIBYTE,
			}),
		).toBe(
			"This image is 26 MB. We can prepare source images up to 25 MB. Please upload a smaller or less detailed image.",
		);
	});

	it("describes the measured megapixels and source-pixel ceiling", () => {
		expect(
			videoSourceRejectionMessage("too_large", {
				height: 5_000,
				width: 8_201,
			}),
		).toBe(
			"This image is 41.01 megapixels (MP). We can prepare source images up to the 40 MP limit. Please upload an image with smaller dimensions.",
		);
	});

	it("keeps unreadable storage copy concrete", () => {
		expect(videoSourceRejectionMessage("unreadable", {})).toBe(
			"We could not read this image from storage. Please re-upload it.",
		);
	});
});
