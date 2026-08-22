import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectBytes,
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isUserUploadUrl,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { prepareVideoSourceImage } from "./prepare-video-source-image";

const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: "https://assets.example.com/public",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("../../../../infrastructure/storage/r2", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("../../../../infrastructure/storage/r2")
		>();

	return {
		...original,
		getObjectBytes: vi.fn(),
		putSiteFile: vi.fn(),
	};
});

const KLING_MODEL = "klingai/kling-v2.1-i2v";
const KLING_SPEC_FINGERPRINT = "f50714c0";
const DEFAULT_SPEC_FINGERPRINT = "2a419008";
const UPLOAD_URL =
	"https://assets.example.com/public/uploads/user_1/upload_1/product.photo.webp";

beforeEach(() => {
	vi.mocked(getObjectBytes).mockReset();
	vi.mocked(putSiteFile).mockReset().mockResolvedValue(undefined);
});

describe("prepareVideoSourceImage", () => {
	it("rejects an unresolvable or missing storage object", async () => {
		await expect(
			prepareVideoSourceImage({
				modelId: KLING_MODEL,
				sourceUrl: "https://other.example.com/photo.jpg",
			}),
		).resolves.toEqual({
			reasonCode: "unreadable",
			status: "rejected",
			userMessage:
				"We could not read this image from storage. Please re-upload it.",
		});
		expect(getObjectBytes).not.toHaveBeenCalled();

		vi.mocked(getObjectBytes).mockResolvedValueOnce(null);
		await expect(
			prepareVideoSourceImage({
				modelId: KLING_MODEL,
				sourceUrl: UPLOAD_URL,
			}),
		).resolves.toMatchObject({ reasonCode: "unreadable", status: "rejected" });
	});

	it("rejects bytes Sharp cannot parse", async () => {
		vi.mocked(getObjectBytes).mockResolvedValue(
			new TextEncoder().encode("not an image"),
		);

		await expect(
			prepareVideoSourceImage({
				modelId: KLING_MODEL,
				sourceUrl: UPLOAD_URL,
			}),
		).resolves.toMatchObject({ reasonCode: "unreadable", status: "rejected" });
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("propagates a transient source-object read failure", async () => {
		const storageError = new Error("R2 read timed out");
		vi.mocked(getObjectBytes).mockRejectedValue(storageError);

		await expect(
			prepareVideoSourceImage({
				modelId: KLING_MODEL,
				sourceUrl: UPLOAD_URL,
			}),
		).rejects.toBe(storageError);
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("passes through an eligible image and reports post-orientation axes", async () => {
		const orientedJpeg = await sharp({
			create: {
				background: { b: 30, g: 20, r: 10 },
				channels: 3,
				height: 300,
				width: 400,
			},
		})
			.jpeg()
			.withMetadata({ orientation: 6 })
			.toBuffer();
		vi.mocked(getObjectBytes).mockResolvedValue(orientedJpeg);

		await expect(
			prepareVideoSourceImage({
				modelId: KLING_MODEL,
				sourceUrl: UPLOAD_URL,
				userId: "user_1",
			}),
		).resolves.toEqual({
			height: 400,
			mediaType: "image/jpeg",
			repaired: false,
			status: "ready",
			url: UPLOAD_URL,
			width: 300,
		});
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("converts, pads, and upscales beside the original upload key", async () => {
		const webp = await solidImage(200, 600, "webp");
		vi.mocked(getObjectBytes).mockResolvedValue(webp);

		const result = await prepareVideoSourceImage({
			modelId: KLING_MODEL,
			sourceUrl: UPLOAD_URL,
			userId: "user_1",
		});

		expect(result).toEqual({
			height: 750,
			mediaType: "image/jpeg",
			repaired: true,
			status: "ready",
			url: `https://assets.example.com/public/uploads/user_1/upload_1/product.photo.video-src-${KLING_SPEC_FINGERPRINT}.jpg`,
			width: 300,
		});
		expect(
			isUserUploadUrl(result.status === "ready" ? result.url : "", "user_1"),
		).toBe(true);
		expect(putSiteFile).toHaveBeenCalledWith(
			`uploads/user_1/upload_1/product.photo.video-src-${KLING_SPEC_FINGERPRINT}.jpg`,
			expect.any(Uint8Array),
			"image/jpeg",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		expect(vi.mocked(putSiteFile).mock.calls[0]?.[0].split("/")).toHaveLength(
			4,
		);

		const stored = vi.mocked(putSiteFile).mock.calls[0]?.[1] as Uint8Array;
		const metadata = await sharp(stored).metadata();
		expect(metadata).toMatchObject({ format: "jpeg", height: 750, width: 300 });
		const corner = await sharp(stored)
			.extract({ height: 1, left: 0, top: 0, width: 1 })
			.raw()
			.toBuffer();
		expect([...corner].slice(0, 3)).toEqual([
			expect.closeTo(90, -1),
			expect.closeTo(60, -1),
			expect.closeTo(30, -1),
		]);
	});

	it("uses PNG when a repaired source has alpha", async () => {
		const webp = await solidImage(400, 400, "webp", true);
		vi.mocked(getObjectBytes).mockResolvedValue(webp);

		const result = await prepareVideoSourceImage({
			modelId: KLING_MODEL,
			sourceUrl: UPLOAD_URL,
			userId: "user_1",
		});

		expect(result).toMatchObject({
			mediaType: "image/png",
			repaired: true,
			status: "ready",
			url: `https://assets.example.com/public/uploads/user_1/upload_1/product.photo.video-src-${KLING_SPEC_FINGERPRINT}.png`,
		});
		const stored = vi.mocked(putSiteFile).mock.calls[0]?.[1] as Uint8Array;
		expect(await sharp(stored).metadata()).toMatchObject({
			format: "png",
			hasAlpha: true,
		});
	});

	it.each([
		{
			expectedFingerprint: KLING_SPEC_FINGERPRINT,
			expectedMediaType: "image/png",
			expectedSuffix: "png",
			format: "png" as const,
			modelId: KLING_MODEL,
		},
		{
			expectedFingerprint: DEFAULT_SPEC_FINGERPRINT,
			expectedMediaType: "image/webp",
			expectedSuffix: "webp",
			format: "webp" as const,
			modelId: "future-provider/video-v1",
		},
	])("preserves accepted $expectedMediaType while applying an unrelated resize", async ({
		expectedFingerprint,
		expectedMediaType,
		expectedSuffix,
		format,
		modelId,
	}) => {
		vi.mocked(getObjectBytes).mockResolvedValue(
			await solidImage(32, 80, format),
		);

		const result = await prepareVideoSourceImage({
			modelId,
			sourceUrl: UPLOAD_URL,
			userId: "user_1",
		});

		expect(result).toMatchObject({
			mediaType: expectedMediaType,
			repaired: true,
			status: "ready",
			url: `https://assets.example.com/public/uploads/user_1/upload_1/product.photo.video-src-${expectedFingerprint}.${expectedSuffix}`,
		});
	});

	it("keeps a non-round source aspect without cropping during pad and upscale", async () => {
		vi.mocked(getObjectBytes).mockResolvedValue(
			await solidImage(211, 603, "webp"),
		);

		const result = await prepareVideoSourceImage({
			modelId: KLING_MODEL,
			sourceUrl: UPLOAD_URL,
			userId: "user_1",
		});

		expect(result.status).toBe("ready");
		if (result.status !== "ready") {
			return;
		}

		expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(300);
		expect(result.width / result.height).toBeGreaterThanOrEqual(1 / 2.5);
		expect(result.width / result.height).toBeLessThanOrEqual(2.5);
		const stored = vi.mocked(putSiteFile).mock.calls[0]?.[1] as Uint8Array;
		const metadata = await sharp(stored).metadata();
		expect(metadata.width).toBe(result.width);
		expect(metadata.height).toBe(result.height);
	});

	it("keeps rounding-boundary repairs inside the minimum and aspect limits", async () => {
		vi.mocked(getObjectBytes).mockResolvedValue(
			await solidImage(55, 18, "webp"),
		);

		const result = await prepareVideoSourceImage({
			modelId: KLING_MODEL,
			sourceUrl: UPLOAD_URL,
			userId: "user_1",
		});

		expect(result.status).toBe("ready");
		if (result.status !== "ready") {
			return;
		}

		expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(300);
		expect(result.width / result.height).toBeLessThanOrEqual(2.5);
		expect(result.width / result.height).toBeGreaterThanOrEqual(1 / 2.5);
	});

	it("revalidates aspect rounding after the 2048 px recompression fallback", async () => {
		const noisyJpeg = await sharp(randomBytes(7000 * 2800 * 3), {
			raw: { channels: 3, height: 2800, width: 7000 },
		})
			.jpeg({ quality: 90 })
			.toBuffer();
		expect(noisyJpeg.byteLength).toBeGreaterThan(10 * 1024 * 1024);
		expect(noisyJpeg.byteLength).toBeLessThanOrEqual(25 * 1024 * 1024);
		vi.mocked(getObjectBytes).mockResolvedValue(noisyJpeg);

		const result = await prepareVideoSourceImage({
			modelId: KLING_MODEL,
			sourceUrl: UPLOAD_URL,
			userId: "user_1",
		});

		expect(result.status).toBe("ready");
		if (result.status !== "ready") {
			return;
		}

		expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(2048);
		expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(300);
		expect(result.width / result.height).toBeLessThanOrEqual(2.5);
		expect(result.width / result.height).toBeGreaterThanOrEqual(1 / 2.5);
	});

	it("recompresses an over-limit opaque PNG as JPEG below 2048 px", async () => {
		const noisyPng = await sharp(randomBytes(1900 * 1900 * 3), {
			raw: { channels: 3, height: 1900, width: 1900 },
		})
			.png({ compressionLevel: 0 })
			.toBuffer();
		expect(noisyPng.byteLength).toBeGreaterThan(10 * 1024 * 1024);
		vi.mocked(getObjectBytes).mockResolvedValue(noisyPng);

		const result = await prepareVideoSourceImage({
			modelId: KLING_MODEL,
			sourceUrl: UPLOAD_URL,
			userId: "user_1",
		});

		expect(result).toMatchObject({
			height: 1900,
			mediaType: "image/jpeg",
			repaired: true,
			status: "ready",
			width: 1900,
		});
		const stored = vi.mocked(putSiteFile).mock.calls[0]?.[1] as Uint8Array;
		expect(stored.byteLength).toBeLessThanOrEqual(10 * 1024 * 1024);
		expect(await sharp(stored).metadata()).toMatchObject({ format: "jpeg" });
	});

	it("places builder repairs beside a non-upload source", async () => {
		vi.mocked(getObjectBytes).mockResolvedValue(
			await solidImage(200, 600, "webp"),
		);
		const sourceUrl =
			"https://assets.example.com/public/images/project_1/attempt_1/img-1.webp";

		await expect(
			prepareVideoSourceImage({ modelId: KLING_MODEL, sourceUrl }),
		).resolves.toMatchObject({
			status: "ready",
			url: `https://assets.example.com/public/images/project_1/attempt_1/img-1.video-src-${KLING_SPEC_FINGERPRINT}.jpg`,
		});
	});

	it("propagates a transient repaired-object write failure", async () => {
		vi.mocked(getObjectBytes).mockResolvedValue(
			await solidImage(200, 600, "webp"),
		);
		const storageError = new Error("R2 write timed out");
		vi.mocked(putSiteFile).mockRejectedValue(storageError);

		await expect(
			prepareVideoSourceImage({
				modelId: KLING_MODEL,
				sourceUrl: UPLOAD_URL,
				userId: "user_1",
			}),
		).rejects.toBe(storageError);
	});

	it("rejects an extreme aspect with measured, model-specific copy", async () => {
		vi.mocked(getObjectBytes).mockResolvedValue(
			await solidImage(8192, 512, "png"),
		);

		await expect(
			prepareVideoSourceImage({
				modelId: KLING_MODEL,
				sourceUrl: UPLOAD_URL,
			}),
		).resolves.toEqual({
			reasonCode: "aspect_extreme",
			status: "rejected",
			userMessage:
				"This image is 8192×512 px (16:1). The video model accepts shapes between 1:2.5 and 2.5:1. Please send a less stretched image.",
		});
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("rejects a mismatched upload owner rather than moving the repair", async () => {
		vi.mocked(getObjectBytes).mockResolvedValue(
			await solidImage(400, 400, "webp"),
		);

		await expect(
			prepareVideoSourceImage({
				modelId: KLING_MODEL,
				sourceUrl: UPLOAD_URL,
				userId: "user_2",
			}),
		).resolves.toMatchObject({ reasonCode: "unreadable", status: "rejected" });
		expect(putSiteFile).not.toHaveBeenCalled();
	});
});

async function solidImage(
	width: number,
	height: number,
	format: "png" | "webp",
	hasAlpha = false,
): Promise<Buffer> {
	const pipeline = sharp({
		create: {
			background: { alpha: hasAlpha ? 0.5 : 1, b: 30, g: 60, r: 90 },
			channels: hasAlpha ? 4 : 3,
			height,
			width,
		},
	});

	return format === "png"
		? pipeline.png().toBuffer()
		: pipeline.webp().toBuffer();
}
