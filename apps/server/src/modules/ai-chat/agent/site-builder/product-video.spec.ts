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
import { VIDEO_PRODUCT_ENGINE_MODEL } from "../../../media-generations/domain/video-quality-models";
import { productVideo } from "./product-video";

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
	gateway: { video: vi.fn(() => ({ modelId: "seedance-product" })) },
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
		providerMetadata: { gateway: { generationId: "product_generation_1" } },
		video: {
			mediaType: "video/mp4",
			uint8Array: new Uint8Array([7, 2]),
		},
		warnings: [],
	} as unknown as Awaited<ReturnType<typeof generateVideo>>);
});

describe("productVideo provider adapter", () => {
	it("uses the exact Seedance inputReference recipe and captures before publishing", async () => {
		const directory = await mkdtemp(join(tmpdir(), "product-video-adapter-"));
		const outputPath = join(directory, "output.mp4");
		const onProviderGeneration = vi.fn();
		const onPublishing = vi.fn();

		try {
			const result = await productVideo({
				attemptId: "attempt_1",
				imageUrl: "https://assets.example.com/product.png",
				mediaType: "image/png",
				metering: { operation: "video", userId: "user_1" },
				onProviderGeneration,
				onPublishing,
				outputPath,
				projectId: "project_1",
				prompt: "A deterministic studio orbit.",
			});

			expect(gateway.video).toHaveBeenCalledWith(VIDEO_PRODUCT_ENGINE_MODEL);
			expect(generateVideo).toHaveBeenCalledWith({
				abortSignal: expect.any(AbortSignal),
				aspectRatio: "adaptive",
				duration: 5,
				inputReferences: [
					{
						data: "https://assets.example.com/product.png",
						mediaType: "image/png",
					},
				],
				maxRetries: 0,
				model: { modelId: "seedance-product" },
				n: 1,
				prompt: "A deterministic studio orbit.",
				providerOptions: {
					gateway: {
						tags: ["op:video", "ws:personal"],
						user: "user_1",
					},
				},
			});
			expect(onProviderGeneration).toHaveBeenCalledWith({
				model: VIDEO_PRODUCT_ENGINE_MODEL,
				providerMetadata: {
					gateway: { generationId: "product_generation_1" },
				},
			});
			expect(onProviderGeneration.mock.invocationCallOrder[0]).toBeLessThan(
				onPublishing.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
			);
			expect(onProviderGeneration.mock.invocationCallOrder[0]).toBeLessThan(
				vi.mocked(putSiteFile).mock.invocationCallOrder[0] ??
					Number.MAX_SAFE_INTEGER,
			);
			expect(putSiteFile).toHaveBeenCalledWith(
				"sites/project_1/assets/attempt_1/vid-1.mp4",
				new Uint8Array([7, 2]),
				"video/mp4",
				IMMUTABLE_ASSET_CACHE_CONTROL,
			);
			expect(await readFile(outputPath)).toEqual(Buffer.from([7, 2]));
			expect(result).toMatchObject({
				mediaType: "video/mp4",
				status: "generated",
			});
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it.each([
		"http://assets.example.com/product.png",
		"https://user:secret@assets.example.com/product.png",
		"not a URL",
	])("rejects non-public HTTPS source %s before the provider", async (imageUrl) => {
		const result = await productVideo({
			attemptId: "attempt_1",
			imageUrl,
			mediaType: "image/png",
			metering: { operation: "video", userId: "user_1" },
			outputPath: join(tmpdir(), "unused-product-video-output"),
			projectId: "project_1",
			prompt: "A deterministic studio orbit.",
		});

		expect(result).toMatchObject({ status: "failed" });
		expect(generateVideo).not.toHaveBeenCalled();
	});

	it("returns a normalized safe failure when the provider call throws", async () => {
		vi.mocked(generateVideo).mockRejectedValueOnce(
			new Error("raw Seedance product response"),
		);

		const result = await productVideo({
			attemptId: "attempt_1",
			imageUrl: "https://assets.example.com/product.png",
			mediaType: "image/png",
			metering: { operation: "video", userId: "user_1" },
			outputPath: join(tmpdir(), "unused-product-video-output"),
			projectId: "project_1",
			prompt: "A deterministic studio orbit.",
		});

		expect(result).toMatchObject({
			failure: { kind: "internal", source: "ours" },
			message: "Something went wrong on our side. Please try again.",
			status: "failed",
		});
		if (result.status !== "failed") throw new Error("expected failed result");
		expect(result.message).not.toContain("raw Seedance product response");
	});
});
