// Workspace (organization) access control — the single source of truth for
// the v1 role matrix, shared by the Better Auth server plugin, the web
// organizationClient, and the server-side workspace guards.
//
// v1 roles are FIXED (owner/admin/member). Dynamic/custom roles are a later
// batch; the statement shape below is what makes that a config change.
import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access";

export const workspaceStatement = {
	// Better Auth organization defaults: organization, member, invitation, team, ac.
	...defaultStatements,
	// Application resources.
	project: ["create", "update", "delete"],
	publish: ["manage"], // publish / rollback / unpublish
	domain: ["manage"], // attach/verify/primary/detach + buy-with-attach on org projects
	billing: ["manage"], // checkout/topup/change/cancel/resume/portal for the org
	limits: ["manage"], // member credit limits + org billing settings
} as const;

export const workspaceAccessControl = createAccessControl(workspaceStatement);

export const workspaceRoles = {
	owner: workspaceAccessControl.newRole({
		...ownerAc.statements,
		billing: ["manage"],
		domain: ["manage"],
		limits: ["manage"],
		project: ["create", "update", "delete"],
		publish: ["manage"],
	}),
	admin: workspaceAccessControl.newRole({
		// adminAc = owner minus organization:delete (which is disabled anyway).
		...adminAc.statements,
		// NO billing: money (checkout/changes/cancel/portal/top-ups) is
		// owner-only — Zack's explicit product decision (2026-08-03). It also
		// structurally removes the "who pays" ambiguity from commissions.
		domain: ["manage"],
		limits: ["manage"],
		project: ["create", "update", "delete"],
		publish: ["manage"],
	}),
	member: workspaceAccessControl.newRole({
		...memberAc.statements,
		// Members can build and ship (publish is the core product loop) but
		// cannot delete projects or touch domains/billing/members/limits.
		project: ["create", "update"],
		publish: ["manage"],
	}),
};

export type WorkspaceRoleName = keyof typeof workspaceRoles;

export type WorkspacePermissionRequest = {
	[K in keyof typeof workspaceStatement]?: readonly (typeof workspaceStatement)[K][number][];
};

/**
 * Server-side permission check for a member row's role value.
 *
 * `member.role` is a comma-separated multi-role string in better-auth 1.6.22
 * (organization.mjs parseRoles) — NEVER compare it with string equality. A
 * request passes if ANY of the member's roles grants ALL requested actions,
 * matching the plugin's own hasPermission semantics.
 */
export function workspaceRoleHasPermission(
	roleValue: string,
	permissions: WorkspacePermissionRequest,
): boolean {
	const roleNames = roleValue
		.split(",")
		.map((name) => name.trim())
		.filter(Boolean);

	return roleNames.some((name) => {
		const role = workspaceRoles[name as WorkspaceRoleName];
		if (!role) return false;
		return role.authorize(permissions as never).success;
	});
}
