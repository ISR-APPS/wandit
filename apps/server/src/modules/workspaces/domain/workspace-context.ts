/**
 * The workspace scope type of one request, and its personal constant.
 * WorkspaceContextGuard builds it from the header. Controllers read it with
 * @CurrentWorkspace(), and projectScopeFrom turns it into a ProjectScope.
 * The MCP `list_projects` tool builds it from a workspace id with the same rule.
 */
import { type WorkspaceRoleName, workspaceRoleNames } from "@wandit/contracts";

/**
 * Resolved per-request workspace scope. Attached by WorkspaceContextGuard;
 * the ONLY authority is the x-wandit-workspace header — never the Better Auth
 * session's activeOrganizationId (docs/features/teams-workspaces.md §2).
 *
 * Kinds (workspaces-sharing.md 3.1):
 * - `personal`: the caller's own personal workspace (no header, `personal`,
 *   or the id of the caller's own personal org).
 * - `shared-personal`: another user's personal org where the caller is a
 *   member. That owner's personal pool pays, so billing and limits are denied.
 * - `org`: a team workspace where the caller is a member.
 */
export type WorkspaceContext =
	| { kind: "personal" }
	| {
			kind: "shared-personal";
			organizationId: string;
			/** `organization.personal_owner_user_id`: the owner and payer of this workspace. */
			ownerUserId: string;
			/** Raw member.role value — may be a comma-separated multi-role string. */
			role: string;
			/** Parsed known role names from `role`. */
			roles: WorkspaceRoleName[];
	  }
	| {
			kind: "org";
			organizationId: string;
			/** Raw member.role value — may be a comma-separated multi-role string. */
			role: string;
			/** Parsed known role names from `role`. */
			roles: WorkspaceRoleName[];
	  };

export const PERSONAL_WORKSPACE_CONTEXT: WorkspaceContext = {
	kind: "personal",
};

/**
 * Known role names of one raw `member.role` value. Better Auth stores a
 * comma-separated list. An unknown name gives no role, so it gives no right.
 */
export function parseWorkspaceRoles(roleValue: string): WorkspaceRoleName[] {
	const known = new Set<string>(workspaceRoleNames);

	return roleValue
		.split(",")
		.map((name) => name.trim())
		.filter((name): name is WorkspaceRoleName => known.has(name));
}

/**
 * The workspace scope of one membership row of `userId` (workspaces-sharing.md 3.1).
 * WorkspaceContextGuard and the MCP `list_projects` tool call it, so both get the same scope.
 */
export function workspaceContextOfMembership(
	membership: {
		organizationId: string;
		/** Set: a personal workspace and its owner. NULL: a team workspace. */
		personalOwnerUserId: string | null;
		/** Raw member.role value. It may be a comma-separated multi-role string. */
		role: string;
	},
	userId: string,
): WorkspaceContext {
	// The own personal org id is the same scope as no header: the owner's
	// projects keep organization_id NULL and the personal pool pays.
	if (membership.personalOwnerUserId === userId) {
		return PERSONAL_WORKSPACE_CONTEXT;
	}
	const roles = parseWorkspaceRoles(membership.role);
	// Another user's personal workspace: that owner's personal pool pays.
	if (membership.personalOwnerUserId !== null) {
		return {
			kind: "shared-personal",
			organizationId: membership.organizationId,
			ownerUserId: membership.personalOwnerUserId,
			role: membership.role,
			roles,
		};
	}
	return {
		kind: "org",
		organizationId: membership.organizationId,
		role: membership.role,
		roles,
	};
}
