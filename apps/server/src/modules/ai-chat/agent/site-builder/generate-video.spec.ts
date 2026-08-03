import { gateway } from "@ai-sdk/gateway";
import { experimental_generateVideo as generateVideo } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	isR2Configured,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { generateBuildVideo } from "./generate-video";

// Env is a mutable stub so each test controls exactly which keys exist; the
// real r2 key/url helpers stay in place (they are what the URL test proves),
// while everything with credentials or network is mocked.
const mockEnv = vi.hoisted(() => ({
	AI_VIDEO_MODEL: undefined as string | undefined,
	R2_PUBLIC_BASE_URL: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", () => ({ experimental_generateVideo: vi.fn() }));

vi.mock("@ai-sdk/gateway", () => ({
	gateway: { video: vi.fn(() => ({ modelId: "mock-video-model" })) },
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
	imageUrl:
		"https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png",
	index: 2,
	metering: { operation: "video" as const, userId: "user_1" },
	motionPrompt: "steam drifts slowly off the tagine, warm light breathes",
	projectId: "project_1",
};

function mockGeneratedVideo(mediaType = "video/mp4") {
	vi.mocked(generateVideo).mockResolvedValue({
		video: {
			mediaType,
			uint8Array: new Uint8Array([9, 9, 9]),
		},
		providerMetadata: { gateway: { generationId: "generation_1" } },
	} as unknown as Awaited<ReturnType<typeof generateVideo>>);
}

beforeEach(() => {
	vi.mocked(generateVideo).mockReset();
	vi.mocked(gateway.video).mockClear();
	vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
	vi.mocked(putSiteFile).mockReset().mockResolvedValue(undefined);
	mockEnv.AI_VIDEO_MODEL = "klingai/kling-v2.6-i2v";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
});

describe("generateBuildVideo", () => {
	it("answers unavailable when AI_VIDEO_MODEL is unset", async () => {
		mockEnv.AI_VIDEO_MODEL = undefined;

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
				n: 1,
				prompt: {
					image: PARAMS.imageUrl,
					text: expect.stringContaining(PARAMS.motionPrompt),
				},
				providerOptions: {
					gateway: {
						quotaEntityId: "user_1",
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
		);
		expect(result).toEqual({
			mediaType: "video/mp4",
			model: "klingai/kling-v2.6-i2v",
			providerMetadata: { gateway: { generationId: "generation_1" } },
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/vid-2.mp4",
		});
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
		mockEnv.AI_VIDEO_MODEL = "google/veo-test";
		mockGeneratedVideo();

		await generateBuildVideo({
			...PARAMS,
			profile: "image-animation",
		});

		expect(gateway.video).toHaveBeenCalledWith("google/veo-test");
		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				providerOptions: {
					gateway: {
						quotaEntityId: "user_1",
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
		);
	});

	it("defaults the extension to mp4 for unknown media types", async () => {
		mockGeneratedVideo("video/quicktime");

		await generateBuildVideo(PARAMS);

		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/vid-2.mp4",
			expect.anything(),
			"video/quicktime",
		);
	});

	it("answers failed (never throws) when generation blows up", async () => {
		vi.mocked(generateVideo).mockRejectedValue(new Error("gateway exploded"));

		const result = await generateBuildVideo(PARAMS);

		expect(result).toEqual({ message: "gateway exploded", status: "failed" });
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("answers failed (never throws) when the upload blows up", async () => {
		mockGeneratedVideo();
		vi.mocked(putSiteFile).mockRejectedValue(new Error("R2 said no"));

		const result = await generateBuildVideo(PARAMS);

		expect(result).toEqual({
			message: "R2 said no",
			model: "klingai/kling-v2.6-i2v",
			providerMetadata: { gateway: { generationId: "generation_1" } },
			providerUnits: 1,
			status: "failed",
		});
	});
});
