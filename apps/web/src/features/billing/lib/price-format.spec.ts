import { STARTER_PASS_USD } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { formatLocalPrice, formatUsdAndDzd } from "./price-format";

describe("formatLocalPrice", () => {
	// fr-FR separates groups with U+202F and the currency code with U+00A0.
	it.each([
		{ locale: "en", priceUsd: 25, rate: null, expected: "$25" },
		{ locale: "en", priceUsd: 7.5, rate: null, expected: "$7.50" },
		{ locale: "en", priceUsd: 25, rate: 270, expected: "6 750 DZD" },
		{ locale: "ar", priceUsd: 25, rate: 270, expected: "6 750 DZD" },
		{
			locale: "fr",
			priceUsd: 7.5,
			rate: 270.33,
			expected: "2 027 DZD",
		},
	] as const)("formats $priceUsd USD for $locale at rate $rate as $expected", ({
		locale,
		priceUsd,
		rate,
		expected,
	}) => {
		expect(formatLocalPrice(priceUsd, locale, rate)).toBe(expected);
	});
});

describe("formatUsdAndDzd", () => {
	// The DZD part uses fr-FR in every locale: U+202F between groups, U+00A0 before the code.
	it.each([
		{ locale: "en", priceUsd: 20, rate: null, expected: "$20" },
		{ locale: "en", priceUsd: 20, rate: 250, expected: "$20 · 5 000 DZD" },
		{
			locale: "en",
			priceUsd: STARTER_PASS_USD,
			rate: 250,
			expected: "$1 · 250 DZD",
		},
	] as const)("formats $priceUsd USD for $locale at rate $rate as $expected", ({
		locale,
		priceUsd,
		rate,
		expected,
	}) => {
		expect(formatUsdAndDzd(priceUsd, locale, rate)).toBe(expected);
	});
});
