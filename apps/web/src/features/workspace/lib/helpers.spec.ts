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

	it("adds one deterministic order-details cell with every public COD scalar", () => {
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

		expect(csv).toContain(
			"Name,Phone,Wilaya,Commune,Status,Source,Campaign,Created at,Order details",
		);
		expect(csv).toContain("direct,Ramadan Promo,");
		expect(csv.match(/Order details/g)).toHaveLength(1);
		expect(csv).toContain(
			'"{""bundle"":""Family pack"",""color"":""Blue"",""delivery"":""Home"",""quantity"":3,""size"":""XL"",""variant"":""Premium""}"',
		);
		expect(csv).not.toContain("_rawPhone");
		expect(csv).not.toContain("0550000000");
	});

	it("serializes the same order details identically regardless of insertion order", () => {
		const first = leadWithExtras({ color: "Blue", bundle: "Pack" });
		const second = leadWithExtras({ bundle: "Pack", color: "Blue" });

		expect(buildLeadsCsv([first], HEADERS)).toBe(
			buildLeadsCsv([second], HEADERS),
		);
	});
});
