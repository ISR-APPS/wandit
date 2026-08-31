import { randomBytes } from "node:crypto";

import {
	GatewayInternalServerError,
	GatewayInvalidRequestError,
	GatewayResponseError,
} from "@ai-sdk/gateway";
import { APICallError, generateImage, generateText } from "ai";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isR2Configured,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { storeImageVariants } from "../../../../infrastructure/storage/store-image-variants";
import {
	editImageFromSources,
	generateImageFromPrompt,
	generateStandaloneImage,
	SINGLE_FRAME_INSTRUCTION,
	SOURCE_FIDELITY_INSTRUCTION,
	STANDALONE_SIZE_BY_ASPECT,
} from "./image-generator";

// Env is a mutable stub so each test controls exactly which keys exist; the
// real r2 key/url helpers stay in place, everything with credentials or
// network is mocked (same pattern as generate-video.spec.ts).
const mockEnv = vi.hoisted(() => ({
	AI_IMAGE_EDIT_MODEL: undefined as string | undefined,
	AI_IMAGE_MODEL: undefined as string | undefined,
	R2_PUBLIC_BASE_URL: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", async (importOriginal) => {
	const original = await importOriginal<typeof import("ai")>();
	return {
		...original,
		generateImage: vi.fn(),
		generateText: vi.fn(),
	};
});

vi.mock("../../../../infrastructure/storage/r2", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("../../../../infrastructure/storage/r2")
		>();

	return { ...original, isR2Configured: vi.fn(), putSiteFile: vi.fn() };
});

vi.mock(
	"../../../../infrastructure/storage/store-image-variants",
	async (importOriginal) => {
		const original =
			await importOriginal<
				typeof import("../../../../infrastructure/storage/store-image-variants")
			>();

		return {
			...original,
			storeImageVariants: vi.fn(original.storeImageVariants),
		};
	},
);

const PARAMS = {
	aspect: "1:1" as const,
	attemptId: "attempt_1",
	index: 1,
	metering: { operation: "image" as const, userId: "user_1" },
	projectId: "project_1",
	prompt: "editorial photography of a ceramic tagine in warm light",
	sourceImageUrls: [] as string[],
};

function mockGeneratedImage(mediaType = "image/png") {
	vi.mocked(generateImage).mockResolvedValue({
		image: {
			base64: "aWs=",
			mediaType,
			uint8Array: new Uint8Array([1, 2, 3]),
		},
		providerMetadata: { gateway: { generationId: "gen_image_1" } },
		usage: { inputTokens: 10, outputTokens: 0 },
	} as unknown as Awaited<ReturnType<typeof generateImage>>);
}

function mockEditedImage(mediaType = "image/png") {
	vi.mocked(generateText).mockResolvedValue({
		files: [
			{ mediaType: "text/plain", uint8Array: new Uint8Array([0]) },
			{ mediaType, uint8Array: new Uint8Array([7, 7]) },
		],
		providerMetadata: { gateway: { generationId: "gen_edit_1" } },
		usage: { inputTokens: 10, outputTokens: 20 },
	} as unknown as Awaited<ReturnType<typeof generateText>>);
}

beforeEach(() => {
	vi.mocked(generateImage).mockReset();
	vi.mocked(generateText).mockReset();
	vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
	vi.mocked(putSiteFile).mockReset().mockResolvedValue(undefined);
	vi.mocked(storeImageVariants).mockClear();
	mockEnv.AI_IMAGE_MODEL = "openai/gpt-image-2";
	mockEnv.AI_IMAGE_EDIT_MODEL = "google/gemini-2.5-flash-image";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
});

