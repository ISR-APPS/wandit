import { randomBytes } from "node:crypto";

import { generateImage } from "ai";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isR2Configured,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { SINGLE_FRAME_INSTRUCTION } from "../../../image-generations/application/services/image-generator";
import { generateBuildImage } from "./generate-image";

// Env is a mutable stub so each test controls exactly which keys exist; the
// real r2 key/url helpers stay in place (they are what the URL test proves),
// while everything with credentials or network is mocked.
const mockEnv = vi.hoisted(() => ({
	AI_IMAGE_MODEL: undefined as string | undefined,
	R2_PUBLIC_BASE_URL: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateImage: vi.fn(),
}));

vi.mock("../../../../infrastructure/storage/r2", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("../../../../infrastructure/storage/r2")
		>();

	return { ...original, isR2Configured: vi.fn(), putSiteFile: vi.fn() };
});

const PARAMS = {
	aspect: "16:9" as const,
	attemptId: "attempt_1",
	index: 2,
	metering: { operation: "image" as const, userId: "user_1" },
	projectId: "project_1",
	prompt:
		"editorial photography of a ceramic tagine in a sunlit riad, warm side " +
		"light, negative space top-left",
};

function mockGeneratedImage(mediaType = "image/png") {
	vi.mocked(generateImage).mockResolvedValue({
		image: {
			base64: "aW1nLWJ5dGVz",
			mediaType,
			uint8Array: new Uint8Array([1, 2, 3]),
		},
		providerMetadata: { gateway: { generationId: "generation_1" } },
		usage: { inputTokens: 10, outputTokens: 0 },
	} as unknown as Awaited<ReturnType<typeof generateImage>>);
}

beforeEach(() => {
	vi.mocked(generateImage).mockReset();
	vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
	vi.mocked(putSiteFile).mockReset().mockResolvedValue(undefined);
	mockEnv.AI_IMAGE_MODEL = "openai/gpt-image-2";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
});

