import { describe, expect, it } from "vitest";

import { hasAdminPermission, sessionRoleLabel } from "./permissions";

describe("admin session permissions", () => {
	it("checks the shared permission matrix", () => {
		expect(hasAdminPermission("support", { users: ["read"] })).toBe(true);
		expect(hasAdminPermission("support", { users: ["set-role"] })).toBe(false);
		expect(hasAdminPermission("user,support", { academy: ["read"] })).toBe(
			true,
		);
		expect(hasAdminPermission("user", { overview: ["read"] })).toBe(false);
		expect(hasAdminPermission(undefined, { overview: ["read"] })).toBe(false);
	});

	it("labels the highest stored platform role", () => {
		expect(sessionRoleLabel("user")).toBe("User");
		expect(sessionRoleLabel("support,user")).toBe("Support");
		expect(sessionRoleLabel("support,admin")).toBe("Admin");
		expect(sessionRoleLabel("unknown")).toBe("User");
	});
});
