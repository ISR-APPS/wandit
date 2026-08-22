import { describe, expect, it } from "vitest";

import { findExactEmailUser, isValidAffiliateEmail } from "./user-matching";

const users = [
	{ id: "one", email: "nadia@example.com" },
	{ id: "two", email: "nadia.studio@example.com" },
];

describe("affiliate user matching", () => {
	it("finds an exact email without case or surrounding whitespace", () => {
		expect(findExactEmailUser(users, " NADIA@EXAMPLE.COM ")).toEqual(users[0]);
	});

	it("does not treat a partial email match as exact", () => {
		expect(findExactEmailUser(users, "nadia")).toBeUndefined();
		expect(findExactEmailUser(users, "   ")).toBeUndefined();
	});

	it("uses the affiliate contract to recognize valid email addresses", () => {
		expect(isValidAffiliateEmail(" partner@example.com ")).toBe(true);
		expect(isValidAffiliateEmail("partner-at-example.com")).toBe(false);
	});
});
