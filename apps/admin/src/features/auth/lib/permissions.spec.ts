import { describe, expect, it } from "vitest";

import {
	canGrantCreditsToTarget,
	hasAdminPermission,
	permissionMapAllows,
	sessionRoleLabel,
} from "./permissions";

describe("canGrantCreditsToTarget", () => {
	it("hides a support grant to the support account's own user or org", () => {
		expect(canGrantCreditsToTarget("support", true)).toBe(false);
		expect(canGrantCreditsToTarget("user,support", true)).toBe(false);
		expect(canGrantCreditsToTarget("support", false)).toBe(true);
	});

	it("allows an admin grant to the admin's own account", () => {
		expect(canGrantCreditsToTarget("user,admin", true)).toBe(true);
	});
});

describe("admin session permissions", () => {
	it("checks the shared permission matrix", () => {
		expect(hasAdminPermission("support", { users: ["read"] })).toBe(true);
		expect(hasAdminPermission("support", { users: ["set-role"] })).toBe(false);
		expect(hasAdminPermission("user,support", { academy: ["read"] })).toBe(
			true,
		);
		expect(hasAdminPermission("support", { billing: ["update-request"] })).toBe(
			true,
		);
		expect(hasAdminPermission("support", { billing: ["manage"] })).toBe(false);
		expect(hasAdminPermission("user", { overview: ["read"] })).toBe(false);
		expect(hasAdminPermission(undefined, { overview: ["read"] })).toBe(false);
	});

	it("labels the highest stored platform role", () => {
		expect(sessionRoleLabel("user")).toBe("User");
		expect(sessionRoleLabel("support,user")).toBe("Support");
		expect(sessionRoleLabel("support,admin")).toBe("Admin");
		expect(sessionRoleLabel("unknown")).toBe("User");
	});

	it("requires every requested action in an effective permission map", () => {
		const map = {
			users: ["read", "ban"],
			feedback: ["read", "manage"],
		};

		expect(permissionMapAllows(map, { users: ["read"] })).toBe(true);
		expect(
			permissionMapAllows(map, {
				users: ["read", "ban"],
				feedback: ["manage"],
			}),
		).toBe(true);
		expect(permissionMapAllows(map, { users: ["set-role"] })).toBe(false);
		expect(permissionMapAllows(map, { overview: ["read"] })).toBe(false);
		expect(permissionMapAllows(null, { users: ["read"] })).toBe(false);
	});
});
