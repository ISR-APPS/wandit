import type { Lead } from "@wandit/contracts";
import { describe, expect, it } from "vitest";
import { buildLeadSheetValues, LEAD_SHEET_HEADER } from "./lead-sheet-rows";

function lead(overrides: Partial<Lead> = {}): Lead {
	return {
		campaign: null,
		commune: "Bab Ezzouar",
		createdAt: "2026-07-25T13:30:00.000Z",
		extras: null,
		id: "11111111-1111-4111-8111-111111111111",
		name: "Amina B",
		phone: "+213540773102",
		source: "facebook",
		status: "to_confirm",
		wilaya: "Alger",
		...overrides,
	};
}

describe("buildLeadSheetValues", () => {
	it("starts with the French header row", () => {
		expect(buildLeadSheetValues([])).toEqual([[...LEAD_SHEET_HEADER]]);
	});

	it("renders one row per lead with French labels and Algiers time", () => {
		const values = buildLeadSheetValues([lead()]);

		// 13:30 UTC is 14:30 in Africa/Algiers (UTC+1, no DST).
		expect(values[1]).toEqual([
			"Amina B",
			"+213540773102",
			"Alger",
			"Bab Ezzouar",
			"À confirmer",
			"Facebook",
			"25/07/2026 14:30",
			"",
		]);
	});

	it("serializes every public scalar order extra into one deterministic column", () => {
		const values = buildLeadSheetValues([
			lead({
				extras: {
					_rawPhone: "0550 00 00 00",
					bundle: "Duo",
					color: "Noir",
					delivery: "Domicile",
					quantity: 2,
					size: "XL",
					variant: "Menthe",
				},
			}),
		]);

		expect(values[1]?.[7]).toBe(
			'{"bundle":"Duo","color":"Noir","delivery":"Domicile","quantity":2,"size":"XL","variant":"Menthe"}',
		);
	});

	it("renders missing wilaya/commune as empty cells", () => {
		const values = buildLeadSheetValues([
			lead({
				commune: null,
				source: "direct",
				status: "delivered",
				wilaya: null,
			}),
		]);

		expect(values[1]?.slice(2, 6)).toEqual(["", "", "Livré", "Direct"]);
	});

	it("keeps lead order — newest first, same as the Leads tab", () => {
		const values = buildLeadSheetValues([
			lead({ name: "Newest" }),
			lead({ name: "Oldest", source: "tiktok", status: "cancelled" }),
		]);

		expect(values.map((row) => row[0])).toEqual(["Nom", "Newest", "Oldest"]);
		expect(values[2]?.slice(4, 6)).toEqual(["Annulé", "TikTok"]);
	});
});
