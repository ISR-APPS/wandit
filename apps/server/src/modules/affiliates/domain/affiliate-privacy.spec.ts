import { describe, expect, it } from "vitest";

import {
	maskAffiliateEmail,
	toPortalReversalReason,
} from "./affiliate-privacy";

describe("maskAffiliateEmail", () => {
	it("keeps only the first local-part character and the full domain", () => {
		expect(maskAffiliateEmail("john.doe+x@gmail.com")).toBe("j***@gmail.com");
		expect(maskAffiliateEmail("a@b.co")).toBe("***@b.co");
	});

	it("handles astral characters without splitting their surrogate pairs", () => {
		expect(maskAffiliateEmail("😀partner@example.com")).toBe(
			"😀***@example.com",
		);
		expect(maskAffiliateEmail("😀@example.com")).toBe("***@example.com");
	});

	it("trims and lower-cases the address before masking it", () => {
		expect(maskAffiliateEmail("  Partner@Example.COM  ")).toBe(
			"p***@example.com",
		);
	});

	it("returns a fully masked value when the address is malformed", () => {
		expect(maskAffiliateEmail("no-at-sign")).toBe("***");
		expect(maskAffiliateEmail("@example.com")).toBe("***");
		expect(maskAffiliateEmail("partner@")).toBe("***");
	});
});

describe("toPortalReversalReason", () => {
	it.each([
		[null, null],
		["charge_refunded", "charge_refunded"],
		["charge_refunded:re_123", "charge_refunded"],
		["charge_dispute_created", "charge_dispute_created"],
		["dispute_won:dp_123", "dispute_won"],
		["dispute_lost:dp_456", "dispute_closed"],
		["dispute_warning_closed", "dispute_closed"],
		["unknown_reason", null],
		["", null],
	] as const)("maps %s to %s", (raw, expected) => {
		expect(toPortalReversalReason(raw)).toBe(expected);
	});
});
