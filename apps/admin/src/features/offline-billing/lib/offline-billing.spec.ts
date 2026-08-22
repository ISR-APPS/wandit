import { describe, expect, it } from "vitest";

import {
	amountToMinorUnits,
	computeDefaultPeriod,
	computeDefaultRenewalEnd,
	formatManualPaymentAmount,
	mapManualPaymentFormDto,
} from "./offline-billing";

describe("amountToMinorUnits", () => {
	it("converts major units and rounds to the nearest minor unit", () => {
		expect(amountToMinorUnits("1250.50")).toBe(125_050);
		expect(amountToMinorUnits("12.345")).toBe(1_235);
		expect(amountToMinorUnits("0")).toBe(0);
	});

	it("rejects empty, negative, non-finite, and oversized values", () => {
		expect(amountToMinorUnits("")).toBeNull();
		expect(amountToMinorUnits("-1")).toBeNull();
		expect(amountToMinorUnits("Infinity")).toBeNull();
		expect(amountToMinorUnits("10000000.01")).toBeNull();
	});
});

describe("period defaults", () => {
	it("uses the shared month-end-clamping UTC calendar math", () => {
		const period = computeDefaultPeriod(
			new Date("2028-01-31T10:15:00.000Z"),
			"month",
		);

		expect(period.periodEnd.toISOString()).toBe("2028-02-29T10:15:00.000Z");
	});

	it("anchors a live renewal at the current end", () => {
		const result = computeDefaultRenewalEnd(
			"2028-04-15T10:00:00.000Z",
			"month",
			new Date("2028-04-01T10:00:00.000Z"),
		);

		expect(result.toISOString()).toBe("2028-05-15T10:00:00.000Z");
	});

	it("anchors an ended renewal at now", () => {
		const result = computeDefaultRenewalEnd(
			"2028-03-01T10:00:00.000Z",
			"year",
			new Date("2028-04-01T10:00:00.000Z"),
		);

		expect(result.toISOString()).toBe("2029-04-01T10:00:00.000Z");
	});

	it("anchors an early-ended renewal at now even when its old end is future", () => {
		const result = computeDefaultRenewalEnd(
			"2028-06-01T10:00:00.000Z",
			"month",
			new Date("2028-04-01T10:00:00.000Z"),
			false,
		);

		expect(result.toISOString()).toBe("2028-05-01T10:00:00.000Z");
	});
});

describe("mapManualPaymentFormDto", () => {
	it("maps the form to the contract and omits blank optional fields", () => {
		expect(
			mapManualPaymentFormDto({
				method: "bank_transfer",
				majorAmount: " 25.50 ",
				currency: "dzd",
				reference: "  WIRE-42  ",
				note: "   ",
			}),
		).toEqual({
			method: "bank_transfer",
			amountMinor: 2_550,
			currency: "DZD",
			reference: "WIRE-42",
			note: undefined,
		});
	});

	it("returns null when the payment does not satisfy the DTO", () => {
		expect(
			mapManualPaymentFormDto({
				method: "cash_on_delivery",
				majorAmount: "10",
				currency: "DZ",
				reference: "",
				note: "",
			}),
		).toBeNull();
	});
});

describe("currency minor-unit exponents", () => {
	it("stores TND in millimes (exponent 3)", () => {
		expect(amountToMinorUnits("100.505", "TND")).toBe(100505);
		expect(amountToMinorUnits("25", "TND")).toBe(25000);
	});

	it("keeps exponent-2 currencies at x100", () => {
		expect(amountToMinorUnits("2500", "DZD")).toBe(250000);
		expect(amountToMinorUnits("19.99", "USD")).toBe(1999);
	});

	it("formats TND back from millimes", () => {
		expect(formatManualPaymentAmount(25000, "TND")).toContain("25");
		expect(formatManualPaymentAmount(250000, "DZD")).toContain("2,500");
	});
});
