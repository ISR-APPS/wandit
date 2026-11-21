import { describe, expect, it } from "vitest";

import {
	amountToMinorUnits,
	formatManualPaymentAmount,
	mapManualRequestNoteFormDto,
	mapRecordTopupFormDto,
	type RecordTopupFormInput,
	suggestedTopupCredits,
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

describe("suggestedTopupCredits", () => {
	it.each([
		[
			"a v8 request of 25 USD",
			{ amountUsd: 25, plan: null, tierCredits: null, interval: null },
			250,
		],
		[
			"an old Pro 250 monthly request (25 USD)",
			{ amountUsd: null, plan: "pro", tierCredits: 250, interval: "month" },
			250,
		],
		[
			"an old Starter 60 monthly request (9 USD)",
			{ amountUsd: null, plan: "starter", tierCredits: 60, interval: "month" },
			90,
		],
		[
			"an old request on a retired tier",
			{ amountUsd: null, plan: "pro", tierCredits: 123, interval: "month" },
			null,
		],
		[
			"a request with no amount and no plan",
			{ amountUsd: null, plan: null, tierCredits: null, interval: null },
			null,
		],
		[
			"a fractional USD amount",
			{ amountUsd: 12.5, plan: null, tierCredits: null, interval: null },
			null,
		],
	] as const)("%s -> %s credits", (_label, request, expected) => {
		expect(suggestedTopupCredits(request)).toBe(expected);
	});
});

describe("mapRecordTopupFormDto", () => {
	const form: RecordTopupFormInput = {
		method: "ccp",
		majorAmount: "2700",
		currency: "DZD",
		credits: "",
		reference: " CCP-42 ",
		note: "",
	};
	const owner = { userId: "user-1", organizationId: null };

	it("sends a lower-case currency and leaves empty credits to the API", () => {
		expect(mapRecordTopupFormDto(form, owner)).toEqual({
			userId: "user-1",
			organizationId: null,
			amountMinor: 270_000,
			currency: "dzd",
			method: "ccp",
			reference: "CCP-42",
			credits: undefined,
			note: undefined,
			requestId: undefined,
		});
	});

	it.each([
		["a zero amount", { majorAmount: "0" }],
		["empty credits in a currency the API cannot price", { currency: "EUR" }],
	] as const)("returns null for %s", (_label, change) => {
		expect(mapRecordTopupFormDto({ ...form, ...change }, owner)).toBeNull();
	});

	it("accepts typed credits in a currency the API cannot price", () => {
		expect(
			mapRecordTopupFormDto(
				{ ...form, currency: "EUR", credits: "120.5" },
				owner,
			)?.credits,
		).toBe(120.5);
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

describe("mapManualRequestNoteFormDto", () => {
	it.each([
		["reject", "rejected"],
		["cancel", "canceled"],
	] as const)("maps %s to status %s with the trimmed reason", (mode, status) => {
		expect(
			mapManualRequestNoteFormDto(mode, "  The customer changed their mind.  "),
		).toEqual({
			status,
			adminNotes: "The customer changed their mind.",
		});
	});

	it("returns null when a reject or cancel has no reason", () => {
		expect(mapManualRequestNoteFormDto("cancel", "   ")).toBeNull();
		expect(mapManualRequestNoteFormDto("reject", "")).toBeNull();
	});

	it("keeps the status on a note edit and clears a blank note", () => {
		expect(
			mapManualRequestNoteFormDto("note", " Call again on Monday. "),
		).toEqual({
			adminNotes: "Call again on Monday.",
		});
		expect(mapManualRequestNoteFormDto("note", "  ")).toEqual({
			adminNotes: null,
		});
	});

	it("returns null when the note is longer than the contract allows", () => {
		expect(mapManualRequestNoteFormDto("note", "x".repeat(2001))).toBeNull();
	});
});
