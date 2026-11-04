/**
 * UI rules of the project roles (workspaces-sharing.md 2.2). The builder panels,
 * the project card menu, and the Share dialog read them. The API enforces the
 * same rules; these only hide actions that the API refuses.
 */
import type {
	ProjectAccess,
	ProjectMemberRole,
	ProjectRole,
} from "@wandit/contracts";

/** Rank of each effective project role, lowest first. */
const PROJECT_ROLE_RANK = {
	viewer: 0,
	editor: 1,
	admin: 2,
	owner: 3,
} as const satisfies Record<ProjectRole, number>;

/** True when `role` is `needed` or higher. */
export function isRoleAtLeast(role: ProjectRole, needed: ProjectRole): boolean {
	return PROJECT_ROLE_RANK[role] >= PROJECT_ROLE_RANK[needed];
}

/**
 * True when `access` gives the `needed` role or higher. An older API sends no
 * `access`: the UI then gives full access, as before sharing existed.
 */
export function hasProjectRole(
	access: ProjectAccess | undefined,
	needed: ProjectRole,
): boolean {
	return access === undefined || isRoleAtLeast(access.role, needed);
}

/**
 * True when a caller with `callerRole` can change or remove a direct grant
 * with `grantRole`. An editor manages only editor and viewer grants.
 */
export function canManageGrant(
	callerRole: ProjectRole,
	grantRole: ProjectMemberRole,
): boolean {
	return isRoleAtLeast(callerRole, grantRole === "admin" ? "admin" : "editor");
}
