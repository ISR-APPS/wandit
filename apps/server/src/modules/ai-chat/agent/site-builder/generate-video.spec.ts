import {
	GatewayInternalServerError,
	GatewayResponseError,
	gateway,
} from "@ai-sdk/gateway";
import { experimental_generateVideo as generateVideo } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isR2Configured,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { prepareVideoSourceImage } from "../../../media-generations/application/services/prepare-video-source-image";
import {
	editVideoProviderTimeoutMs,
	generateBuildVideo,
	generateTextToVideo,
	videoCostEstimateInput,
	videoProviderTimeoutMs,
} from "./generate-video";

// Env is a mutable stub so each test controls exactly which keys exist; the
// real r2 key/url helpers stay in place (they are what the URL test proves),
// while everything with credentials or network is mocked.
const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: undefined as string | undefined,
	R2_PUBLIC_BASE_URL: undefined as string | undefined,
	TRIGGER_SECRET_KEY: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	experimental_generateVideo: vi.fn(),
}));

vi.mock("@ai-sdk/gateway", async (importOriginal) => ({
	...(await importOriginal<typeof import("@ai-sdk/gateway")>()),
	gateway: { video: vi.fn(() => ({ modelId: "mock-video-model" })) },
}));

vi.mock(
	"../../../media-generations/application/services/prepare-video-source-image",
	() => ({ prepareVideoSourceImage: vi.fn() }),
);

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
	imageUrl:
		"https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png",
	index: 2,
	metering: { operation: "video" as const, userId: "user_1" },
	modelId: "klingai/kling-v2.6-i2v",
	motionPrompt: "steam drifts slowly off the tagine, warm light breathes",
	projectId: "project_1",
	voiceControl: false,
};

const TEXT_PARAMS = {
	aspect: "16:9" as const,
	attemptId: "attempt_1",
	durationSeconds: 10 as const,
	index: 1,
	metering: { operation: "video" as const, userId: "user_1" },
	modelId: "klingai/kling-v2.6-t2v",
	prompt: "A cinematic product reveal",
	projectId: "project_1",
	voiceControl: false,
};

function mockGeneratedVideo(mediaType = "video/mp4") {
	vi.mocked(generateVideo).mockResolvedValue({
		video: {
			mediaType,
			uint8Array: new Uint8Array([9, 9, 9]),
		},
		providerMetadata: { gateway: { generationId: "generation_1" } },
		warnings: [],
	} as unknown as Awaited<ReturnType<typeof generateVideo>>);
}

beforeEach(() => {
	vi.mocked(generateVideo).mockReset();
	vi.mocked(gateway.video).mockClear();
	vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
	vi.mocked(putSiteFile).mockReset().mockResolvedValue(undefined);
	vi.mocked(prepareVideoSourceImage).mockReset().mockResolvedValue({
		height: 900,
		mediaType: "image/png",
		repaired: false,
		status: "ready",
		url: PARAMS.imageUrl,
		width: 1_600,
	});
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
	mockEnv.TRIGGER_SECRET_KEY = "tr_dev_test";
});

describe("videoProviderTimeoutMs", () => {
	it("keeps the old ceiling through ten seconds and scales arbitrary positive durations", () => {
		expect(videoProviderTimeoutMs(4)).toBe(6 * 60_000);
		expect(videoProviderTimeoutMs(5)).toBe(6 * 60_000);
		expect(videoProviderTimeoutMs(10)).toBe(6 * 60_000);
		expect(videoProviderTimeoutMs(15)).toBe(495_000);
		expect(videoProviderTimeoutMs(30)).toBe(15 * 60_000);
	});

	it("leaves edit-task settlement headroom at the thirty-second ceiling", () => {
		expect(editVideoProviderTimeoutMs(10)).toBe(6 * 60_000);
		expect(editVideoProviderTimeoutMs(30)).toBe(14 * 60_000);
	});

	it.each([
		0,
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
	])("rejects non-positive or non-finite duration %s", (durationSeconds) => {
		expect(() => videoProviderTimeoutMs(durationSeconds)).toThrow(RangeError);
	});
});

