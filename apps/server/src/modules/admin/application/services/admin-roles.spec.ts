import {
	isAdminRole,
	isStaffRole,
	normalizeStoredRole,
	parseStoredRoles,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

describe("stored platform role helpers", () => {
	it("parses comma-joined roles case-insensitively", () => {
		expect(parseStoredRoles(" user, SUPPORT ,,Admin ")).toEqual([
			"user",
			"support",
			"admin",
		]);
		expect(parseStoredRoles(null)).toEqual([]);
		expect(parseStoredRoles(undefined)).toEqual([]);
	});

	it("recognizes admin in any stored role component", () => {
		expect(isAdminRole("user, ADMIN ")).toBe(true);
		expect(isAdminRole("support")).toBe(false);
		expect(isAdminRole("superadmin")).toBe(false);
	});

	it("recognizes support and admin as staff", () => {
		expect(isStaffRole("support")).toBe(true);
		expect(isStaffRole("user,Admin")).toBe(true);
		expect(isStaffRole("user")).toBe(false);
		expect(isStaffRole("")).toBe(false);
	});

	it("normalizes to the highest known platform role", () => {
		expect(normalizeStoredRole("user,support,admin")).toBe("admin");
		expect(normalizeStoredRole("unknown, SUPPORT ")).toBe("support");
		expect(normalizeStoredRole("unknown,user")).toBe("user");
		expect(normalizeStoredRole(undefined)).toBe("user");
	});
});
