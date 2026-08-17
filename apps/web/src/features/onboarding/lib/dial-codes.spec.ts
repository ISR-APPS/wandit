import { describe, expect, it } from "vitest";

import {
	composePhoneAnswer,
	dialCountries,
	dialCountryDisplayName,
	foldArabicDigits,
	getDialCountry,
	internationalDigitsOf,
	isCompletePhoneAnswer,
	splitPhoneAnswer,
} from "./dial-codes";

function mustGetDialCountry(iso: string) {
	const country = getDialCountry(iso);
	if (!country) throw new Error(`Missing dial country ${iso}`);
	return country;
}

describe("dial country data", () => {
	it("keeps ISO codes unique and dial codes well-formed", () => {
		const isoCodes = dialCountries.map(({ iso }) => iso);
		expect(new Set(isoCodes).size).toBe(isoCodes.length);

		for (const { iso, dial } of dialCountries) {
			expect(iso).toMatch(/^[A-Z]{2}$/);
			expect(dial).toMatch(/^[1-9][0-9]{0,3}$/);
		}
	});

	it("localizes country names through Intl", () => {
		expect(dialCountryDisplayName("DZ", "en")).toBe("Algeria");
		expect(dialCountryDisplayName("DZ", "fr")).toBe("Algérie");
		expect(dialCountryDisplayName("DZ", "ar")).toBe("الجزائر");
	});
});

describe("composePhoneAnswer", () => {
	it("builds E.164 from national digits", () => {
		const dz = mustGetDialCountry("DZ");
		expect(composePhoneAnswer(dz, "661 22 33 44")).toBe("+213661223344");
	});

	it("drops the habitual trunk zero", () => {
		const dz = mustGetDialCountry("DZ");
		expect(composePhoneAnswer(dz, "0661223344")).toBe("+213661223344");
	});

	it("keeps the leading zero for Italy", () => {
		const it_ = mustGetDialCountry("IT");
		expect(composePhoneAnswer(it_, "06 6982 1234")).toBe("+390669821234");
	});

	it("folds Arabic-Indic digits", () => {
		const dz = mustGetDialCountry("DZ");
		expect(foldArabicDigits("٠٦٦١")).toBe("0661");
		expect(composePhoneAnswer(dz, "٦٦١٢٢٣٣٤٤")).toBe("+213661223344");
	});

	it("returns an empty answer while no digits are typed", () => {
		const dz = mustGetDialCountry("DZ");
		expect(composePhoneAnswer(dz, "")).toBe("");
		expect(composePhoneAnswer(dz, "  ")).toBe("");
	});
});

describe("isCompletePhoneAnswer", () => {
	it("accepts full E.164 and rejects partial or local forms", () => {
		expect(isCompletePhoneAnswer("+213661223344")).toBe(true);
		expect(isCompletePhoneAnswer("+2136")).toBe(false);
		expect(isCompletePhoneAnswer("0661223344")).toBe(false);
		expect(isCompletePhoneAnswer("")).toBe(false);
	});
});

describe("internationalDigitsOf", () => {
	it("recognizes + and 00 prefixed input, with separators", () => {
		expect(internationalDigitsOf("+213 661 22 33 44")).toBe("213661223344");
		expect(internationalDigitsOf("00213-661.22(33)44")).toBe("213661223344");
		expect(internationalDigitsOf("+1 (212) 555-1234")).toBe("12125551234");
	});

	it("returns undefined for national input", () => {
		expect(internationalDigitsOf("0661 22 33 44")).toBeUndefined();
		expect(internationalDigitsOf("661223344")).toBeUndefined();
		expect(internationalDigitsOf("")).toBeUndefined();
	});

	it("routes a pasted international number to the right country", () => {
		// The step feeds this result to splitPhoneAnswer, so a user who pastes
		// a full number never gets the picked dial code prepended twice.
		const digits = internationalDigitsOf("+33 6 12 34 56 78");
		expect(digits).toBe("33612345678");
		expect(splitPhoneAnswer(`+${digits}`)).toEqual({
			country: getDialCountry("FR"),
			national: "612345678",
		});
	});
});

describe("splitPhoneAnswer", () => {
	it("round-trips a composed answer", () => {
		const dz = mustGetDialCountry("DZ");
		const answer = composePhoneAnswer(dz, "661223344");
		expect(splitPhoneAnswer(answer)).toEqual({
			country: dz,
			national: "661223344",
		});
	});

	it("prefers the longest dial-code match", () => {
		// +212 is Morocco, not +21 (unassigned) or +2 — and +1242 must not
		// split as a US area code plus garbage, "1" is simply the longest match.
		expect(splitPhoneAnswer("+212612345678")?.country.iso).toBe("MA");
		expect(splitPhoneAnswer("+3931234567")?.country.iso).toBe("IT");
	});

	it("resolves shared dial codes to their conventional owner", () => {
		expect(splitPhoneAnswer("+12025550123")?.country.iso).toBe("US");
		expect(splitPhoneAnswer("+79261234567")?.country.iso).toBe("RU");
		expect(splitPhoneAnswer("+442071234567")?.country.iso).toBe("GB");
	});

	it("rejects values that are not international numbers", () => {
		expect(splitPhoneAnswer("0661223344")).toBeUndefined();
		expect(splitPhoneAnswer("+999123")).toBeUndefined();
	});
});
