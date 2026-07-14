import { generateImage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	isR2Configured,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { generateBuildImage } from "./generate-image";

// Env is a mutable stub so each test controls exactly which keys exist; the
// real r2 key/url helpers stay in place (they are what the URL test proves),
// while everything with credentials or network is mocked.
const mockEnv = vi.hoisted(() => ({
	AI_IMAGE_MODEL: undefined as string | undefined,
	R2_PUBLIC_BASE_URL: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", () => ({ generateImage: vi.fn() }));

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
	} as Awaited<ReturnType<typeof generateImage>>);
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
			prompt: PARAMS.prompt,
			size: "1536x1024",
		});
		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/img-2.png",
			new Uint8Array([1, 2, 3]),
			"image/png",
		);
		expect(result).toEqual({
			imageBase64: "aW1nLWJ5dGVz",
			mediaType: "image/png",
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-2.png",
		});
	});

	it("joins the public URL cleanly when the base has a trailing slash", async () => {
		mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com/";
		mockGeneratedImage();

		const result = await generateBuildImage(PARAMS);

		expect(result).toMatchObject({
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-2.png",
		});
	});

	it("derives the object extension from the returned media type", async () => {
		mockGeneratedImage("image/jpeg");

		await generateBuildImage(PARAMS);

		expect(putSiteFile).toHaveBeenCalledWith(
			"sites/project_1/assets/attempt_1/img-2.jpg",
			expect.anything(),
			"image/jpeg",
		);
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

		expect(result).toEqual({ message: "gateway exploded", status: "failed" });
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("answers failed (never throws) when the upload blows up", async () => {
		mockGeneratedImage();
		vi.mocked(putSiteFile).mockRejectedValue(new Error("R2 said no"));

		const result = await generateBuildImage(PARAMS);

		expect(result).toEqual({ message: "R2 said no", status: "failed" });
	});
});
