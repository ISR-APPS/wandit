/**
 * Pure helpers of the workspaces feature.
 * The switcher and the People page sections call `initials` for avatar fallbacks.
 * The Better Auth services call `isOpenInvitation` to drop expired invitations.
 */
import type { WorkspaceInvitation } from "@wandit/contracts";

/** Upper-case first letters of the first two words: "Acme Marketing" gives "AM". */
export function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

/**
 * True when the invitation is pending and not expired at `now`.
 * Better Auth keeps an expired row as `pending`, but its accept route refuses it.
 */
export function isOpenInvitation(
	invitation: Pick<WorkspaceInvitation, "status" | "expiresAt">,
	now: Date,
): boolean {
	return (
		invitation.status === "pending" &&
		invitation.expiresAt.getTime() > now.getTime()
	);
}