describe("generateStandaloneImage", () => {
	it("answers unavailable when AI_IMAGE_MODEL is unset", async () => {
		mockEnv.AI_IMAGE_MODEL = undefined;

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			status: "unavailable",
		});
		expect(generateImage).not.toHaveBeenCalled();
	});

	it("maps every contract aspect onto a supported canvas", async () => {
		for (const [aspect, size] of Object.entries(STANDALONE_SIZE_BY_ASPECT)) {
			mockGeneratedImage();

			await generateStandaloneImage({
				...PARAMS,
				aspect: aspect as keyof typeof STANDALONE_SIZE_BY_ASPECT,
			});

			expect(generateImage).toHaveBeenLastCalledWith(
				expect.objectContaining({ size }),
			);
		}
	});

	it("uploads under the attempt and returns the public URL", async () => {
		mockGeneratedImage("image/webp");

		const result = await generateStandaloneImage(PARAMS);

		expect(putSiteFile).toHaveBeenCalledWith(
			"images/project_1/attempt_1/img-1.webp",
			expect.any(Uint8Array),
			"image/webp",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		expect(result).toEqual({
			// Three bytes are not a readable image, so the dimensions fall back
			// to the canvas the provider was asked for (1:1 -> 1024x1024).
			height: 1024,
			mediaType: "image/webp",
			model: "openai/gpt-image-2",
			providerMetadata: { gateway: { generationId: "gen_image_1" } },
			status: "generated",
			usage: { inputTokens: 10, outputTokens: 0 },
			url: "https://assets.example.com/images/project_1/attempt_1/img-1.webp",
			width: 1024,
		});
	});

	it("appends the single-frame instruction to a text-to-image prompt", async () => {
		mockGeneratedImage();

		await generateStandaloneImage(PARAMS);

		expect(generateImage).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: `${PARAMS.prompt}\n${SINGLE_FRAME_INSTRUCTION}`,
			}),
		);
	});

	it("appends the single-frame instruction on the edit path too", async () => {
		mockEnv.AI_IMAGE_EDIT_MODEL = "google/gemini-3-pro-image";
		mockEditedImage();

		await generateStandaloneImage({
			...PARAMS,
			sourceImageUrls: ["https://assets.example.com/uploads/u1/a/photo.jpg"],
		});

		const content =
			vi.mocked(generateText).mock.calls[0]?.[0]?.messages?.[0]?.content;

		if (!Array.isArray(content)) {
			throw new Error("expected a content array");
		}

		expect(content[0]).toMatchObject({
			text: expect.stringContaining(
				`${SOURCE_FIDELITY_INSTRUCTION}${PARAMS.prompt}\n${SINGLE_FRAME_INSTRUCTION}\n`,
			),
			type: "text",
		});
	});

	it("returns the primary URL before deferred variants are stored", async () => {
		mockGeneratedImage("image/webp");

		const result = await generateStandaloneImage({
			...PARAMS,
			deferVariants: true,
		});

		expect(putSiteFile).toHaveBeenCalledTimes(1);
		expect(storeImageVariants).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			status: "generated",
			storeVariants: expect.any(Function),
			url: "https://assets.example.com/images/project_1/attempt_1/img-1.webp",
		});

		if (result.status !== "generated" || !result.storeVariants) {
			throw new Error("Expected deferred variant work");
		}

		await result.storeVariants();
		expect(storeImageVariants).toHaveBeenCalledWith(
			"images/project_1/attempt_1/img-1.webp",
			expect.any(Uint8Array),
		);
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
			providerMetadata: { gateway: { generationId: "gen_image_1" } },
			usage: { inputTokens: 10, outputTokens: 0 },
		} as unknown as Awaited<ReturnType<typeof generateImage>>);

		const result = await generateStandaloneImage(PARAMS);

		expect(putSiteFile).toHaveBeenCalledWith(
			"images/project_1/attempt_1/img-1.webp",
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
			url: "https://assets.example.com/images/project_1/attempt_1/img-1.webp",
			width: 1920,
		});

		// The srcset renditions land beside the primary object.
		expect(
			vi
				.mocked(putSiteFile)
				.mock.calls.slice(1)
				.map((call) => call[0]),
		).toEqual([
			"images/project_1/attempt_1/img-1.w480.webp",
			"images/project_1/attempt_1/img-1.w960.webp",
			"images/project_1/attempt_1/img-1.w1600.webp",
		]);
	});

	it("persists provider evidence before making uploaded bytes recoverable", async () => {
		mockGeneratedImage();
		const onProviderGeneration = vi.fn(async () => undefined);

		await generateStandaloneImage({ ...PARAMS, onProviderGeneration });

		expect(onProviderGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				providerMetadata: { gateway: { generationId: "gen_image_1" } },
			}),
		);
		expect(onProviderGeneration.mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(putSiteFile).mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
	});

	it("routes source-image requests through the edit model", async () => {
		mockEditedImage();

		const result = await generateStandaloneImage({
			...PARAMS,
			sourceImageUrls: ["https://assets.example.com/uploads/u1/a/p.jpg"],
		});

		expect(generateImage).not.toHaveBeenCalled();
		expect(generateText).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({ status: "generated" });
	});

	it("classifies an OpenAI gateway moderation cause without exposing its text", async () => {
		const cause = new APICallError({
			data: {
				error: {
					code: "moderation_blocked",
					message: "raw provider moderation payload",
					moderation_details: {
						categories: ["violence"],
						moderation_stage: "input",
					},
				},
			},
			message: "Provider request failed",
			requestBodyValues: {},
			statusCode: 400,
			url: "https://api.openai.com/v1/images/generations",
		});
		vi.mocked(generateImage).mockRejectedValue(
			new GatewayInvalidRequestError({ cause, generationId: "gen_moderated" }),
		);

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({
			failure: {
				kind: "content_moderated",
				moderationStage: "input",
				provider: "openai",
				providerMessage: "violence",
				requestId: "gen_moderated",
			},
			message:
				"OpenAI declined this request because of its content rules. Change the prompt and try again.",
			status: "failed",
		});
		expect(result).not.toMatchObject({
			message: expect.stringContaining("raw provider"),
		});
	});

	it("classifies a gateway 529 as capacity", async () => {
		vi.mocked(generateImage).mockRejectedValue(
			new GatewayInternalServerError({ statusCode: 529 }),
		);

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "capacity", provider: "openai" },
			message:
				"OpenAI is over capacity right now. Please try again in a minute.",
			status: "failed",
		});
	});

	it("classifies a GatewayResponseError TimeoutError cause as timeout", async () => {
		vi.mocked(generateImage).mockRejectedValue(
			new GatewayResponseError({
				cause: new DOMException("timed out", "TimeoutError"),
				statusCode: 500,
			}),
		);

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "timeout", source: "gateway" },
			message: "OpenAI took too long to answer. Please try again.",
			status: "failed",
		});
	});

	it("classifies Gemini IMAGE_SAFETY no-file finishes as moderation", async () => {
		mockEnv.AI_IMAGE_MODEL = "google/gemini-3-pro-image";
		vi.mocked(generateText).mockResolvedValue({
			files: [],
			finishReason: "other",
			providerMetadata: { gateway: { generationId: "gen_safety" } },
			rawFinishReason: "IMAGE_SAFETY",
			usage: { inputTokens: 10, outputTokens: 0 },
		} as unknown as Awaited<ReturnType<typeof generateText>>);

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({
			failure: {
				kind: "content_moderated",
				moderationStage: "output",
				provider: "google",
				requestId: "gen_safety",
			},
			message:
				"The content filter of Google stopped this generation. Change the prompt and try again.",
			status: "failed",
		});
		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				telemetry: { functionId: "image.generate_text" },
			}),
		);
	});

	it("classifies a Gemini no-file finish without a safety reason as provider_error", async () => {
		vi.mocked(generateText).mockResolvedValue({
			files: [],
			finishReason: "stop",
			providerMetadata: {},
			rawFinishReason: undefined,
			usage: { inputTokens: 1, outputTokens: 0 },
		} as unknown as Awaited<ReturnType<typeof generateText>>);

		const result = await generateImageFromPrompt({
			aspect: "1:1",
			metering: PARAMS.metering,
			model: "google/gemini-3-pro-image",
			prompt: PARAMS.prompt,
			size: "1024x1024",
		});

		expect(result).toMatchObject({
			failure: { kind: "provider_error", provider: "google" },
			message: "Google returned an error. Please try again.",
			status: "failed",
		});
	});

	it("turns provider throws into failed results", async () => {
		vi.mocked(generateImage).mockRejectedValue(new Error("quota"));

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			status: "failed",
		});
		expect(result).not.toMatchObject({ message: "quota" });
	});

	it("preserves a top-level gateway generation id from a provider error", async () => {
		vi.mocked(generateImage).mockRejectedValue(
			Object.assign(new Error("provider failed after accepting work"), {
				generationId: "generation_error_1",
			}),
		);

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({
			model: "openai/gpt-image-2",
			providerMetadata: {
				gateway: { generationId: "generation_error_1" },
			},
			providerUnits: 0,
			status: "failed",
		});
	});

	it("preserves provider evidence when R2 storage fails", async () => {
		mockGeneratedImage();
		vi.mocked(putSiteFile).mockRejectedValueOnce(new Error("R2 unavailable"));

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			model: "openai/gpt-image-2",
			providerMetadata: { gateway: { generationId: "gen_image_1" } },
			providerUnits: 1,
			status: "failed",
		});
	});
});

