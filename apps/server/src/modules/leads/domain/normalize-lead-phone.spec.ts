import { describe, expect, it } from "vitest";
import { foldArabicDigits, normalizeLeadPhone } from "./normalize-lead-phone";

describe("foldArabicDigits", () => {
	it("folds Arabic-Indic and Eastern Arabic-Indic digits to ASCII", () => {
		expect(foldArabicDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
		expect(foldArabicDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
		expect(foldArabicDigits("05 40 ٧٧ ٣١ ٠٢")).toBe("05 40 77 31 02");
	});
});

describe("normalizeLeadPhone", () => {
	it("maps the local 0 prefix onto +213", () => {
		expect(normalizeLeadPhone("0540773102")).toBe("+213540773102");
	});

	it("maps international 00213 dialing onto +213", () => {
		expect(normalizeLeadPhone("00213540773102")).toBe("+213540773102");
	});

	it("keeps an already canonical number", () => {
		expect(normalizeLeadPhone("+213540773102")).toBe("+213540773102");
	});

	it("strips the separators people actually type", () => {
		expect(normalizeLeadPhone("05 40-77.31/02")).toBe("+213540773102");
		expect(normalizeLeadPhone("(0) 540 773 102")).toBe("+213540773102");
	});

	it("normalizes Arabic-Indic digits", () => {
		expect(normalizeLeadPhone("٠٥٤٠٧٧٣١٠٢")).toBe("+213540773102");
	});

	it("accepts a bare mobile without the trunk 0", () => {
		expect(normalizeLeadPhone("540773102")).toBe("+213540773102");
		expect(normalizeLeadPhone("661234567")).toBe("+213661234567");
	});

	it("accepts foreign numbers — pages serve any market", () => {
		expect(normalizeLeadPhone("+33612345678")).toBe("+33612345678");
		expect(normalizeLeadPhone("0033612345678")).toBe("+33612345678");
	});

	// A national number takes the calling code of the page's market chip, not +213.
	it.each([
		{ dialCode: "964", expected: "+9647701234567", raw: "07701234567" },
		{ dialCode: "964", expected: "+9647701234567", raw: "9647701234567" },
		{ dialCode: "225", expected: "+2250701234567", raw: "0701234567" },
		{ dialCode: "216", expected: "+21620123456", raw: "20 123 456" },
		{ dialCode: "213", expected: "+213612345678", raw: "0612345678" },
		{ dialCode: "213", expected: null, raw: "05407731" },
		{ dialCode: "964", expected: null, raw: "07701234" },
		{ dialCode: "964", expected: "+33612345678", raw: "+33612345678" },
		{ dialCode: "999", expected: "+213540773102", raw: "0540773102" },
	])("uses market dial code $dialCode for $raw", ({
		dialCode,
		expected,
		raw,
	}) => {
		expect(normalizeLeadPhone(raw, dialCode)).toBe(expected);
	});

	it("rejects things that are not phone numbers", () => {
		expect(normalizeLeadPhone("call me maybe")).toBeNull();
		expect(normalizeLeadPhone("054077")).toBeNull();
		expect(normalizeLeadPhone("+0540773102")).toBeNull();
		expect(normalizeLeadPhone("12345")).toBeNull();
		expect(normalizeLeadPhone("+2135407731021234567")).toBeNull();
	});
});
