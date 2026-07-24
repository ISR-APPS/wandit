import { describe, expect, it } from "vitest";

import { type LeadRecord, toPreviewRows } from "../domain/lead-scrape-spec";
import { buildLeadsWorkbook, leadsWorkbookFilename } from "./xlsx-export";

const RECORDS: LeadRecord[] = [
	{
		address: "12 Rue Didouche Mourad, Alger",
		email: "contact@irontemple.dz",
		emailVerified: true,
		name: "Iron Temple Gym",
		phone: "0551 23 45 67",
		source: "google-maps",
		website: "https://irontemple.dz",
	},
	{
		address: null,
		email: null,
		emailVerified: false,
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
		expect(workbook.columnCount).toBe(6);
		// XLSX files are ZIP containers — check the magic bytes ("PK").
		expect(workbook.bytes.byteLength).toBeGreaterThan(1000);
		expect(workbook.bytes[0]).toBe(0x50);
		expect(workbook.bytes[1]).toBe(0x4b);
	});
});

describe("toPreviewRows", () => {
	it("maps unknown fields to empty strings and caps the row count", () => {
		expect(toPreviewRows(RECORDS, 1)).toEqual([
			{
				business: "Iron Temple Gym",
				email: "contact@irontemple.dz",
				phone: "0551 23 45 67",
			},
		]);
		expect(toPreviewRows(RECORDS)[1]).toEqual({
			business: "Studio Pulse Hydra",
			email: "",
			phone: "",
		});
	});
});
