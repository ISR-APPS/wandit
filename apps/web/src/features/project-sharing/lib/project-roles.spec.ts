import type { ProjectAccess, ProjectRole } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { canManageGrant, hasProjectRole } from "./project-roles";

function accessWith(role: ProjectRole): ProjectAccess {
	return {
		role,
		workspaceAccess: "can_edit",
		workspace: { id: "org-1", name: "Acme", kind: "team" },
	};
}

describe("hasProjectRole", () => {
	it.each<[ProjectAccess | undefined, ProjectRole, boolean]>([
		// An older API sends no access: full access, as before sharing.
		[undefined, "owner", true],
		[accessWith("viewer"), "viewer", true],
		[accessWith("viewer"), "editor", false],
		[accessWith("editor"), "editor", true],
		[accessWith("editor"), "admin", false],
		[accessWith("admin"), "owner", false],
		[accessWith("owner"), "admin", true],
	])("access %o needs %s: %s", (access, needed, expected) => {
		expect(hasProjectRole(access, needed)).toBe(expected);
	});
});

describe("canManageGrant", () => {
	it.each<[ProjectRole, "admin" | "editor" | "viewer", boolean]>([
		["viewer", "viewer", false],
		["editor", "viewer", true],
		["editor", "editor", true],
		// An editor never changes or removes an admin grant.
		["editor", "admin", false],
		["admin", "admin", true],
		["owner", "admin", true],
	])("%s manages a %s grant: %s", (callerRole, grantRole, expected) => {
		expect(canManageGrant(callerRole, grantRole)).toBe(expected);
	});
});
