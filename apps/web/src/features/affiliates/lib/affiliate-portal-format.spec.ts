import type { AffiliateProgram } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	buildAffiliateShareUrl,
	formatAffiliateMoney,
	formatAffiliateRate,
	programTermsParts,
} from "./affiliate-portal-format";

const BASE_PROGRAM = {
	id: "22222222-2222-4222-8222-222222222222",
	name: "Partner program",
	commissionDurationMonths: 12,
	holdDays: 30,
	cookieWindowDays: 30,
	status: "active",
	createdAt: "2026-08-01T10:00:00.000Z",
	updatedAt: "2026-08-02T10:00:00.000Z",
} as const;

describe("formatAffiliateMoney", () => {
	it("upper-cases the currency and omits decimals for whole amounts", () => {
		expect(formatAffiliateMoney(2_000, "usd", "en-US")).toBe("$20");
	});

	it("keeps two decimal places when cents remain", () => {
		expect(formatAffiliateMoney(1_250, "usd", "en-US")).toBe("$12.50");
		expect(formatAffiliateMoney(-125, "usd", "en-US")).toBe("-$1.25");
	});
});

describe("formatAffiliateRate", () => {
	it("formats basis points as a locale-aware percentage", () => {
		expect(formatAffiliateRate(2_000, "en-US")).toBe("20%");
		expect(formatAffiliateRate(1_250, "en-US")).toBe("12.5%");
	});
});

describe("buildAffiliateShareUrl", () => {
	it("adds the referral to a landing path without a query", () => {
		expect(
			buildAffiliateShareUrl(
				"https://wandit.example",
				"/pricing",
				"partner_123",
			),
		).toBe("https://wandit.example/pricing?ref=partner_123");
	});

	it("uses an ampersand for an existing query and encodes the code", () => {
		expect(
			buildAffiliateShareUrl(
				"https://wandit.example/",
				"/pricing?plan=pro#compare",
				"partner / north",
			),
		).toBe(
			"https://wandit.example/pricing?plan=pro&ref=partner%20%2F%20north#compare",
		);
	});
});

describe("programTermsParts", () => {
	it("extracts percentage recurring terms", () => {
		const program: AffiliateProgram = {
			...BASE_PROGRAM,
			kind: "percentage_recurring",
			commissionRateBps: 2_000,
			fixedAmountCents: null,
			fixedCurrency: null,
		};

		expect(programTermsParts(program)).toEqual({
			kind: "percentage_recurring",
			rateBps: 2_000,
			durationMonths: 12,
			holdDays: 30,
		});
	});

	it("extracts fixed one-time terms", () => {
		const program: AffiliateProgram = {
			...BASE_PROGRAM,
			kind: "fixed_one_time",
			commissionRateBps: null,
			fixedAmountCents: 5_000,
			fixedCurrency: "usd",
			commissionDurationMonths: null,
		};

		expect(programTermsParts(program)).toEqual({
			kind: "fixed_one_time",
			amountCents: 5_000,
			currency: "usd",
			durationMonths: null,
			holdDays: 30,
		});
	});
});
