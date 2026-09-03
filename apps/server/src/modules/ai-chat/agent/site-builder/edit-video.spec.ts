import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { gateway } from "@ai-sdk/gateway";
import { experimental_generateVideo as generateVideo } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isR2Configured,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { editVideo } from "./edit-video";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test" as string | undefined,
	R2_PUBLIC_BASE_URL: "https://assets.example.com" as string | undefined,
	TRIGGER_SECRET_KEY: "tr_test" as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));
vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	experimental_generateVideo: vi.fn(),
}));
vi.mock("@ai-sdk/gateway", async (importOriginal) => ({
	...(await importOriginal<typeof import("@ai-sdk/gateway")>()),
	gateway: { video: vi.fn(() => ({ modelId: "seedance-edit" })) },
}));
vi.mock("../../../../infrastructure/storage/r2", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("../../../../infrastructure/storage/r2")
		>();
	return {
		...original,
		isR2Configured: vi.fn(),
		putSiteFile: vi.fn(),
	};
});

beforeEach(() => {
	vi.clearAllMocks();
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
	mockEnv.TRIGGER_SECRET_KEY = "tr_test";
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(putSiteFile).mockResolvedValue(undefined);
	vi.mocked(generateVideo).mockResolvedValue({
		providerMetadata: { gateway: { generationId: "edit_generation_1" } },
		video: {
			mediaType: "video/mp4",
			uint8Array: new Uint8Array([4, 2]),
		},
		warnings: [],
	} as unknown as Awaited<ReturnType<typeof generateVideo>>);
});

describe("editVideo provider adapter", () => {
	it("uses the verified Seedance edit recipe and captures evidence before upload", async () => {
		const directory = await mkdtemp(join(tmpdir(), "edit-video-adapter-"));
		const outputPath = join(directory, "output.mp4");
		const onProviderGeneration = vi.fn();

		try {
			const result = await editVideo({
				attemptId: "attempt_1",
				metering: { operation: "video", userId: "user_1" },
				modelId: "bytedance/seedance-2.5",
				onProviderGeneration,
				outputPath,
				projectId: "project_1",
				prompt: "Surgical edit of [Video 1]: make the coat green.",
				sourceDurationSeconds: 12.4,
				sourceVideoUrl: "https://assets.example.com/source.mp4",
			});

			expect(gateway.video).toHaveBeenCalledWith("bytedance/seedance-2.5");
			expect(generateVideo).toHaveBeenCalledWith(
				expect.objectContaining({
					aspectRatio: "adaptive",
					duration: -1,
					inputReferences: [
						{
							data: "https://assets.example.com/source.mp4",
							mediaType: "video/mp4",
						},
					],
					maxRetries: 0,
					n: 1,
					providerOptions: {
						gateway: {
							tags: ["op:video", "ws:personal"],
							user: "user_1",
						},
					},
				}),
			);
			expect(onProviderGeneration).toHaveBeenCalledWith(
				expect.objectContaining({
					providerMetadata: {
						gateway: { generationId: "edit_generation_1" },
					},
				}),
			);
			expect(onProviderGeneration.mock.invocationCallOrder[0]).toBeLessThan(
				vi.mocked(putSiteFile).mock.invocationCallOrder[0] ??
					Number.MAX_SAFE_INTEGER,
			);
			expect(putSiteFile).toHaveBeenCalledWith(
				"sites/project_1/assets/attempt_1/vid-1.mp4",
				new Uint8Array([4, 2]),
				"video/mp4",
				IMMUTABLE_ASSET_CACHE_CONTROL,
			);
			expect(await readFile(outputPath)).toEqual(Buffer.from([4, 2]));
			expect(result).toMatchObject({
				mediaType: "video/mp4",
				status: "generated",
			});
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it("rejects a non-HTTPS source before calling the provider", async () => {
		const result = await editVideo({
			attemptId: "attempt_1",
			metering: { operation: "video", userId: "user_1" },
			modelId: "bytedance/seedance-2.5",
			outputPath: join(tmpdir(), "unused-edit-output"),
			projectId: "project_1",
			prompt: "Surgical edit",
			sourceDurationSeconds: 5,
			sourceVideoUrl: "http://assets.example.com/source.mp4",
		});

		expect(result).toMatchObject({ status: "failed" });
		expect(generateVideo).not.toHaveBeenCalled();
	});

	it("returns a normalized safe failure when the provider call throws", async () => {
		vi.mocked(generateVideo).mockRejectedValueOnce(
			new Error("raw Seedance response"),
		);

		const result = await editVideo({
			attemptId: "attempt_1",
			metering: { operation: "video", userId: "user_1" },
			modelId: "bytedance/seedance-2.5",
			outputPath: join(tmpdir(), "unused-edit-output"),
			projectId: "project_1",
			prompt: "Surgical edit",
			sourceDurationSeconds: 5,
			sourceVideoUrl: "https://assets.example.com/source.mp4",
		});

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			status: "failed",
		});
		if (result.status !== "failed") throw new Error("expected failed result");
		expect(result.message).not.toContain("raw Seedance response");
	});
});
