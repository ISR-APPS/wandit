import { describe, expect, it } from "vitest";

import { formatLocalPrice } from "./price-format";

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