describe("generateBuildVideo", () => {
	it("answers unavailable when the AI Gateway key is unset", async () => {
		mockEnv.AI_GATEWAY_API_KEY = undefined;

		const result = await generateBuildVideo(PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateVideo).not.toHaveBeenCalled();
	});

	it("answers unavailable when R2_PUBLIC_BASE_URL is unset", async () => {
		mockEnv.R2_PUBLIC_BASE_URL = undefined;

		const result = await generateBuildVideo(PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateVideo).not.toHaveBeenCalled();
	});

	it("answers unavailable when R2 credentials are missing", async () => {
		vi.mocked(isR2Configured).mockReturnValue(false);

		const result = await generateBuildVideo(PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateVideo).not.toHaveBeenCalled();
	});

	it("answers unavailable when Trigger.dev is unconfigured", async () => {
		mockEnv.TRIGGER_SECRET_KEY = undefined;

		const result = await generateBuildVideo(PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateVideo).not.toHaveBeenCalled();
	});

	it("refuses images that are not Wandit-hosted assets", async () => {
		const result = await generateBuildVideo({
			...PARAMS,
			imageUrl: "https://evil.example.net/photo.png",
		});

		expect(result).toMatchObject({
			message: expect.stringContaining("Wandit-hosted"),
			status: "failed",
		});
		expect(generateVideo).not.toHaveBeenCalled();
		expect(prepareVideoSourceImage).not.toHaveBeenCalled();
	});

	it("returns the source pre-flight reason without calling the provider", async () => {
		vi.mocked(prepareVideoSourceImage).mockResolvedValueOnce({
			reasonCode: "aspect_extreme",
			status: "rejected",
			userMessage:
				"This image is 8192×512 px (16:1). Please send a less stretched image.",
		});

		const result = await generateBuildVideo(PARAMS);

		expect(result).toEqual({
			message: "video source image pre-flight rejected: aspect_extreme",
			reasonCode: "aspect_extreme",
			status: "failed",
			userMessage:
				"This image is 8192×512 px (16:1). Please send a less stretched image.",
		});
		expect(generateVideo).not.toHaveBeenCalled();
	});

	it("maps a transient source preparation failure to an internal safe result", async () => {
		vi.mocked(prepareVideoSourceImage).mockRejectedValueOnce(
			new Error("R2 temporarily unavailable"),
		);

		const result = await generateBuildVideo(PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			status: "failed",
		});
		if (result.status !== "failed") throw new Error("expected failed result");
		expect(result.message).not.toContain("R2 temporarily unavailable");
		expect(result).not.toHaveProperty("userMessage");
		expect(generateVideo).not.toHaveBeenCalled();
	});

	it("uses the prepared source URL as the provider image input", async () => {
		mockGeneratedVideo();
		vi.mocked(prepareVideoSourceImage).mockResolvedValueOnce({
			height: 900,
			mediaType: "image/jpeg",
			repaired: true,
			status: "ready",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-1.video-src-f50714c0.jpg",
			width: 1_600,
		});

		await generateBuildVideo(PARAMS);

		expect(prepareVideoSourceImage).toHaveBeenCalledWith({
			modelId: "klingai/kling-v2.6-i2v",
			sourceUrl: PARAMS.imageUrl,
		});
		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.objectContaining({
					image:
						"https://assets.example.com/sites/project_1/assets/attempt_1/img-1.video-src-f50714c0.jpg",
				}),
			}),
		);
	});

	it("generates, uploads under the attempt, and returns the public URL", async () => {
		mockGeneratedVideo();

		const result = await generateBuildVideo(PARAMS);

		expect(gateway.video).toHaveBeenCalledWith("klingai/kling-v2.6-i2v");
		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				aspectRatio: "16:9",
				duration: 5,
				fps: 30,
				generateAudio: false,
				maxRetries: 0,
				n: 1,
				prompt: {
					image: PARAMS.imageUrl,
					text: expect.stringContaining(PARAMS.motionPrompt),
				},
				providerOptions: {
					gateway: {
						tags: ["op:video", "ws:personal"],
						user: "user_1",
					},
					klingai: { mode: "std" },
				},
			}),
		);
		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/vid-2.mp4",
			new Uint8Array([9, 9, 9]),
			"video/mp4",
			// uuid-addressed object, written once: cacheable forever.
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		expect(result).toEqual({
			mediaType: "video/mp4",
			model: "klingai/kling-v2.6-i2v",
			providerMetadata: { gateway: { generationId: "generation_1" } },
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/vid-2.mp4",
		});
	});

	it("passes a snapshotted ten-second duration for extension legs", async () => {
		mockGeneratedVideo();

		await generateBuildVideo({
			...PARAMS,
			durationSeconds: 10,
			profile: "image-animation",
		});

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				duration: 10,
				prompt: expect.objectContaining({
					text: expect.stringContaining("continuous ten-second"),
				}),
			}),
		);
	});

	it("persists provider evidence before uploading builder video bytes", async () => {
		mockGeneratedVideo();
		const onProviderGeneration = vi.fn(async () => undefined);

		await generateBuildVideo({ ...PARAMS, onProviderGeneration });

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

	it("uses the standalone preservation prompt and requested motion strength", async () => {
		mockGeneratedVideo();

		await generateBuildVideo({
			...PARAMS,
			motion: "dynamic",
			profile: "image-animation",
		});

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: {
					image: PARAMS.imageUrl,
					text: expect.stringMatching(
						/continuous five-second[\s\S]*Preserve the exact subject[\s\S]*energetic but physically believable[\s\S]*Motion direction:/,
					),
				},
			}),
		);
	});

	it("does not send Kling-only options to another video provider", async () => {
		mockGeneratedVideo();

		await generateBuildVideo({
			...PARAMS,
			modelId: "google/veo-test",
			profile: "image-animation",
		});

		expect(gateway.video).toHaveBeenCalledWith("google/veo-test");
		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				providerOptions: {
					gateway: {
						tags: ["op:video", "ws:personal"],
						user: "user_1",
					},
				},
			}),
		);
	});

	it("derives the object extension from the returned media type", async () => {
		mockGeneratedVideo("video/webm");

		await generateBuildVideo(PARAMS);

		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/vid-2.webm",
			expect.anything(),
			"video/webm",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
	});

	it("defaults the extension to mp4 for unknown media types", async () => {
		mockGeneratedVideo("video/quicktime");

		await generateBuildVideo(PARAMS);

		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/vid-2.mp4",
			expect.anything(),
			"video/quicktime",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
	});

	it("answers failed (never throws) when generation blows up", async () => {
		vi.mocked(generateVideo).mockRejectedValue(new Error("gateway exploded"));

		const result = await generateBuildVideo(PARAMS);

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
		mockGeneratedVideo();
		vi.mocked(putSiteFile).mockRejectedValue(new Error("R2 said no"));

		const result = await generateBuildVideo(PARAMS);

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			model: "klingai/kling-v2.6-i2v",
			providerMetadata: { gateway: { generationId: "generation_1" } },
			providerUnits: 1,
			status: "failed",
		});
		if (result.status !== "failed") throw new Error("expected failed result");
		expect(result.message).not.toContain("R2 said no");
	});

	it("classifies a gateway 529 as provider capacity", async () => {
		vi.mocked(generateVideo).mockRejectedValueOnce(
			new GatewayInternalServerError({ statusCode: 529 }),
		);

		const result = await generateBuildVideo(PARAMS);

		expect(result).toMatchObject({
			failure: {
				kind: "capacity",
				provider: "klingai",
				source: "provider:klingai",
			},
			message:
				"Kling is over capacity right now. Please try again in a minute.",
			status: "failed",
		});
	});

	it("classifies the combined budget signal before a wrapped gateway timeout", async () => {
		const controller = new AbortController();
		controller.abort(new DOMException("budget elapsed", "TimeoutError"));
		vi.mocked(generateVideo).mockRejectedValueOnce(
			new GatewayResponseError({
				cause: new DOMException("timed out", "TimeoutError"),
				response: {},
				statusCode: 500,
			}),
		);

		const result = await generateBuildVideo({
			...PARAMS,
			abortSignal: controller.signal,
		});

		expect(result).toMatchObject({
			failure: { kind: "timeout", source: "ours" },
			message:
				"This took longer than we allow, so we stopped it. Please try again.",
			status: "failed",
		});
	});

	it("enables Kling voice control and native audio for talking people", async () => {
		mockGeneratedVideo();

		await generateBuildVideo({
			...PARAMS,
			modelId: "klingai/kling-v3.0-i2v",
			voiceControl: true,
		});

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				generateAudio: true,
				providerOptions: expect.objectContaining({
					klingai: { mode: "std", voice_control: true },
				}),
			}),
		);
	});
});

