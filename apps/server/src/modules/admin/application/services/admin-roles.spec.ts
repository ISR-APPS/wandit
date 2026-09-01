import {
	adminSetAdminViewsInputSchema,
	adminSetRoleInputSchema,
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

describe("admin role input contracts", () => {
	it("accepts a valid admin view grant set", () => {
		expect(
			adminSetAdminViewsInputSchema.safeParse({
				views: ["overview", "academy"],
			}).success,
		).toBe(true);
	});

	it.each([
		{ views: [] },
		{ views: ["unknown"] },
	])("rejects invalid admin view grants: $views", (input) => {
		expect(adminSetAdminViewsInputSchema.safeParse(input).success).toBe(false);
	});

	it.each([
		{ role: "support" },
		{ role: "support", views: ["users", "academy"] },
	])("accepts support role input: $role $views", (input) => {
		expect(adminSetRoleInputSchema.safeParse(input).success).toBe(true);
	});

	it.each([
		{ role: "admin", views: ["overview"] },
		{ role: "user", views: ["overview"] },
	])("rejects views for the $role role", (input) => {
		expect(adminSetRoleInputSchema.safeParse(input).success).toBe(false);
	});
});
