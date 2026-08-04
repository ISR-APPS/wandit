import { describe, expect, it } from "vitest";

import { normalizeAffiliateEmail } from "./affiliate-email";

describe("normalizeAffiliateEmail", () => {
	it("trims and case-folds an ordinary address", () => {
		expect(normalizeAffiliateEmail("  Partner@Example.COM  ")).toBe(
			"partner@example.com",
		);
	});

	it("collapses plus-address aliases for self-referral comparison", () => {
		expect(normalizeAffiliateEmail("Partner+campaign@Example.com")).toBe(
			"partner@example.com",
		);
		expect(normalizeAffiliateEmail("partner+one+two@example.com")).toBe(
			"partner@example.com",
		);
		expect(normalizeAffiliateEmail("partner+offer@company.test")).toBe(
			"partner@company.test",
		);
	});

	it("does not fold dots because that behavior is provider-specific", () => {
		expect(normalizeAffiliateEmail("first.last@example.com")).toBe(
			"first.last@example.com",
		);
		expect(normalizeAffiliateEmail("firstlast@example.com")).toBe(
			"firstlast@example.com",
		);
	});

	it("returns malformed input in its safely normalized form", () => {
		expect(normalizeAffiliateEmail(" NO-AT-SIGN ")).toBe("no-at-sign");
		expect(normalizeAffiliateEmail("@example.com")).toBe("@example.com");
		expect(normalizeAffiliateEmail("partner@")).toBe("partner@");
	});
});