describe("editImageFromSources", () => {
	const EDIT_PARAMS = {
		aspect: "4:5",
		metering: { operation: "image" as const, userId: "user_1" },
		prompt: "restage on a marble bench",
		sourceImageUrls: [
			"https://assets.example.com/uploads/u1/a/photo-1.jpg",
			"https://assets.example.com/uploads/u1/b/photo-2.png",
		],
	};

	it("fails when AI_IMAGE_EDIT_MODEL is unset", async () => {
		mockEnv.AI_IMAGE_EDIT_MODEL = undefined;

		const result = await editImageFromSources(EDIT_PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			status: "failed",
		});
		expect(generateText).not.toHaveBeenCalled();
	});

	it("sends the fidelity instruction plus one file part per source", async () => {
		mockEditedImage();

		await editImageFromSources(EDIT_PARAMS);

		const call = vi.mocked(generateText).mock.calls[0]?.[0];
		const message = call?.messages?.[0];
		const content = message?.content;

		if (!Array.isArray(content)) {
			throw new Error("expected a content array");
		}

		expect(content).toHaveLength(3);
		expect(content[0]).toMatchObject({
			text: expect.stringContaining(SOURCE_FIDELITY_INSTRUCTION),
			type: "text",
		});
		expect(content[0]).toMatchObject({
			text: expect.stringContaining("Target aspect ratio: 4:5."),
		});
		expect(content[1]).toMatchObject({
			data: EDIT_PARAMS.sourceImageUrls[0],
			type: "file",
		});
		expect(content[2]).toMatchObject({
			data: EDIT_PARAMS.sourceImageUrls[1],
			type: "file",
		});
		expect(call?.providerOptions).toMatchObject({
			gateway: {
				tags: ["op:image", "ws:personal"],
				user: "user_1",
			},
		});
		expect(call?.telemetry).toEqual({ functionId: "image.edit" });
	});

	it("returns the first image file from the response", async () => {
		mockEditedImage("image/jpeg");

		const result = await editImageFromSources(EDIT_PARAMS);

		expect(result).toMatchObject({
			mediaType: "image/jpeg",
			status: "generated",
		});
	});

	it("fails when the model returns no image file", async () => {
		vi.mocked(generateText).mockResolvedValue({
			files: [],
		} as unknown as Awaited<ReturnType<typeof generateText>>);

		const result = await editImageFromSources(EDIT_PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "provider_error", provider: "google" },
			message: "Google returned an error. Please try again.",
			status: "failed",
		});
	});
});
