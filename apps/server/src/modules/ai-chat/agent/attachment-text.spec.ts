import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractAttachmentText } from "./attachment-text";

vi.mock("mammoth", () => ({
	default: { extractRawText: vi.fn() },
}));

vi.mock("unpdf", () => ({ extractText: vi.fn() }));

const DOCX_MEDIA_TYPE =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MEDIA_TYPE =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function bytesOf(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

beforeEach(() => {
	vi.mocked(mammoth.extractRawText).mockReset();
	vi.mocked(extractText).mockReset();
});

describe("extractAttachmentText", () => {
	it("decodes plain text and CSV as UTF-8", async () => {
		await expect(
			extractAttachmentText(bytesOf("notes sur la marque"), "text/plain"),
		).resolves.toEqual({ text: "notes sur la marque", truncated: false });
		await expect(
			extractAttachmentText(bytesOf("name,phone\nSalon Lila,0555"), "text/csv"),
		).resolves.toEqual({
			text: "name,phone\nSalon Lila,0555",
			truncated: false,
		});
	});

	it("truncates past the character limit and says so", async () => {
		const result = await extractAttachmentText(
			bytesOf("abcdefghij"),
			"text/plain",
			4,
		);

		expect(result).toEqual({
			text: "abcd\n[Truncated — the document continues beyond this point.]",
			truncated: true,
		});
	});

	it("renders an xlsx workbook sheet by sheet", async () => {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet("Tarifs");
		sheet.addRow(["Produit", "Prix"]);
		sheet.addRow(["Bougie", 1800]);
		const buffer = await workbook.xlsx.writeBuffer();

		const result = await extractAttachmentText(
			new Uint8Array(buffer),
			XLSX_MEDIA_TYPE,
		);

		expect("text" in result && result.text).toContain("## Sheet: Tarifs");
		expect("text" in result && result.text).toContain("Produit,Prix");
		expect("text" in result && result.text).toContain("Bougie,1800");
	});

	it("extracts docx text through mammoth", async () => {
		vi.mocked(mammoth.extractRawText).mockResolvedValue({
			messages: [],
			value: "Nos tarifs 2026",
		});

		await expect(
			extractAttachmentText(bytesOf("PK"), DOCX_MEDIA_TYPE),
		).resolves.toEqual({ text: "Nos tarifs 2026", truncated: false });
	});

	it("extracts pdf text through unpdf", async () => {
		vi.mocked(extractText).mockResolvedValue({
			text: "Menu du jour",
			totalPages: 1,
		});

		await expect(
			extractAttachmentText(bytesOf("%PDF"), "application/pdf"),
		).resolves.toEqual({ text: "Menu du jour", truncated: false });
	});

	it("answers with an error instead of throwing when a parser fails", async () => {
		vi.mocked(mammoth.extractRawText).mockRejectedValue(
			new Error("not a valid zip"),
		);

		const result = await extractAttachmentText(bytesOf("x"), DOCX_MEDIA_TYPE);

		expect("error" in result && result.error).toContain("not a valid zip");
	});

	it("refuses a media type it cannot extract", async () => {
		const result = await extractAttachmentText(bytesOf("x"), "image/png");

		expect("error" in result && result.error).toContain("image/png");
	});
});