describe("generateBuildImage", () => {
	it("answers unavailable when AI_IMAGE_MODEL is unset", async () => {
		mockEnv.AI_IMAGE_MODEL = undefined;

		const result = await generateBuildImage(PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateImage).not.toHaveBeenCalled();
	});

	it("answers unavailable when R2_PUBLIC_BASE_URL is unset", async () => {
		mockEnv.R2_PUBLIC_BASE_URL = undefined;

		const result = await generateBuildImage(PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateImage).not.toHaveBeenCalled();
	});

	it("answers unavailable when R2 credentials are missing", async () => {
		vi.mocked(isR2Configured).mockReturnValue(false);

		const result = await generateBuildImage(PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateImage).not.toHaveBeenCalled();
	});

	it("generates, uploads under the attempt, and returns the public URL", async () => {
		mockGeneratedImage();

		const result = await generateBuildImage(PARAMS);

		expect(generateImage).toHaveBeenCalledWith({
			model: "openai/gpt-image-2",
			prompt: `${PARAMS.prompt}\n${SINGLE_FRAME_INSTRUCTION}`,
			providerOptions: {
				gateway: {
					tags: ["op:image", "ws:personal"],
					user: "user_1",
				},
			},
			size: "1536x1024",
		});
		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/img-2.png",
			new Uint8Array([1, 2, 3]),
			"image/png",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		expect(result).toEqual({
			// Three bytes are not a readable image, so the provider canvas for
			// the requested aspect is what the dimensions fall back to.
			height: 1024,
			// Base64 is now derived from the uploaded bytes, so transcript and
			// bucket can never disagree.
			imageBase64: "AQID",
			mediaType: "image/png",
			model: "openai/gpt-image-2",
			providerMetadata: { gateway: { generationId: "generation_1" } },
			status: "generated",
			usage: { inputTokens: 10, outputTokens: 0 },
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-2.png",
			width: 1536,
		});
	});

	it("persists provider evidence before uploading builder image bytes", async () => {
		mockGeneratedImage();
		const onProviderGeneration = vi.fn(async () => undefined);

		await generateBuildImage({ ...PARAMS, onProviderGeneration });

		expect(onProviderGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				providerMetadata: { gateway: { generationId: "generation_1" } },
			}),
		);
		expect(onProviderGeneration.mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(putSiteFile).mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
	});

	it("joins the public URL cleanly when the base has a trailing slash", async () => {
		mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com/";
		mockGeneratedImage();

		const result = await generateBuildImage(PARAMS);

		expect(result).toMatchObject({
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-2.png",
		});
	});

	it("recompresses heavy raster output to webp before upload", async () => {
		// Noise defeats PNG compression, so the 2500px canvas is comfortably
		// over the optimizer's 150KB threshold.
		const bigPng = await sharp(randomBytes(2500 * 300 * 3), {
			raw: { channels: 3, height: 300, width: 2500 },
		})
			.png()
			.toBuffer();
		vi.mocked(generateImage).mockResolvedValue({
			image: {
				base64: bigPng.toString("base64"),
				mediaType: "image/png",
				uint8Array: new Uint8Array(bigPng),
			},
			providerMetadata: { gateway: { generationId: "generation_1" } },
			usage: { inputTokens: 10, outputTokens: 0 },
		} as unknown as Awaited<ReturnType<typeof generateImage>>);

		const result = await generateBuildImage(PARAMS);

		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/img-2.webp",
			expect.any(Uint8Array),
			"image/webp",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);

		const uploaded = vi.mocked(putSiteFile).mock.calls[0]?.[1] as Uint8Array;
		const metadata = await sharp(uploaded).metadata();
		expect(metadata.format).toBe("webp");
		expect(metadata.width).toBe(1920);

		expect(result).toMatchObject({
			// Measured from the stored bytes, not from the requested canvas.
			height: 230,
			mediaType: "image/webp",
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-2.webp",
			width: 1920,
		});

		// The srcset renditions land beside the primary object.
		expect(
			vi
				.mocked(putSiteFile)
				.mock.calls.slice(1)
				.map((call) => call[0]),
		).toEqual([
			"sites/project_1/assets/attempt_1/img-2.w480.webp",
			"sites/project_1/assets/attempt_1/img-2.w960.webp",
			"sites/project_1/assets/attempt_1/img-2.w1600.webp",
		]);

		if (result.status !== "generated") {
			throw new Error("expected a generated result");
		}

		// Transcript payload and bucket must carry the SAME optimized bytes.
		expect(result.imageBase64).toBe(Buffer.from(uploaded).toString("base64"));
	});

	it("derives the object extension from the returned media type", async () => {
		mockGeneratedImage("image/jpeg");

		await generateBuildImage(PARAMS);

		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/img-2.jpg",
			expect.anything(),
			"image/jpeg",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
	});

	it("keeps the image when a rendition upload fails", async () => {
		const bigPng = await sharp(randomBytes(2500 * 300 * 3), {
			raw: { channels: 3, height: 300, width: 2500 },
		})
			.png()
			.toBuffer();
		vi.mocked(generateImage).mockResolvedValue({
			image: {
				base64: bigPng.toString("base64"),
				mediaType: "image/png",
				uint8Array: new Uint8Array(bigPng),
			},
			providerMetadata: { gateway: { generationId: "generation_1" } },
			usage: { inputTokens: 10, outputTokens: 0 },
		} as unknown as Awaited<ReturnType<typeof generateImage>>);
		// The primary object stores; every rendition is refused.
		vi.mocked(putSiteFile).mockImplementation(async (key) =>
			/\.w\d+\.webp$/.test(key)
				? Promise.reject(new Error("R2 said no"))
				: undefined,
		);

		const result = await generateBuildImage(PARAMS);

		expect(result).toMatchObject({ status: "generated" });
	});

	it("maps every brief aspect onto a supported canvas", async () => {
		const expected = {
			"1:1": "1024x1024",
			"2:3": "1024x1536",
			"3:2": "1536x1024",
			"4:5": "1024x1536",
			"16:9": "1536x1024",
		} as const;

		for (const [aspect, size] of Object.entries(expected)) {
			mockGeneratedImage();

			await generateBuildImage({
				...PARAMS,
				aspect: aspect as keyof typeof expected,
			});

			expect(generateImage).toHaveBeenLastCalledWith(
				expect.objectContaining({ size }),
			);
		}
	});

	it("answers failed (never throws) when generation blows up", async () => {
		vi.mocked(generateImage).mockRejectedValue(new Error("gateway exploded"));

		const result = await generateBuildImage(PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			status: "failed",
		});
		if (result.status !== "failed") throw new Error("expected failed result");
		expect(result.message).not.toContain("gateway exploded");
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("answers failed (never throws) when the upload blows up", async () => {
		mockGeneratedImage();
		vi.mocked(putSiteFile).mockRejectedValue(new Error("R2 said no"));

		const result = await generateBuildImage(PARAMS);

		expect(result).toMatchObject({
			message: "R2 said no",
			providerMetadata: { gateway: { generationId: "generation_1" } },
			providerUnits: 1,
			status: "failed",
		});
	});
});