describe("generateTextToVideo", () => {
	it("uses the explicit model parameter and disables SDK retries", async () => {
		mockGeneratedVideo();

		const result = await generateTextToVideo({
			...TEXT_PARAMS,
			modelId: "klingai/kling-v3.0-t2v",
		});

		expect(gateway.video).toHaveBeenCalledWith("klingai/kling-v3.0-t2v");
		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({ maxRetries: 0 }),
		);
		expect(result).toMatchObject({
			model: "klingai/kling-v3.0-t2v",
			status: "generated",
		});
	});

	it("enables Kling voice control and native audio for talking people", async () => {
		mockGeneratedVideo();

		await generateTextToVideo({
			...TEXT_PARAMS,
			modelId: "klingai/kling-v3.0-t2v",
			negativePrompt: "captions",
			voiceControl: true,
		});

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				generateAudio: true,
				providerOptions: expect.objectContaining({
					klingai: {
						mode: "std",
						negativePrompt: "captions",
						voice_control: true,
					},
				}),
			}),
		);
	});

	it("passes fifteen seconds through to a max renderer", async () => {
		mockGeneratedVideo();

		await generateTextToVideo({
			...TEXT_PARAMS,
			durationSeconds: 15,
			modelId: "klingai/kling-v3.0-t2v",
		});

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({ duration: 15 }),
		);
	});

	it("defensively clamps fifteen seconds on the standard renderer", async () => {
		mockGeneratedVideo();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		try {
			await generateTextToVideo({
				...TEXT_PARAMS,
				durationSeconds: 15,
			});

			expect(generateVideo).toHaveBeenCalledWith(
				expect.objectContaining({ duration: 10 }),
			);
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining("Clamping klingai/kling-v2.6-t2v"),
			);
		} finally {
			warn.mockRestore();
		}
	});

	it("answers unavailable when the AI Gateway key is unset", async () => {
		mockEnv.AI_GATEWAY_API_KEY = undefined;

		const result = await generateTextToVideo(TEXT_PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateVideo).not.toHaveBeenCalled();
	});
});

