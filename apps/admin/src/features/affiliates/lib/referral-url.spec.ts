import { describe, expect, it } from "vitest";

import { buildReferralUrl, WEB_APP_ORIGIN } from "./referral-url";

describe("referral URL builder", () => {
	it("builds a URL for the root path", () => {
		expect(WEB_APP_ORIGIN).toBe("https://wandit.dev");
		expect(buildReferralUrl("/", "partner")).toBe(
			"https://wandit.dev/?ref=partner",
		);
	});

	it("builds a URL for a deeper path", () => {
		expect(buildReferralUrl("/pricing", "partner")).toBe(
			"https://wandit.dev/pricing?ref=partner",
		);
	});

	it("appends the referral code to an existing query string", () => {
		expect(buildReferralUrl("/pricing?plan=annual", "partner")).toBe(
			"https://wandit.dev/pricing?plan=annual&ref=partner",
		);
	});

	it("URI-encodes the referral code", () => {
		expect(buildReferralUrl("/", "partner north/50%")).toBe(
			"https://wandit.dev/?ref=partner%20north%2F50%25",
		);
	});

	it("normalizes empty and whitespace-only paths to the root path", () => {
		expect(buildReferralUrl("", "partner")).toBe(
			"https://wandit.dev/?ref=partner",
		);
		expect(buildReferralUrl("   ", "partner")).toBe(
			"https://wandit.dev/?ref=partner",
		);
	});

	it("adds a missing leading slash", () => {
		expect(buildReferralUrl("pricing", "partner")).toBe(
			"https://wandit.dev/pricing?ref=partner",
		);
	});
});
