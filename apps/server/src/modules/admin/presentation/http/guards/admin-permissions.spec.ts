import {
	type AdminPermissionRequest,
	adminAccessControl,
	adminRoleHasPermission,
	adminRoles,
	adminStatement,
	adminViews,
	defaultSupportViews,
	staffHasPermission,
	supportStatementsForViews,
	supportViewActions,
} from "@wandit/auth/admin-permissions";
import { adminViewValues } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const expectedPermissionMatrix = [
	{ action: "read", admin: true, resource: "overview", support: true },
	{ action: "read", admin: true, resource: "users", support: true },
	{
		action: "grant-credits",
		admin: true,
		resource: "users",
		support: false,
	},
	{ action: "ban", admin: true, resource: "users", support: true },
	{ action: "set-role", admin: true, resource: "users", support: false },
	{
		action: "read",
		admin: true,
		resource: "organizations",
		support: true,
	},
	{
		action: "manage",
		admin: true,
		resource: "organizations",
		support: false,
	},
	{ action: "read", admin: true, resource: "billing", support: true },
	{ action: "manage", admin: true, resource: "billing", support: false },
	{
		action: "read",
		admin: true,
		resource: "publications",
		support: true,
	},
	{ action: "read", admin: true, resource: "feedback", support: true },
	{ action: "manage", admin: true, resource: "feedback", support: true },
	{ action: "read", admin: true, resource: "affiliates", support: false },
	{
		action: "manage",
		admin: true,
		resource: "affiliates",
		support: false,
	},
	{ action: "read", admin: true, resource: "links", support: true },
	{ action: "manage", admin: true, resource: "links", support: false },
	{ action: "read", admin: true, resource: "costs", support: false },
	{ action: "manage", admin: true, resource: "costs", support: false },
	{ action: "read", admin: true, resource: "academy", support: true },
	{ action: "manage", admin: true, resource: "academy", support: false },
	{ action: "read", admin: true, resource: "analytics", support: false },
	{ action: "manage", admin: true, resource: "analytics", support: false },
	{ action: "read", admin: true, resource: "conversations", support: false },
	{
		action: "read-raw",
		admin: true,
		resource: "conversations",
		support: false,
	},
	{ action: "read", admin: true, resource: "settings", support: false },
	{ action: "manage", admin: true, resource: "settings", support: false },
] as const;

function singlePermission(
	resource: keyof typeof adminStatement,
	action: string,
): AdminPermissionRequest {
	return { [resource]: [action] } as AdminPermissionRequest;
}

describe("admin dashboard permission matrix", () => {
	it("keeps contract views, statement resources, and support actions complete", () => {
		expect(adminViewValues).toEqual(Object.keys(adminStatement));
		expect(adminViews).toEqual(Object.keys(adminStatement));
		expect(supportViewActions).toEqual({
			academy: ["read"],
			affiliates: ["read"],
			analytics: ["read"],
			billing: ["read"],
			conversations: ["read"],
			costs: ["read"],
			feedback: ["read", "manage"],
			links: ["read"],
			organizations: ["read"],
			overview: ["read"],
			publications: ["read"],
			settings: ["read"],
			users: ["read", "ban"],
		});
		expect(defaultSupportViews).toEqual([
			"overview",
			"users",
			"organizations",
			"billing",
			"publications",
			"feedback",
			"links",
			"academy",
		]);
		expect(defaultSupportViews.every((view) => adminViews.includes(view))).toBe(
			true,
		);
	});

	it("grants admin every declared action and support exactly its configured set", () => {
		const actualPermissionMatrix = Object.entries(adminStatement).flatMap(
			([resource, actions]) =>
				actions.map((action) => ({
					action,
					admin: adminRoleHasPermission(
						"admin",
						singlePermission(resource as keyof typeof adminStatement, action),
					),
					resource,
					support: adminRoleHasPermission(
						"support",
						singlePermission(resource as keyof typeof adminStatement, action),
					),
				})),
		);

		expect(actualPermissionMatrix).toEqual(expectedPermissionMatrix);
		expect(adminRoles.admin.statements).toEqual(adminStatement);
		expect(adminRoles.support.statements).toEqual({
			academy: ["read"],
			billing: ["read"],
			feedback: ["read", "manage"],
			links: ["read"],
			organizations: ["read"],
			overview: ["read"],
			publications: ["read"],
			users: ["read", "ban"],
		});
	});

	it("derives the support role from the default view statement builder", () => {
		const derived = adminAccessControl.newRole(
			supportStatementsForViews(defaultSupportViews),
		);
		const probes = [
			{ overview: ["read"] },
			{ users: ["ban"] },
			{ users: ["set-role"] },
			{ feedback: ["manage"] },
			{ conversations: ["read"] },
		] as const satisfies readonly AdminPermissionRequest[];

		for (const probe of probes) {
			expect(adminRoles.support.authorize(probe).success).toBe(
				derived.authorize(probe).success,
			);
		}
	});

	it("allows a permission granted by any comma-joined stored role", () => {
		expect(adminRoleHasPermission("user,support", { users: ["read"] })).toBe(
			true,
		);
	});

	it("rejects actions the stored role does not grant", () => {
		expect(adminRoleHasPermission("support", { users: ["set-role"] })).toBe(
			false,
		);
	});

	it.each([
		"unknown",
		"",
		undefined,
		null,
	])("rejects an absent or unknown role value (%s)", (role) => {
		expect(adminRoleHasPermission(role, { users: ["read"] })).toBe(false);
	});

	it("requires one role to grant every requested action", () => {
		expect(
			adminRoleHasPermission("user,support", {
				users: ["read", "set-role"],
			}),
		).toBe(false);
		expect(adminRoleHasPermission("support", { users: ["read", "ban"] })).toBe(
			true,
		);
	});
});

describe("staffHasPermission", () => {
	it("allows a support action on a granted view", () => {
		expect(staffHasPermission("support", ["users"], { users: ["ban"] })).toBe(
			true,
		);
	});

	it("rejects an ungranted support view", () => {
		expect(
			staffHasPermission("support", ["users"], { feedback: ["read"] }),
		).toBe(false);
	});

	it("rejects an action outside the granted view's support action set", () => {
		expect(
			staffHasPermission("support", ["users"], { users: ["set-role"] }),
		).toBe(false);
	});

	it.each([null, []])("lets admins ignore a %j view set", (views) => {
		expect(staffHasPermission("admin", views, { settings: ["manage"] })).toBe(
			true,
		);
	});

	it("recognizes comma-joined support and defaults a missing grants row", () => {
		expect(
			staffHasPermission("user,support", null, { overview: ["read"] }),
		).toBe(true);
		expect(
			staffHasPermission("user,support", null, {
				conversations: ["read"],
			}),
		).toBe(false);
	});
});
