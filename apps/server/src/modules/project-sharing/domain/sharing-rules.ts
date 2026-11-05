/**
 * Pure project sharing rules of workspaces-sharing.md 2.2 and 5: grants, Workspace access,
 * the invitation recipient, the move blocks, and what a viewer may see.
 * ProjectSharingService and ProjectInvitationsService call them. No database, no Nest.
 */
import { canonicalizeEmail } from "@wandit/auth/email-canonical";
import {
	type ProjectInvitation,
	type ProjectInviteLink,
	type ProjectMemberRole,
	type ProjectMoveBlockedReason,
	type ProjectRole,
	type ProjectSharingState,
	type ProjectWorkspaceAccess,
	projectWorkspaceAccesses,
} from "@wandit/contracts";

/** One change to a direct grant or to a pending invitation. */
export type GrantChange = {
	actorUserId: string;
	/** The actor's effective role on the project. */
	actorRole: ProjectRole;
	/** The user of the grant; null for an invitation, which has only an email. */
	targetUserId: string | null;
	/** The role before the change; null for a new grant or invitation. */
	from: ProjectMemberRole | null;
	/** The role after the change; null removes the grant or cancels the invitation. */
	to: ProjectMemberRole | null;
};

/**
 * Decides who may add, change, or remove a direct grant (workspaces-sharing.md 2.2).
 * A grant never holds the project owner, so a removal never removes the owner.
 */
export function canManageGrant(change: GrantChange): boolean {
	// Everyone may leave a project: remove their own grant.
	if (change.to === null && change.targetUserId === change.actorUserId) {
		return true;
	}
	if (change.actorRole === "owner" || change.actorRole === "admin") {
		return true;
	}
	// An editor manages only editor and viewer grants. A viewer manages none.
	return (
		change.actorRole === "editor" &&
		change.from !== "admin" &&
		change.to !== "admin"
	);
}

/** Can edit and Can view need an editor. Setting or clearing Restricted needs the owner. */
export function canSetWorkspaceAccess(input: {
	actorRole: ProjectRole;
	from: ProjectWorkspaceAccess;
	to: ProjectWorkspaceAccess;
}): boolean {
	if (input.from === "restricted" || input.to === "restricted") {
		return input.actorRole === "owner";
	}
	return input.actorRole !== "viewer";
}

/**
 * True when `to` lets fewer workspace members in than `from` (can_edit, then can_view, then restricted).
 * Such a change revokes the project link, because the excluded members saw its token.
 */
export function narrowsWorkspaceAccess(
	from: ProjectWorkspaceAccess,
	to: ProjectWorkspaceAccess,
): boolean {
	// `projectWorkspaceAccesses` lists the widest value first.
	return (
		projectWorkspaceAccesses.indexOf(to) >
		projectWorkspaceAccesses.indexOf(from)
	);
}

/**
 * True when the session user is the invitee: the canonical session email is the
 * invitation email, and the email is verified. Every invitee route checks it.
 */
export function isInvitationRecipient(input: {
	/** The session `user.email`. Old rows can be non-canonical, so it is canonicalized here. */
	sessionEmail: string;
	emailVerified: boolean;
	/** `project_invitations.email`, stored canonical. */
	invitationEmail: string;
}): boolean {
	return (
		input.emailVerified &&
		canonicalizeEmail(input.sessionEmail) === input.invitationEmail
	);
}

/** State of the project and the destination that a move reads, inside its lock. */
export type MoveFacts = {
	/** A builder turn is in a non-terminal status, also `waiting`. */
	turnActive: boolean;
	/** An `ai_usage_events` row of the project is `reserved`. */
	usageReserved: boolean;
	publishInFlight: boolean;
	mobileBuildInFlight: boolean;
	/** A `desktop_builds` row of the project is live: its hold and CI run belong to the source payer. */
	desktopBuildInFlight: boolean;
	deviceSessionActive: boolean;
	customDomainAttached: boolean;
	/** The project has a backend that the source payer's plan counts. */
	projectHasBackend: boolean;
	/** The destination payer's plan allows one more backend. */
	destinationHasBackendSlot: boolean;
};

/**
 * The first reason that blocks a move, or null. Each reason holds money or
 * state of the source payer that a move would orphan.
 */
export function moveBlockedReason(
	facts: MoveFacts,
): ProjectMoveBlockedReason | null {
	const blocks: [boolean, ProjectMoveBlockedReason][] = [
		[facts.turnActive, "turn_active"],
		[facts.usageReserved, "usage_reserved"],
		[facts.publishInFlight, "publish_in_flight"],
		[facts.mobileBuildInFlight, "mobile_build_in_flight"],
		[facts.desktopBuildInFlight, "desktop_build_in_flight"],
		[facts.deviceSessionActive, "device_session_active"],
		[facts.customDomainAttached, "custom_domain_attached"],
		[
			facts.projectHasBackend && !facts.destinationHasBackendSlot,
			"backend_slot_unavailable",
		],
	];
	return blocks.find(([blocked]) => blocked)?.[1] ?? null;
}

/**
 * Builds the Share dialog state for one caller. A viewer gets no invitations
 * and no link token: with an editor token, a viewer could join again as an editor.
 */
export function sharingStateFor(
	role: ProjectRole,
	state: Omit<ProjectSharingState, "role" | "invitations" | "inviteLink"> & {
		invitations: ProjectInvitation[];
		inviteLink: ProjectInviteLink | null;
	},
): ProjectSharingState {
	if (role !== "viewer") {
		return { ...state, role };
	}
	const { invitations: _hidden, inviteLink, ...visible } = state;
	return {
		...visible,
		inviteLink: inviteLink
			? { expiresAt: inviteLink.expiresAt, role: inviteLink.role }
			: null,
		role,
	};
}
