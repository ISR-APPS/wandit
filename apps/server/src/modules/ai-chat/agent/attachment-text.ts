/**
 * Text extraction for attached documents, on demand (read_attachment) rather
 * than at upload time: the transcript is resubmitted every turn, so inlining
 * a document's text would re-cost it on every message. Plain functions, NO
 * NestJS — the same module must stay usable from a Trigger.dev task.
 */
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractText } from "unpdf";

export const ATTACHMENT_TEXT_CHAR_LIMIT = 60_000;

const XLSX_MAX_SHEETS = 10;
const XLSX_MAX_ROWS = 500;
const TRUNCATION_NOTICE =
	"[Truncated — the document continues beyond this point.]";

const DOCX_MEDIA_TYPE =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MEDIA_TYPE =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Extraction = { text: string } | { error: string };

export async function extractAttachmentText(
	bytes: Uint8Array,
	mediaType: string,
	charLimit = ATTACHMENT_TEXT_CHAR_LIMIT,
): Promise<{ text: string; truncated: boolean } | { error: string }> {
	const extracted = await extractRawText(bytes, mediaType);

	if ("error" in extracted) {
		return extracted;
	}

	if (extracted.text.length <= charLimit) {
		return { text: extracted.text, truncated: false };
	}

	return {
		text: `${extracted.text.slice(0, charLimit)}\n${TRUNCATION_NOTICE}`,
		truncated: true,
	};
}

async function extractRawText(
	bytes: Uint8Array,
	mediaType: string,
): Promise<Extraction> {
	switch (mediaType) {
		case "text/plain":
		case "text/csv":
			return { text: new TextDecoder().decode(bytes) };
		case "application/pdf":
			return extractPdfText(bytes);
		case DOCX_MEDIA_TYPE:
			return extractDocxText(bytes);
		case XLSX_MEDIA_TYPE:
			return extractXlsxText(bytes);
		default:
			return { error: `Text cannot be extracted from ${mediaType} files.` };
	}
}

async function extractPdfText(bytes: Uint8Array): Promise<Extraction> {
	try {
		const { text } = await extractText(bytes, { mergePages: true });

		return { text };
	} catch (error) {
		return { error: `The PDF could not be read: ${shortReason(error)}` };
	}
}

async function extractDocxText(bytes: Uint8Array): Promise<Extraction> {
	try {
		const result = await mammoth.extractRawText({
			buffer: Buffer.from(bytes),
		});

		return { text: result.value };
	} catch (error) {
		return {
			error: `The Word document could not be read: ${shortReason(error)}`,
		};
	}
}

async function extractXlsxText(bytes: Uint8Array): Promise<Extraction> {
	try {
		const workbook = new ExcelJS.Workbook();
		// exceljs types its reader input as an ArrayBuffer, not a Node Buffer.
		await workbook.xlsx.load(toArrayBuffer(bytes));

		const sheets = workbook.worksheets
			.slice(0, XLSX_MAX_SHEETS)
			.map((sheet) => renderSheet(sheet));

		return { text: sheets.join("\n\n") };
	} catch (error) {
		return {
			error: `The spreadsheet could not be read: ${shortReason(error)}`,
		};
	}
}

function renderSheet(sheet: ExcelJS.Worksheet): string {
	const lines = [`## Sheet: ${sheet.name}`];
	let cut = false;

	sheet.eachRow((row) => {
		if (lines.length > XLSX_MAX_ROWS) {
			cut = true;
			return;
		}

		const cells: string[] = [];
		row.eachCell({ includeEmpty: true }, (cell) => {
			cells.push(cell.text);
		});
		lines.push(cells.join(","));
	});

	if (cut) {
		lines.push(
			`[Only the first ${XLSX_MAX_ROWS} rows of this sheet are shown.]`,
		);
	}

	return lines.join("\n");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);

	return copy;
}

function shortReason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
