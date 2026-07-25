/**
 * Turn the finished lead records into a styled .xlsx workbook.
 *
 * exceljs (not sheetjs): actively maintained, first-class styling, and
 * writeBuffer() fits the task → R2 upload path. Plain functions, NO NestJS
 * (used by the Trigger.dev task).
 */
import ExcelJS from "exceljs";

import type { LeadRecord } from "../domain/lead-scrape-spec";

// Column order is the product contract ("6 columns" on the result card).
const LEAD_EXPORT_COLUMNS = [
	{ header: "Business", key: "name", width: 32 },
	{ header: "Phone", key: "phone", width: 18 },
	{ header: "Email", key: "email", width: 30 },
	{ header: "Website", key: "website", width: 34 },
	{ header: "Address", key: "address", width: 44 },
	{ header: "Source", key: "source", width: 14 },
] as const;

export type LeadsWorkbook = {
	bytes: Uint8Array;
	columnCount: number;
	rowCount: number;
};

export async function buildLeadsWorkbook(
	records: readonly LeadRecord[],
): Promise<LeadsWorkbook> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = "Wandit";
	const sheet = workbook.addWorksheet("Leads", {
		// Keep the header on screen while scrolling the list.
		views: [{ state: "frozen", ySplit: 1 }],
	});

	sheet.columns = LEAD_EXPORT_COLUMNS.map((column) => ({ ...column }));

	for (const record of records) {
		sheet.addRow({
			address: record.address ?? "",
			email: record.email ?? "",
			name: record.name,
			phone: record.phone ?? "",
			source: sourceLabel(record.source),
			website: record.website ?? "",
		});
	}

	const header = sheet.getRow(1);
	header.font = { bold: true, size: 11 };
	header.fill = {
		fgColor: { argb: "FFF7F4ED" },
		pattern: "solid",
		type: "pattern",
	};
	header.border = { bottom: { color: { argb: "FFE7E4DC" }, style: "thin" } };
	sheet.autoFilter = {
		from: { column: 1, row: 1 },
		to: { column: LEAD_EXPORT_COLUMNS.length, row: 1 },
	};

	const buffer = await workbook.xlsx.writeBuffer();

	return {
		bytes: new Uint8Array(buffer),
		columnCount: LEAD_EXPORT_COLUMNS.length,
		rowCount: records.length,
	};
}

/**
 * Filename like "gyms-alger-leads.xlsx" — accent-folded, lowercased, safe
 * for Content-Disposition and R2 keys.
 */
export function leadsWorkbookFilename(
	query: string,
	location: string | null,
): string {
	const parts = [query, location ?? "", "leads"]
		.map(slugify)
		.filter((part) => part.length > 0);

	return `${parts.join("-")}.xlsx`;
}

function slugify(value: string): string {
	return (
		value
			.normalize("NFKD")
			// Strip the combining marks NFKD split off (é → e + U+0301).
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40)
	);
}

function sourceLabel(source: LeadRecord["source"]): string {
	return source === "google-maps" ? "Google Maps" : source;
}
