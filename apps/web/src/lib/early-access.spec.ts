import { describe, expect, it } from "vitest";

import { isEarlyAccessUser } from "./early-access";

describe("isEarlyAccessUser", () => {
	it("allows users with the persisted early-access grant", () => {
		expect(isEarlyAccessUser({ earlyAccess: true, role: "user" })).toBe(true);
	});

	it("allows admins, including comma-separated role values", () => {
		expect(isEarlyAccessUser({ earlyAccess: false, role: "user,admin" })).toBe(
			true,
		);
	});

	it("rejects users without a grant or admin role", () => {
		expect(isEarlyAccessUser({ earlyAccess: false, role: "user" })).toBe(false);
		expect(isEarlyAccessUser(null)).toBe(false);
	});
});
