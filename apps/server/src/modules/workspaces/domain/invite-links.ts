/**
 * Invite link rules of workspaces-sharing.md 1 and 5: lifetimes, tokens, and the accept outcome.
 * InviteLinksService and ProjectSharingService call them. This file reads no database.
 */
import { randomBytes } from "node:crypto";
import { WORKSPACE_INVITATION_EXPIRES_IN_DAYS } from "@wandit/auth/workspace-membership-rules";
import type {
	ProjectInviteLinkRole,
	ProjectRole,
	WorkspaceInviteLinkRole,
} from "@wandit/contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 5 days. A workspace link gives membership, so it lives shorter than a project link. */
export const WORKSPACE_INVITE_LINK_TTL_MS = 5 * DAY_MS;

/** 7 days (workspaces-sharing.md 1). */
export const PROJECT_INVITE_LINK_TTL_MS = 7 * DAY_MS;

/** 30 days. Design 1 gives one lifetime to workspace and project email invitations. */
export const PROJECT_INVITATION_TTL_MS =
	WORKSPACE_INVITATION_EXPIRES_IN_DAYS * DAY_MS;

/** A new link token: 32 random bytes in base64url, 43 characters (`inviteLinkTokenSchema`). */
export function newInviteLinkToken(): string {
	return randomBytes(32).toString("base64url");
}

/** The target of a link, with the caller facts that accept reads. */
export type InviteLinkAcceptTarget =
	| {
			kind: "workspace";
			organizationId: string;
			role: WorkspaceInviteLinkRole;
			/** True when the caller already has a `member` row in this organization. */
			callerIsMember: boolean;
	  }
	| {
			kind: "project";
			projectId: string;
			role: ProjectInviteLinkRole;
			/** False for a deleted project or an engine other than `v2_app`. */
			projectIsLiveV2: boolean;
			/** The caller's effective role on the project now; null for no access. */
			callerRole: ProjectRole | null;
	  };

/** What accept does. A null role writes nothing: a member keeps the role, and the owner gets no grant. */
export type InviteLinkAcceptOutcome =
	| { kind: "invalid" }
	| {
			kind: "workspace";
			organizationId: string;
			joinRole: WorkspaceInviteLinkRole | null;
	  }
	| {
			kind: "project";
			projectId: string;
			grantRole: ProjectInviteLinkRole | null;
	  };

/**
 * Decides what accepting a link does. A workspace link never changes a member's role:
 * an admin may have downgraded the member, and an old link must not raise them again.
 * A project link writes a grant for everyone but the owner; the upsert never lowers a grant.
 */
export function inviteLinkAcceptOutcome(input: {
	/** `invite_links.revoked_at`. */
	revokedAt: Date | null;
	/** `invite_links.expires_at`. */
	expiresAt: Date;
	now: Date;
	target: InviteLinkAcceptTarget;
}): InviteLinkAcceptOutcome {
	if (input.revokedAt !== null || input.expiresAt <= input.now) {
		return { kind: "invalid" };
	}

	const { target } = input;
	if (target.kind === "workspace") {
		return {
			joinRole: target.callerIsMember ? null : target.role,
			kind: "workspace",
			organizationId: target.organizationId,
		};
	}

	// Project sharing is for V2 app projects only (workspaces-sharing.md 0).
	if (!target.projectIsLiveV2) {
		return { kind: "invalid" };
	}

	// The owner is never a grant. A role from the workspace alone goes away when the
	// owner sets Restricted, so every other caller gets the grant (workspaces-sharing.md 5).
	return {
		grantRole: target.callerRole === "owner" ? null : target.role,
		kind: "project",
		projectId: target.projectId,
	};
}
