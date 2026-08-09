import {
	ServiceUnavailableException,
	UnsupportedMediaTypeException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
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
