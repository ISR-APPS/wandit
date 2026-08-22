import { type Lead, MAX_LEAD_EXTRA_COLUMNS } from "@wandit/contracts";
import { describe, expect, it } from "vitest";
import {
	buildLeadSheetValues,
	LEAD_SHEET_HEADER,
	LEAD_SHEET_ORDER_HEADER,
} from "./lead-sheet-rows";

const FIXED_HEADER = [...LEAD_SHEET_HEADER, ...LEAD_SHEET_ORDER_HEADER];
const EMPTY_ORDER_CELLS = LEAD_SHEET_ORDER_HEADER.map(() => "");

function lead(overrides: Partial<Lead> = {}): Lead {
	return {
		archivedAt: null,
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
	it("starts with the French header row, promoted order columns included", () => {
		expect(buildLeadSheetValues([])).toEqual([FIXED_HEADER]);
		expect(LEAD_SHEET_ORDER_HEADER).toEqual([
			"Produit",
			"Quantité",
			"Prix",
			"Livraison",
			"Total",
		]);
	});

	it("renders one row per lead with French labels and Algiers time", () => {
		const values = buildLeadSheetValues([lead()]);

		// 13:30 UTC is 14:30 in Africa/Algiers (UTC+1, no DST). The promoted
		// order columns are always present, blank without order extras.
		expect(values[1]).toEqual([
			"Amina B",
			"+213540773102",
			"Alger",
			"Bab Ezzouar",
			"À confirmer",
			"Facebook",
			"25/07/2026 14:30",
			...EMPTY_ORDER_CELLS,
		]);
	});

	it("promotes order facts and gives the other scalars their own columns", () => {
		const values = buildLeadSheetValues([
			lead({
				extras: {
					_rawPhone: "0550 00 00 00",
					bundle: "Duo",
					color: "Noir",
					delivery: "Domicile",
					options: ["gift"],
					quantity: 2,
					size: "XL",
					variant: "Menthe",
				},
			}),
		]);

		// bundle/quantity/delivery land in the promoted order columns; _rawPhone
		// is capture metadata and options is not scalar — neither becomes a
		// column; the rest stay dynamic.
		expect(values[0]).toEqual([...FIXED_HEADER, "color", "size", "variant"]);
		expect(values[1]?.slice(LEAD_SHEET_HEADER.length)).toEqual([
			"Duo",
			"2",
			"",
			"Domicile",
			"",
			"Noir",
			"XL",
			"Menthe",
		]);
	});

	it("promotes French and Arabic synonyms into the order columns", () => {
		// الإجمالي uses the standard hamza spelling — the normalizer must fold
		// it onto the hamza-less alias.
		const values = buildLeadSheetValues([
			lead({
				extras: {
					Quantité: 2,
					offre: "Pack Duo",
					الإجمالي: "3500 DA",
					"طريقة التوصيل": "Stopdesk",
				},
			}),
		]);

		expect(values[0]).toEqual(FIXED_HEADER);
		expect(values[1]?.slice(LEAD_SHEET_HEADER.length)).toEqual([
			"Pack Duo",
			"2",
			"",
			"Stopdesk",
			"3500 DA",
		]);
	});

	it("lets a non-null synonym beat an earlier null claim", () => {
		const values = buildLeadSheetValues([
			lead({ extras: { bundle: null, produit: "Solo" } }),
		]);

		// An untouched optional input submits null; the real product name must
		// still reach the promoted column, with the null key kept dynamic.
		expect(values[0]).toEqual([...FIXED_HEADER, "bundle"]);
		expect(values[1]?.slice(LEAD_SHEET_HEADER.length)).toEqual([
			"Solo",
			"",
			"",
			"",
			"",
			"",
		]);
	});

	it("keeps a later synonym as a dynamic column once the field is claimed", () => {
		const values = buildLeadSheetValues([
			lead({ extras: { bundle: "Duo", produit: "Solo" } }),
		]);

		// bundle claims the Produit column first (code-unit entry order); the
		// second synonym keeps its own column so its value is never lost.
		expect(values[0]).toEqual([...FIXED_HEADER, "produit"]);
		expect(values[1]?.slice(LEAD_SHEET_HEADER.length)).toEqual([
			"Duo",
			"",
			"",
			"",
			"",
			"Solo",
		]);
	});

	it("unions extras across leads and leaves missing fields blank", () => {
		const values = buildLeadSheetValues([
			lead({ extras: { size: "XL" }, name: "Newest" }),
			lead({ extras: { color: "Noir", giftWrap: true }, name: "Oldest" }),
		]);

		// First appearance assigns the dynamic column, so the newest form's
		// fields sit leftmost and later-discovered fields only append right.
		expect(values[0]?.slice(FIXED_HEADER.length)).toEqual([
			"size",
			"color",
			"giftWrap",
		]);
		expect(values[1]?.slice(FIXED_HEADER.length)).toEqual(["XL"]);
		expect(values[2]?.slice(FIXED_HEADER.length)).toEqual(["", "Noir", "Oui"]);
	});

	it("formats extras for merchants — Oui/Non booleans, blank nulls", () => {
		const values = buildLeadSheetValues([
			lead({ extras: { express: false, gift: true, note: null, qty: 3 } }),
		]);

		// qty is a quantity synonym and lands in the promoted column.
		expect(
			values[1]?.slice(LEAD_SHEET_HEADER.length, FIXED_HEADER.length),
		).toEqual(["", "3", "", "", ""]);
		expect(values[1]?.slice(FIXED_HEADER.length)).toEqual(["Non", "Oui", ""]);
	});

	it("renames a form field that collides with a fixed label", () => {
		const values = buildLeadSheetValues([lead({ extras: { Date: "demain" } })]);

		expect(values[0]?.slice(FIXED_HEADER.length)).toEqual(["Date (2)"]);
		expect(values[1]?.slice(FIXED_HEADER.length)).toEqual(["demain"]);
	});

	it("collapses keys past the column cap into one catch-all column", () => {
		// Keys are attacker-chosen on the public capture endpoint — the grid must
		// stay far below Google's 18,278-column hard limit.
		const wide = Object.fromEntries(
			Array.from({ length: MAX_LEAD_EXTRA_COLUMNS + 1 }, (_, index) => [
				`f${String(index).padStart(3, "0")}`,
				index,
			]),
		);
		const values = buildLeadSheetValues([lead({ extras: wide })]);

		expect(values[0]).toHaveLength(
			FIXED_HEADER.length + MAX_LEAD_EXTRA_COLUMNS + 1,
		);
		expect(values[0]?.at(-1)).toBe("Autres champs");
		expect(values[1]?.at(-1)).toBe('{"f100":100}');
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
