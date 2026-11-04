/**
 * Pure workspace membership rules of workspaces-sharing.md 2.1.
 * The Better Auth hooks in `index.ts` call them before the organization plugin writes a row.
 * This file reads no database and no env, so the server specs test it alone.
 */

/** Slug prefix of every personal workspace. `WorkspacesService` writes it; the hooks refuse it from users. */
export const PERSONAL_WORKSPACE_SLUG_PREFIX = "personal-";

/** Days until a workspace email invitation expires. Better Auth and the invitation email both read it. */
export const WORKSPACE_INVITATION_EXPIRES_IN_DAYS = 30;

/** The kind of one organization row. `ownerUserId` is `organization.personal_owner_user_id`. */
export type WorkspaceKindFacts =
	| { kind: "team" }
	| { kind: "personal"; ownerUserId: string };

/** Why a hook refuses a request. The hook turns it into a Better Auth `APIError`. */
export type WorkspaceRuleRefusal = {
	code: "WORKSPACE_PERMISSION_DENIED" | "ORGANIZATIONS_DISABLED";
	message: string;
};

/** The facts that `/organization/invite-member` needs. The hook reads them before the plugin runs. */
export type WorkspaceInviteFacts = {
	workspace: WorkspaceKindFacts;
	callerUserId: string;
	/** Roles of the caller's `member` row, split on commas. */
	callerRoles: string[];
	/** Roles in the request body, split on commas. */
	requestedRoles: string[];
	/** The body flag that makes Better Auth extend a pending invitation and send it again. */
	resend: boolean;
	/** True when the email has a pending invitation that is not expired in this workspace. */
	hasPendingInvitation: boolean;
	/** The `organizationsEnabled` product setting. */
	organizationsEnabled: boolean;
};

/**
 * Splits a Better Auth role value ("admin,member" or an array) into role names.
 * Same rule as the plugin's own parser, so both see the same roles.
 */
export function splitWorkspaceRoles(roleValue: string | string[]): string[] {
	return (Array.isArray(roleValue) ? roleValue : [roleValue])
		.flatMap((role) => role.split(","))
		.map((role) => role.trim())
		.filter((role) => role.length > 0);
}

/**
 * Decides if a workspace email invitation may go out. Null means allowed.
 * It must run before the plugin, because the plugin cancels or resends a pending invitation first.
 */
export function workspaceInviteRefusal(
	facts: WorkspaceInviteFacts,
): WorkspaceRuleRefusal | null {
	// The toggle stops new collaboration in personal workspaces (workspaces-sharing.md 3.4).
	if (facts.workspace.kind === "personal" && !facts.organizationsEnabled) {
		return {
			code: "ORGANIZATIONS_DISABLED",
			message: "Workspaces are disabled",
		};
	}

	// In a personal workspace only the personal owner has owner power, never a stray owner row.
	const callerIsOwner =
		facts.callerRoles.includes("owner") &&
		(facts.workspace.kind === "team" ||
			facts.callerUserId === facts.workspace.ownerUserId);

	// A personal workspace has exactly one owner. A team owner comes only from another owner.
	if (
		facts.requestedRoles.includes("owner") &&
		(!callerIsOwner || facts.workspace.kind === "personal")
	) {
		return {
			code: "WORKSPACE_PERMISSION_DENIED",
			message: "Only an owner can invite an owner to a team workspace",
		};
	}

	if (callerIsOwner || facts.callerRoles.includes("admin")) {
		return null;
	}

	// Editors invite viewers only. They cannot resend or replace an invitation of a manager.
	if (
		!isViewerOnly(facts.requestedRoles) ||
		facts.resend ||
		facts.hasPendingInvitation
	) {
		return {
			code: "WORKSPACE_PERMISSION_DENIED",
			message: "Your workspace role can only send new viewer invitations",
		};
	}

	return null;
}

/**
 * Decides if a member role update may run. Null means allowed.
 * A personal workspace keeps exactly one owner: its personal owner.
 */
export function memberRoleUpdateRefusal(input: {
	workspace: WorkspaceKindFacts;
	/** `member.user_id` of the row that changes. */
	memberUserId: string;
	/** The new roles, split on commas. */
	newRoles: string[];
}): WorkspaceRuleRefusal | null {
	if (input.workspace.kind === "team") {
		return null;
	}

	if (
		input.memberUserId === input.workspace.ownerUserId ||
		input.newRoles.includes("owner")
	) {
		return {
			code: "WORKSPACE_PERMISSION_DENIED",
			message: "The owner of a personal workspace cannot change",
		};
	}

	return null;
}

/** True for a slug in the reserved personal range. Case does not matter. */
export function isPersonalWorkspaceSlug(slug: string): boolean {
	return slug.trim().toLowerCase().startsWith(PERSONAL_WORKSPACE_SLUG_PREFIX);
}

/**
 * True when the split role names hold only `viewer`. The editor invite rule reads it,
 * and the downgrade cleanup starts when a member's roles become viewer only.
 */
export function isViewerOnly(roles: string[]): boolean {
	return roles.length > 0 && roles.every((role) => role === "viewer");
}
