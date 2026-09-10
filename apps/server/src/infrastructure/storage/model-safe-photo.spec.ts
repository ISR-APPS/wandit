import { randomBytes } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
	isModelSafeImage,
	loadModelSafePhoto,
	MAX_MODEL_IMAGE_BYTES,
	MAX_MODEL_IMAGE_SIDE_PX,
} from "./model-safe-photo";

const PHOTO_URL =
	"https://assets.example.com/public/uploads/user_1/upload_1/photo.png";
const PHOTO_KEY = "uploads/user_1/upload_1/photo.png";

// The resolver accepts only the fixture URL, as the production origin guard does.
function resolveFixtureAssetKey(url: string): string | null {
	return url === PHOTO_URL ? PHOTO_KEY : null;
}

function solidPng(width: number, height: number): Promise<Buffer> {
	return sharp({
		create: {
			background: { b: 200, g: 120, r: 30 },
			channels: 3,
			height,
			width,
		},
	})
		.png()
		.toBuffer();
}

describe("isModelSafeImage", () => {
	it("applies the OpenAI, Anthropic, and Vertex limits inclusively", () => {
		expect(
			isModelSafeImage({
				byteLength: MAX_MODEL_IMAGE_BYTES,
				height: 4800,
				width: 6400,
			}),
		).toBe(true);
		expect(isModelSafeImage({ byteLength: 1, height: 4800, width: 6432 })).toBe(
			false,
		);
		expect(
			isModelSafeImage({
				byteLength: 1,
				height: 1,
				width: MAX_MODEL_IMAGE_SIDE_PX + 1,
			}),
		).toBe(false);
		expect(
			isModelSafeImage({
				byteLength: MAX_MODEL_IMAGE_BYTES + 1,
				height: 1,
				width: 1,
			}),
		).toBe(false);
	});
});

describe("loadModelSafePhoto", () => {
	it("keeps a safe stored photo as a URL", async () => {
		const bytes = await solidPng(64, 48);
		const getObjectBytes = vi.fn(() => Promise.resolve(bytes));

		const result = await loadModelSafePhoto(PHOTO_URL, {
			getObjectBytes,
			publicAssetKeyFromUrl: resolveFixtureAssetKey,
		});

		expect(result).toEqual({ kind: "url", url: PHOTO_URL });
		expect(getObjectBytes).toHaveBeenCalledWith(
			"uploads/user_1/upload_1/photo.png",
		);
	});

	it("returns optimized bytes for a photo above the OpenAI patch limit", async () => {
		const bytes = await solidPng(6432, 4800);

		const result = await loadModelSafePhoto(PHOTO_URL, {
			getObjectBytes: () => Promise.resolve(bytes),
			publicAssetKeyFromUrl: resolveFixtureAssetKey,
		});

		if (result.kind !== "bytes") {
			throw new Error(`Expected bytes, received ${result.kind}`);
		}

		const metadata = await sharp(result.bytes).metadata();

		if (metadata.width === undefined || metadata.height === undefined) {
			throw new Error("Expected optimized image dimensions");
		}

		expect(result.mediaType).toBe("image/webp");
		expect(metadata.width).toBe(1920);
		expect(
			isModelSafeImage({
				byteLength: result.bytes.byteLength,
				height: metadata.height,
				width: metadata.width,
			}),
		).toBe(true);
	});

	it("reports a missing object as unusable", async () => {
		const result = await loadModelSafePhoto(PHOTO_URL, {
			getObjectBytes: () => Promise.resolve(null),
			publicAssetKeyFromUrl: resolveFixtureAssetKey,
		});

		expect(result).toEqual({
			kind: "unusable",
			reason: "object missing",
			url: PHOTO_URL,
		});
	});

	it("times out a stuck object read after 30 seconds", async () => {
		vi.useFakeTimers();

		try {
			const resultPromise = loadModelSafePhoto(PHOTO_URL, {
				getObjectBytes: () => new Promise<Uint8Array | null>(() => undefined),
				publicAssetKeyFromUrl: resolveFixtureAssetKey,
			});

			// The production timer rejects the read after 30 seconds.
			await vi.advanceTimersByTimeAsync(30_000);
			await expect(resultPromise).resolves.toEqual({
				kind: "unusable",
				reason: "object read timed out after 30 s",
				url: PHOTO_URL,
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("reports a photo that remains unsafe after processing", async () => {
		// Two short frames keep the fixture small while its width exceeds the provider limit.
		const bytes = await sharp(
			randomBytes((MAX_MODEL_IMAGE_SIDE_PX + 1) * 2 * 3),
			{
				raw: {
					channels: 3,
					height: 2,
					pageHeight: 1,
					width: MAX_MODEL_IMAGE_SIDE_PX + 1,
				},
			},
		)
			.webp({ effort: 0, lossless: true })
			.toBuffer();

		const result = await loadModelSafePhoto(PHOTO_URL, {
			getObjectBytes: () => Promise.resolve(bytes),
			publicAssetKeyFromUrl: resolveFixtureAssetKey,
		});

		expect(result).toEqual({
			kind: "unusable",
			reason: "image exceeds model limits after processing",
			url: PHOTO_URL,
		});
	});

	it("rejects a URL outside the Wandit asset origin", async () => {
		const getObjectBytes = vi.fn(() => Promise.resolve(null));
		const url = "https://attacker.example/photo.png";

		const result = await loadModelSafePhoto(url, {
			getObjectBytes,
			publicAssetKeyFromUrl: resolveFixtureAssetKey,
		});

		expect(result).toEqual({
			kind: "unusable",
			reason: "not a Wandit asset URL",
			url,
		});
		expect(getObjectBytes).not.toHaveBeenCalled();
	});

	it("keeps the storage error message in an unusable result", async () => {
		const result = await loadModelSafePhoto(PHOTO_URL, {
			getObjectBytes: () => Promise.reject(new Error("R2 unavailable")),
			publicAssetKeyFromUrl: resolveFixtureAssetKey,
		});

		expect(result).toEqual({
			kind: "unusable",
			reason: "R2 unavailable",
			url: PHOTO_URL,
		});
	});
});
