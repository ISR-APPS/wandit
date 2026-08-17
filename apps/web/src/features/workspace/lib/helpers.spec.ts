import type { Lead } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	pageTitleDynamic: (key: string) => key,
}));

import { buildLeadsCsv } from "./helpers";

const HEADERS = [
	"Name",
	"Phone",
	"Wilaya",
	"Commune",
	"Status",
	"Source",
	"Campaign",
	"Created at",
];

function leadWithExtras(extras: Lead["extras"]): Lead {
	return {
		archivedAt: null,
		campaign: "Ramadan Promo",
		commune: "Bab Ezzouar",
		createdAt: "2026-08-02T10:00:00.000Z",
		extras,
		id: "00000000-0000-4000-8000-000000000001",
		name: "Amina",
		phone: "+213550000000",
		source: "direct",
		status: "confirmed",
		wilaya: "Alger",
	};
}

describe("buildLeadsCsv", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("gives every public COD scalar its own labelled column", () => {
		const csv = buildLeadsCsv(
			[
				leadWithExtras({
					variant: "Premium",
					size: "XL",
					quantity: 3,
					delivery: "Home",
					color: "Blue",
					bundle: "Family pack",
					_rawPhone: "0550000000",
				}),
			],
			HEADERS,
		);
		const lines = csv.split("\n");

		expect(lines[0]).toBe(
			"\uFEFFName,Phone,Wilaya,Commune,Status,Source,Campaign,Created at,bundle,color,delivery,quantity,size,variant",
		);
		expect(lines[1]).toBe(
			"Amina,+213550000000,Alger,Bab Ezzouar,leads.status.confirmed,direct,Ramadan Promo,2026-08-02T10:00:00.000Z,Family pack,Blue,Home,3,XL,Premium",
		);
		expect(csv).not.toContain("_rawPhone");
		expect(csv).not.toContain("0550000000");
	});

	it("unions the columns across leads and pads missing fields", () => {
		const csv = buildLeadsCsv(
			[
				leadWithExtras({ size: "XL" }),
				leadWithExtras({ color: "Blue", gift: true }),
			],
			HEADERS,
		);
		const lines = csv.split("\n");

		// First appearance assigns the column; every row is padded to the full
		// header width so the CSV stays rectangular.
		expect(lines[0]?.endsWith("Created at,size,color,gift")).toBe(true);
		expect(lines[1]?.endsWith("2026-08-02T10:00:00.000Z,XL,,")).toBe(true);
		expect(lines[2]?.endsWith("2026-08-02T10:00:00.000Z,,Blue,Oui")).toBe(true);
	});

	it("renames a form field that collides with a fixed header", () => {
		const csv = buildLeadsCsv([leadWithExtras({ Status: "vip" })], HEADERS);
		const lines = csv.split("\n");

		expect(lines[0]?.endsWith("Created at,Status (2)")).toBe(true);
		expect(lines[1]?.endsWith(",vip")).toBe(true);
	});

	it("neutralizes formula-starting extras cells but keeps E.164 phones intact", () => {
		const csv = buildLeadsCsv([leadWithExtras({ note: "=2+5" })], HEADERS);
		const lines = csv.split("\n");

		// Buyer-controlled cells must not execute in Excel; the phone column keeps
		// its leading + untouched.
		expect(lines[1]?.startsWith("Amina,+213550000000,")).toBe(true);
		expect(lines[1]?.endsWith(",'=2+5")).toBe(true);
	});

	it("builds the same columns regardless of key insertion order", () => {
		const first = leadWithExtras({ color: "Blue", bundle: "Pack" });
		const second = leadWithExtras({ bundle: "Pack", color: "Blue" });

		expect(buildLeadsCsv([first], HEADERS)).toBe(
			buildLeadsCsv([second], HEADERS),
		);
	});
});
