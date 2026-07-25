import { generateImage, generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	isR2Configured,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import {
	editImageFromSources,
	generateStandaloneImage,
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

vi.mock("ai", () => ({
	generateImage: vi.fn(),
	generateText: vi.fn(),
}));

vi.mock("../../../../infrastructure/storage/r2", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("../../../../infrastructure/storage/r2")
		>();

	return { ...original, isR2Configured: vi.fn(), putSiteFile: vi.fn() };
});

const PARAMS = {
	aspect: "1:1" as const,
	attemptId: "attempt_1",
	index: 1,
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
	} as unknown as Awaited<ReturnType<typeof generateImage>>);
}

function mockEditedImage(mediaType = "image/png") {
	vi.mocked(generateText).mockResolvedValue({
		files: [
			{ mediaType: "text/plain", uint8Array: new Uint8Array([0]) },
			{ mediaType, uint8Array: new Uint8Array([7, 7]) },
		],
	} as unknown as Awaited<ReturnType<typeof generateText>>);
}

beforeEach(() => {
	vi.mocked(generateImage).mockReset();
	vi.mocked(generateText).mockReset();
	vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
	vi.mocked(putSiteFile).mockReset().mockResolvedValue(undefined);
	mockEnv.AI_IMAGE_MODEL = "openai/gpt-image-2";
	mockEnv.AI_IMAGE_EDIT_MODEL = "google/gemini-2.5-flash-image";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
});

describe("generateStandaloneImage", () => {
	it("answers unavailable when AI_IMAGE_MODEL is unset", async () => {
		mockEnv.AI_IMAGE_MODEL = undefined;

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({ status: "unavailable" });
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
		);
		expect(result).toEqual({
			mediaType: "image/webp",
			status: "generated",
			url: "https://assets.example.com/images/project_1/attempt_1/img-1.webp",
		});
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

	it("turns provider throws into failed results", async () => {
		vi.mocked(generateImage).mockRejectedValue(new Error("quota"));

		const result = await generateStandaloneImage(PARAMS);

		expect(result).toMatchObject({ message: "quota", status: "failed" });
	});
});

describe("editImageFromSources", () => {
	const EDIT_PARAMS = {
		aspect: "4:5",
		prompt: "restage on a marble bench",
		sourceImageUrls: [
			"https://assets.example.com/uploads/u1/a/photo-1.jpg",
			"https://assets.example.com/uploads/u1/b/photo-2.png",
		],
	};

	it("fails when AI_IMAGE_EDIT_MODEL is unset", async () => {
		mockEnv.AI_IMAGE_EDIT_MODEL = undefined;

		const result = await editImageFromSources(EDIT_PARAMS);

		expect(result).toMatchObject({ status: "failed" });
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
			message: expect.stringContaining("no image"),
			status: "failed",
		});
	});
});
