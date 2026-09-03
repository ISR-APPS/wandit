import { getDictionary, translate } from "@wandit/internationalization";
import { describe, expect, it } from "vitest";

import {
	formatCreditAmount,
	formatCreditBalance,
	formatCreditDelta,
} from "./format-credits";

describe("formatCreditBalance", () => {
	it("floors to one decimal and never rounds up", () => {
		expect(formatCreditBalance(37, "en")).toBe("37.0");
		expect(formatCreditBalance(2.99, "en")).toBe("2.9");
		expect(formatCreditBalance(0.09, "en")).toBe("0.0");
		expect(formatCreditBalance(0, "en")).toBe("0.0");
	});

	it("floors negative overage balances away from zero", () => {
		expect(formatCreditBalance(-3.05, "en")).toBe("-3.1");
	});

	it("never renders raw float dust", () => {
		expect(formatCreditBalance(0.1 + 0.2, "en")).toBe("0.3");
	});

	it("localizes the decimal separator", () => {
		expect(formatCreditBalance(2.99, "fr")).toBe("2,9");
	});
});

describe("formatCreditAmount", () => {
	it("shows the exact amount with trailing zeros trimmed", () => {
		expect(formatCreditAmount(0.01, "en")).toBe("0.01");
		expect(formatCreditAmount(0.87, "en")).toBe("0.87");
		expect(formatCreditAmount(0.1, "en")).toBe("0.1");
		expect(formatCreditAmount(3, "en")).toBe("3");
		expect(formatCreditAmount(20, "en")).toBe("20");
		expect(formatCreditAmount(-0.87, "en")).toBe("-0.87");
	});

	it("never renders raw float dust", () => {
		expect(formatCreditAmount(0.1 + 0.2, "en")).toBe("0.3");
	});
});

describe("formatCreditDelta", () => {
	it("keeps two decimals and an explicit sign", () => {
		expect(formatCreditDelta(-0.39, "en")).toBe("-0.39");
		expect(formatCreditDelta(50, "en")).toBe("+50.00");
		// A zero spend must not read as a gain.
		expect(formatCreditDelta(0, "en")).toBe("0.00");
	});

	it("localizes the decimal separator", () => {
		expect(formatCreditDelta(-0.39, "fr")).toBe("-0,39");
	});
});

describe("creditUnit copy with decimal counts", () => {
	it("selects the plural on the count and renders countDisplay (en)", async () => {
		const dictionary = await getDictionary("en");

		expect(
			translate(
				dictionary,
				"credits.creditUnit",
				{ count: 2.87, countDisplay: formatCreditBalance(2.87, "en") },
				"en",
			),
		).toBe("2.8 credits");
		expect(
			translate(
				dictionary,
				"credits.creditUnit",
				{ count: 1, countDisplay: formatCreditBalance(1, "en") },
				"en",
			),
		).toBe("1.0 credit");
	});

	it("keeps the French singular below two", async () => {
		const dictionary = await getDictionary("fr");

		expect(
			translate(
				dictionary,
				"credits.creditUnit",
				{ count: 0.1, countDisplay: formatCreditAmount(0.1, "fr") },
				"fr",
			),
		).toBe("0,1 crédit");
	});

	it("renders fractional Arabic counts through the other category", async () => {
		const dictionary = await getDictionary("ar");

		expect(
			translate(
				dictionary,
				"credits.creditUnit",
				{ count: 2.5, countDisplay: "2.5" },
				"ar",
			),
		).toBe("2.5 رصيد");
	});

	it("renders seven free credits with the Hermes Arabic plural fallback", async () => {
		const dictionary = await getDictionary("ar");
		const pluralRules = Intl.PluralRules;

		try {
			Object.defineProperty(Intl, "PluralRules", {
				configurable: true,
				value: undefined,
			});

			expect(
				translate(
					dictionary,
					"landing.pricing.free.creditsLine",
					{ count: 7 },
					"ar",
				),
			).toBe("7 أرصدة مجانية");
		} finally {
			Object.defineProperty(Intl, "PluralRules", {
				configurable: true,
				value: pluralRules,
			});
		}
	});

	it("still interpolates the raw count without countDisplay", async () => {
		const dictionary = await getDictionary("en");

		expect(
			translate(dictionary, "credits.creditUnit", { count: 250 }, "en"),
		).toBe("250 credits");
	});
});
