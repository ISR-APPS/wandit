/**
 * Workspace role rules of the web: parse a Better Auth role value, pick the
 * highest role for its label, and list the roles a caller may grant.
 * The switcher and the People page call them. The server enforces the same
 * rules (workspaces-sharing.md 2.1); these only hide actions it would refuse.
 */
import {
	type WorkspaceKind,
	type WorkspaceRoleName,
	workspaceRoleNameSchema,
	workspaceRoleNames,
} from "@wandit/contracts";

/**
 * Parses `member.role` or `invitation.role` from Better Auth. The value can be
 * a comma-separated list (better-auth 1.6). Unknown names are left out.
 */
export function parseWorkspaceRoles(roleValue: string): WorkspaceRoleName[] {
	return roleValue.split(",").flatMap((name) => {
		const parsed = workspaceRoleNameSchema.safeParse(name.trim());

		return parsed.success ? [parsed.data] : [];
	});
}

/** The role a label shows: owner, then admin, then member (Editor), then viewer. Null when the list is empty. */
export function highestWorkspaceRole(
	roles: readonly WorkspaceRoleName[],
): WorkspaceRoleName | null {
	return workspaceRoleNames.find((role) => roles.includes(role)) ?? null;
}

/**
 * Roles the caller may send in an invitation or set on a member, highest first.
 * Empty for a viewer: a viewer cannot invite.
 */
export function grantableWorkspaceRoles(
	callerRoles: readonly WorkspaceRoleName[],
	workspaceKind: WorkspaceKind,
): WorkspaceRoleName[] {
	// A personal workspace has exactly one owner, so nobody grants `owner` there.
	if (callerRoles.includes("owner") && workspaceKind === "team") {
		return ["owner", "admin", "member", "viewer"];
	}

	if (callerRoles.includes("owner") || callerRoles.includes("admin")) {
		return ["admin", "member", "viewer"];
	}

	// Editors invite only viewers (workspaces-sharing.md 2.1).
	if (callerRoles.includes("member")) {
		return ["viewer"];
	}

	return [];
}
