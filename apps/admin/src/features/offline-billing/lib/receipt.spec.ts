import { describe, expect, it } from "vitest";

import {
	computeDzdPlanPrice,
	convertReceiptPaymentAmount,
	createReceiptNumber,
	formatReceiptAmount,
	formatReceiptDate,
	formatReceiptDateTime,
	formatWholeDzdAmount,
	getFrenchBillingIntervalLabel,
	getFrenchCountryLabel,
	getFrenchPaymentKindLabel,
	getFrenchPaymentMethodLabel,
	getReceiptCustomerName,
	groupPaymentTotalsByCurrency,
	RECEIPT_PLAN_FEATURES,
} from "./receipt";

function normalizeIntlWhitespace(value: string): string {
	return value.replace(/[\u00a0\u202f]/g, " ");
}

describe("createReceiptNumber", () => {
	it("uses the first eight hexadecimal characters of the subscription UUID", () => {
		expect(createReceiptNumber("550e8400-e29b-41d4-a716-446655440000")).toBe(
			"REC-550E8400",
		);
	});

	it("uses the same receipt number format for a request UUID", () => {
		expect(createReceiptNumber("abcdef12-e29b-41d4-a716-446655440000")).toBe(
			"REC-ABCDEF12",
		);
	});

	it("uses an explicit fallback for an invalid source id", () => {
		expect(createReceiptNumber("")).toBe("REC-UNKNOWN");
		expect(createReceiptNumber("not-a-uuid")).toBe("REC-UNKNOWN");
	});
});

describe("French receipt date formatting", () => {
	it("formats calendar dates in French using Algeria time", () => {
		expect(formatReceiptDate("2028-01-15T10:30:00.000Z")).toBe(
			"15 janvier 2028",
		);
		expect(formatReceiptDate("2028-01-31T23:30:00.000Z")).toBe(
			"01 février 2028",
		);
	});

	it("formats date-times and handles invalid values", () => {
		const formatted = formatReceiptDateTime("2028-01-15T10:30:00.000Z");

		expect(formatted).toContain("15 janvier 2028");
		expect(formatted).toContain("11:30");
		expect(formatReceiptDate("not-a-date")).toBe("—");
		expect(formatReceiptDateTime("not-a-date")).toBe("—");
	});
});

describe("French receipt money formatting", () => {
	it("formats DZD and three-decimal TND amounts with French separators", () => {
		expect(normalizeIntlWhitespace(formatReceiptAmount(1_500_000, "DZD"))).toBe(
			"15 000,00 DZD",
		);
		expect(normalizeIntlWhitespace(formatReceiptAmount(25_000, "TND"))).toBe(
			"25,000 TND",
		);
	});

	it("converts catalog prices to rounded whole dinars", () => {
		expect(computeDzdPlanPrice(50, 270)).toBe(13_500);
		expect(computeDzdPlanPrice(10.01, 270.5)).toBe(2_708);
		expect(normalizeIntlWhitespace(formatWholeDzdAmount(13_500))).toBe(
			"13 500 DZD",
		);
	});
});

describe("getReceiptCustomerName", () => {
	it("falls back to the customer email when no request or user name exists", () => {
		expect(
			getReceiptCustomerName({
				request: null,
				user: { email: "client@example.com", name: "" },
			}),
		).toBe("client@example.com");
	});
});

describe("French receipt labels", () => {
	it("labels payment kinds, methods, and billing intervals", () => {
		expect(getFrenchPaymentKindLabel("initial")).toBe("Paiement initial");
		expect(getFrenchPaymentKindLabel("renewal")).toBe("Renouvellement");
		expect(getFrenchPaymentMethodLabel("cash_on_delivery")).toBe(
			"Paiement à la livraison",
		);
		expect(getFrenchPaymentMethodLabel("bank_transfer")).toBe(
			"Virement bancaire",
		);
		expect(getFrenchPaymentMethodLabel("ccp")).toBe("CCP");
		expect(getFrenchPaymentMethodLabel("baridimob")).toBe("BaridiMob");
		expect(getFrenchPaymentMethodLabel("other")).toBe("Autre");
		expect(getFrenchBillingIntervalLabel("month")).toBe("Mensuel");
		expect(getFrenchBillingIntervalLabel("year")).toBe("Annuel");
	});

	it("formats known and standard country codes in French", () => {
		expect(getFrenchCountryLabel("DZ")).toBe("Algérie");
		expect(getFrenchCountryLabel("ma")).toBe("Maroc");
		expect(getFrenchCountryLabel("OTHER")).toBe("Autre");
		expect(getFrenchCountryLabel("FR")).toBe("France");
	});

	it("keeps the plan feature copy synchronized for every receipt plan", () => {
		expect(RECEIPT_PLAN_FEATURES.starter).toContain("60 crédits chaque mois");
		expect(RECEIPT_PLAN_FEATURES.pro).toContain(
			"De nouveaux crédits chaque mois",
		);
		expect(RECEIPT_PLAN_FEATURES.business).toContain(
			"Tout ce qui est inclus dans Pro",
		);
	});
});

describe("groupPaymentTotalsByCurrency", () => {
	it("converts USD to whole DZD and folds it into the DZD total", () => {
		expect(
			groupPaymentTotalsByCurrency(
				[
					{ amountMinor: 125_050, currency: "DZD" },
					{ amountMinor: 74_950, currency: "dzd" },
					{ amountMinor: 5_000, currency: " EUR " },
					{ amountMinor: 1_000, currency: "USD" },
				],
				270,
			),
		).toEqual([
			{ amountMinor: 470_000, currency: "DZD" },
			{ amountMinor: 5_000, currency: "EUR" },
		]);
	});

	it("rounds a USD payment once before adding it to receipt totals", () => {
		expect(
			convertReceiptPaymentAmount(
				{ amountMinor: 199, currency: " usd " },
				270.25,
			),
		).toEqual({ amountMinor: 53_800, currency: "DZD" });
	});

	it("omits USD when the admin rate is unavailable", () => {
		expect(
			convertReceiptPaymentAmount({ amountMinor: 1_000, currency: "USD" }),
		).toBeNull();
	});

	it("marks the DZD total unavailable when a USD payment has no rate", () => {
		expect(
			groupPaymentTotalsByCurrency([
				{ amountMinor: 125_050, currency: "DZD" },
				{ amountMinor: 1_000, currency: "USD" },
				{ amountMinor: 5_000, currency: "EUR" },
			]),
		).toEqual([
			{ amountMinor: null, currency: "DZD" },
			{ amountMinor: 5_000, currency: "EUR" },
		]);
	});

	it("never treats raw USD minor units as a DZD total", () => {
		const totals = groupPaymentTotalsByCurrency([
			{ amountMinor: 1_000, currency: "USD" },
		]);

		expect(totals).toEqual([{ amountMinor: null, currency: "DZD" }]);
		expect(totals).not.toContainEqual({ amountMinor: 1_000, currency: "DZD" });
	});

	it("returns no totals when no payments were recorded", () => {
		expect(groupPaymentTotalsByCurrency([])).toEqual([]);
	});
});
