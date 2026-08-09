import type { WorkspaceRoleName } from "@wandit/contracts";

/**
 * Resolved per-request workspace scope. Attached by WorkspaceContextGuard;
 * the ONLY authority is the x-wandit-workspace header — never the Better Auth
 * session's activeOrganizationId (docs/features/teams-workspaces.md §2).
 */
export type WorkspaceContext =
	| { kind: "personal" }
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

export function workspaceOrganizationId(
	workspace: WorkspaceContext,
): string | null {
	return workspace.kind === "org" ? workspace.organizationId : null;
}
