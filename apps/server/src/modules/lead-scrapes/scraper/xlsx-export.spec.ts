import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { type LeadRecord, toPreviewRows } from "../domain/lead-scrape-spec";
import { buildLeadsWorkbook, leadsWorkbookFilename } from "./xlsx-export";

const RECORDS: LeadRecord[] = [
	{
		address: "12 Rue Didouche Mourad, Alger",
		name: "Iron Temple Gym",
		phone: "0551 23 45 67",
		source: "google-maps",
		website: "https://irontemple.dz",
	},
	{
		address: null,
		name: "Studio Pulse Hydra",
		phone: null,
		source: "google-maps",
		website: null,
	},
];

describe("leadsWorkbookFilename", () => {
	it("slugifies the query and location with accents folded", () => {
		expect(leadsWorkbookFilename("Salles de Sport", "Alger, Algérie")).toBe(
			"salles-de-sport-alger-algerie-leads.xlsx",
		);
	});

	it("omits the location part when none was given", () => {
		expect(leadsWorkbookFilename("gyms", null)).toBe("gyms-leads.xlsx");
	});
});

describe("buildLeadsWorkbook", () => {
	it("produces a non-empty workbook with the contract's row/column counts", async () => {
		const workbook = await buildLeadsWorkbook(RECORDS);

		expect(workbook.rowCount).toBe(2);
		expect(workbook.columnCount).toBe(5);
		// XLSX files are ZIP containers — check the magic bytes ("PK").
		expect(workbook.bytes.byteLength).toBeGreaterThan(1000);
		expect(workbook.bytes[0]).toBe(0x50);
		expect(workbook.bytes[1]).toBe(0x4b);
	});

	it("exports 50 businesses as 50 data rows under the 5-column header", async () => {
		const records: LeadRecord[] = Array.from({ length: 50 }, (_, index) => ({
			address: `Street ${index + 1}`,
			name: `Business ${index + 1}`,
			phone: `0551 00 00 ${String(index + 1).padStart(2, "0")}`,
			source: "google-maps",
			website: null,
		}));
		const workbook = await buildLeadsWorkbook(records);
		const parsed = new ExcelJS.Workbook();

		// The copy hands load() a buffer of exactly the workbook's bytes (a
		// typed array can view a larger pool).
		await parsed.xlsx.load(new Uint8Array(workbook.bytes).buffer);

		const sheet = parsed.getWorksheet("Leads");
		expect(sheet?.actualRowCount).toBe(51);
		// Row.values is 1-based: index 0 is empty.
		expect(sheet?.getRow(1).values).toEqual([
			undefined,
			"Business",
			"Phone",
			"Website",
			"Address",
			"Source",
		]);
	});
});

describe("toPreviewRows", () => {
	it("maps unknown fields to empty strings and caps the row count", () => {
		expect(toPreviewRows(RECORDS, 1)).toEqual([
			{
				business: "Iron Temple Gym",
				phone: "0551 23 45 67",
			},
		]);
		expect(toPreviewRows(RECORDS)[1]).toEqual({
			business: "Studio Pulse Hydra",
			phone: "",
		});
	});
});