describe("videoCostEstimateInput", () => {
	it("returns null without a resolved renderer", () => {
		expect(
			videoCostEstimateInput({ durationSeconds: 5, modelId: null }),
		).toBeNull();
		expect(
			videoCostEstimateInput({ durationSeconds: 5, modelId: undefined }),
		).toBeNull();
	});

	it("describes the std, silent render the call sites submit", () => {
		expect(
			videoCostEstimateInput({
				durationSeconds: 5,
				modelId: "klingai/kling-v2.6-i2v",
			}),
		).toEqual({
			audio: false,
			durationSeconds: 5,
			kind: "video",
			mode: "std",
			modelId: "klingai/kling-v2.6-i2v",
		});
		// Unknown durations use the house five-second clip; audio follows
		// Kling voice control.
		expect(
			videoCostEstimateInput({
				audio: true,
				durationSeconds: null,
				modelId: "klingai/kling-v3.0-t2v",
			}),
		).toMatchObject({ audio: true, durationSeconds: 5 });
		expect(
			videoCostEstimateInput({
				durationSeconds: 15,
				modelId: "klingai/kling-v3.0-t2v",
			}),
		).toMatchObject({ durationSeconds: 15 });
	});

	it("keeps an edit's real source length and clamps the standard tier", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		try {
			expect(
				videoCostEstimateInput({
					durationSeconds: 7,
					modelId: "bytedance/seedance-2.5",
				}),
			).toMatchObject({ durationSeconds: 7 });
			expect(
				videoCostEstimateInput({
					durationSeconds: 15,
					modelId: "klingai/kling-v2.6-t2v",
				}),
			).toMatchObject({ durationSeconds: 10 });
		} finally {
			warn.mockRestore();
		}
	});

	it("clamps the duration onto Veo's legal clip lengths", () => {
		expect(
			videoCostEstimateInput({
				durationSeconds: 5,
				modelId: "google/veo-3.1-generate-001",
			}),
		).toMatchObject({ durationSeconds: 6 });
		expect(
			videoCostEstimateInput({
				durationSeconds: 10,
				modelId: "google/veo-3.1-generate-001",
			}),
		).toMatchObject({ durationSeconds: 8 });
	});
});
