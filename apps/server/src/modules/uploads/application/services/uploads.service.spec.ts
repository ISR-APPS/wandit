import { randomBytes } from "node:crypto";

import {
	ServiceUnavailableException,
	UnsupportedMediaTypeException,
} from "@nestjs/common";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isR2Configured,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { sanitizeFilename, UploadsService } from "./uploads.service";

// Env is a mutable stub so each test controls exactly which keys exist; the
// real key/url helpers stay in place, credentials and network are mocked.
const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("../../../../infrastructure/storage/r2", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("../../../../infrastructure/storage/r2")
		>();

	return { ...original, isR2Configured: vi.fn(), putSiteFile: vi.fn() };
});

const PNG_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

// docx and xlsx are OOXML ZIP containers — both start with the PK signature.
const ZIP_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

const DOCX_MEDIA_TYPE =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MEDIA_TYPE =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function pngUpload() {
	return { buffer: PNG_BYTES, filename: "product.png", mimetype: "image/png" };
}

beforeEach(() => {
	vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
	vi.mocked(putSiteFile).mockReset().mockResolvedValue(undefined);
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
});

describe("UploadsService.uploadAttachment", () => {
	const service = new UploadsService();

	it("answers 503 STORAGE_UNAVAILABLE when R2 is unconfigured", async () => {
		vi.mocked(isR2Configured).mockReturnValue(false);

		await expect(
			service.uploadAttachment("user_1", pngUpload()),
		).rejects.toThrow(ServiceUnavailableException);
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("answers 503 when the public base URL is missing", async () => {
		mockEnv.R2_PUBLIC_BASE_URL = undefined;

		await expect(
			service.uploadAttachment("user_1", pngUpload()),
		).rejects.toThrow(ServiceUnavailableException);
	});

	it("rejects media types outside the allowlist with 415", async () => {
		await expect(
			service.uploadAttachment("user_1", {
				buffer: Buffer.from("<svg/>"),
				filename: "logo.svg",
				mimetype: "image/svg+xml",
			}),
		).rejects.toThrow(UnsupportedMediaTypeException);
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("rejects files whose bytes disagree with the declared type", async () => {
		await expect(
			service.uploadAttachment("user_1", {
				buffer: JPEG_BYTES,
				filename: "fake.png",
				mimetype: "image/png",
			}),
		).rejects.toThrow(UnsupportedMediaTypeException);
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("uploads a valid file under the user's prefix and answers the contract shape", async () => {
		const result = await service.uploadAttachment("user_1", pngUpload());

		expect(putSiteFile).toHaveBeenCalledWith(
			expect.stringMatching(/^uploads\/user_1\/[0-9a-f-]{36}\/product\.png$/),
			PNG_BYTES,
			"image/png",
			// uuid-addressed objects are never rewritten, so they may be cached
			// forever.
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		expect(result).toEqual({
			filename: "product.png",
			key: expect.stringMatching(/^uploads\/user_1\//),
			mediaType: "image/png",
			size: PNG_BYTES.length,
			url: expect.stringMatching(
				/^https:\/\/assets\.example\.com\/uploads\/user_1\//,
			),
		});
	});

	it("recompresses a heavy raster photo to webp, renaming key and type", async () => {
		// Noise defeats PNG compression, so the canvas lands well over the
		// optimizer's 150KB floor.
		const bigPng = await sharp(randomBytes(2500 * 300 * 3), {
			raw: { channels: 3, height: 300, width: 2500 },
		})
			.png()
			.toBuffer();

		const result = await service.uploadAttachment("user_1", {
			buffer: bigPng,
			filename: "hero-photo.png",
			mimetype: "image/png",
		});

		expect(putSiteFile).toHaveBeenCalledWith(
			expect.stringMatching(
				/^uploads\/user_1\/[0-9a-f-]{36}\/hero-photo\.webp$/,
			),
			expect.any(Uint8Array),
			"image/webp",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);

		const uploaded = vi.mocked(putSiteFile).mock.calls[0]?.[1] as Uint8Array;
		const metadata = await sharp(uploaded).metadata();
		expect(metadata.format).toBe("webp");
		expect(metadata.width).toBe(1920);

		expect(result).toMatchObject({
			filename: "hero-photo.webp",
			height: 230,
			mediaType: "image/webp",
			size: uploaded.byteLength,
			width: 1920,
		});
	});

	it("recompresses a LIGHT photo whose canvas is too wide (no byte gate)", async () => {
		// The live regression: 3000px of flat color weighs far less than the
		// old 500KB caller gate, and still shipped 3000 pixels to a phone.
		const widePng = await sharp({
			create: {
				background: { b: 200, g: 120, r: 30 },
				channels: 3,
				height: 400,
				width: 3000,
			},
		})
			.png()
			.toBuffer();
		expect(widePng.byteLength).toBeLessThan(150 * 1024);

		const result = await service.uploadAttachment("user_1", {
			buffer: widePng,
			filename: "wide.png",
			mimetype: "image/png",
		});

		expect(result).toMatchObject({
			filename: "wide.webp",
			height: 256,
			mediaType: "image/webp",
			width: 1920,
		});
	});

	it("stores srcset renditions as siblings inside the same uuid directory", async () => {
		const bigPng = await sharp(randomBytes(2500 * 300 * 3), {
			raw: { channels: 3, height: 300, width: 2500 },
		})
			.png()
			.toBuffer();

		const result = await service.uploadAttachment("user_1", {
			buffer: bigPng,
			filename: "hero-photo.png",
			mimetype: "image/png",
		});

		const keys = vi
			.mocked(putSiteFile)
			.mock.calls.map((call) => call[0] as string);
		const [primary = ""] = keys;
		const directory = primary.slice(0, primary.lastIndexOf("/"));

		expect(keys.slice(1)).toEqual([
			`${directory}/hero-photo.w480.webp`,
			`${directory}/hero-photo.w960.webp`,
			`${directory}/hero-photo.w1600.webp`,
		]);
		// Four segments, exactly like the primary: isUserUploadUrl and the
		// brief's user-photo extractor both reject anything deeper.
		for (const key of keys) {
			expect(key.split("/")).toHaveLength(4);
		}
		expect(result.variants).toEqual([
			{ url: expect.stringContaining("hero-photo.w480.webp"), width: 480 },
			{ url: expect.stringContaining("hero-photo.w960.webp"), width: 960 },
			{ url: expect.stringContaining("hero-photo.w1600.webp"), width: 1600 },
		]);
	});

	it("still answers the upload when every rendition fails to store", async () => {
		const bigPng = await sharp(randomBytes(2500 * 300 * 3), {
			raw: { channels: 3, height: 300, width: 2500 },
		})
			.png()
			.toBuffer();
		// First call (the primary object) succeeds; every rendition blows up.
		vi.mocked(putSiteFile).mockImplementation(async (key) =>
			/\.w\d+\.webp$/.test(key)
				? Promise.reject(new Error("R2 said no"))
				: undefined,
		);

		const result = await service.uploadAttachment("user_1", {
			buffer: bigPng,
			filename: "hero-photo.png",
			mimetype: "image/png",
		});

		expect(result).toMatchObject({ mediaType: "image/webp" });
		expect(result.variants).toBeUndefined();
	});

	it("answers no dimensions for a non-image attachment", async () => {
		const result = await service.uploadAttachment("user_1", {
			buffer: Buffer.from("name,phone"),
			filename: "leads.csv",
			mimetype: "text/csv",
		});

		expect(result.width).toBeUndefined();
		expect(result.height).toBeUndefined();
		expect(result.variants).toBeUndefined();
	});

	it("stores a large GIF verbatim", async () => {
		const bigGif = Buffer.concat([
			Buffer.from("GIF89a", "latin1"),
			randomBytes(600 * 1024),
		]);

		const result = await service.uploadAttachment("user_1", {
			buffer: bigGif,
			filename: "loop.gif",
			mimetype: "image/gif",
		});

		expect(putSiteFile).toHaveBeenCalledWith(
			expect.stringMatching(/\/loop\.gif$/),
			bigGif,
			"image/gif",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		expect(result).toMatchObject({
			filename: "loop.gif",
			mediaType: "image/gif",
			size: bigGif.length,
		});
	});

	it("normalizes mimetypes with parameters and trusts text/plain without a sniff", async () => {
		const result = await service.uploadAttachment("user_1", {
			buffer: Buffer.from("notes about the brand"),
			filename: "notes.txt",
			mimetype: "text/plain; charset=utf-8",
		});

		expect(result.mediaType).toBe("text/plain");
	});

	it("accepts an xlsx whose bytes carry the ZIP signature", async () => {
		const result = await service.uploadAttachment("user_1", {
			buffer: ZIP_BYTES,
			filename: "stock.xlsx",
			mimetype: XLSX_MEDIA_TYPE,
		});

		expect(putSiteFile).toHaveBeenCalledWith(
			expect.stringMatching(/^uploads\/user_1\/[0-9a-f-]{36}\/stock\.xlsx$/),
			ZIP_BYTES,
			XLSX_MEDIA_TYPE,
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		expect(result.mediaType).toBe(XLSX_MEDIA_TYPE);
		expect(result.filename).toBe("stock.xlsx");
	});

	it("accepts a docx whose bytes carry the ZIP signature", async () => {
		const result = await service.uploadAttachment("user_1", {
			buffer: ZIP_BYTES,
			filename: "tarifs.docx",
			mimetype: DOCX_MEDIA_TYPE,
		});

		expect(result.mediaType).toBe(DOCX_MEDIA_TYPE);
		expect(result.filename).toBe("tarifs.docx");
	});

	it("rejects a PNG declared as a docx with 415", async () => {
		await expect(
			service.uploadAttachment("user_1", {
				buffer: PNG_BYTES,
				filename: "fake.docx",
				mimetype: DOCX_MEDIA_TYPE,
			}),
		).rejects.toThrow(UnsupportedMediaTypeException);
		expect(putSiteFile).not.toHaveBeenCalled();
	});

	it("trusts a declared text/csv without a signature sniff", async () => {
		const result = await service.uploadAttachment("user_1", {
			buffer: Buffer.from("name,phone\nSalon Lila,0555"),
			filename: "leads.csv",
			mimetype: "text/csv",
		});

		expect(result.mediaType).toBe("text/csv");
		expect(result.filename).toBe("leads.csv");
	});

	it("resolves a csv declared as the legacy Excel type from its filename", async () => {
		const result = await service.uploadAttachment("user_1", {
			buffer: Buffer.from("name,phone"),
			filename: "leads.csv",
			mimetype: "application/vnd.ms-excel",
		});

		expect(result.mediaType).toBe("text/csv");
	});

	it("resolves an empty declared type from an .xlsx filename", async () => {
		const result = await service.uploadAttachment("user_1", {
			buffer: ZIP_BYTES,
			filename: "report.xlsx",
			mimetype: "",
		});

		expect(result.mediaType).toBe(XLSX_MEDIA_TYPE);
	});
});

describe("sanitizeFilename", () => {
	it("keeps safe characters and collapses the rest to a dash", () => {
		expect(sanitizeFilename("صورة المنتج (1).png", "image/png")).toBe("1-.png");
		expect(sanitizeFilename("my photo!!.jpeg", "image/jpeg")).toBe(
			"my-photo-.jpeg",
		);
	});

	it("ensures an extension matching the media type", () => {
		expect(sanitizeFilename("logo", "image/png")).toBe("logo.png");
		expect(sanitizeFilename("scan.png", "application/pdf")).toBe("scan.pdf");
	});

	it("falls back to a stable stem when everything sanitizes away", () => {
		expect(sanitizeFilename("؟؟؟", "image/webp")).toBe("file.webp");
	});

	it("caps the name at 80 chars while keeping the extension", () => {
		const long = `${"a".repeat(200)}.png`;
		const result = sanitizeFilename(long, "image/png");

		expect(result.length).toBeLessThanOrEqual(80);
		expect(result.endsWith(".png")).toBe(true);
	});
});
