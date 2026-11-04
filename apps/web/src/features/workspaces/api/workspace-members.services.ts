/**
 * Better Auth organization calls: create, members, email invitations, rename, leave, and the active organization.
 * The queries and mutations of this folder, the create dialog, and the workspace provider call them.
 * Each workspace call passes `organizationId` explicitly. The server never reads the session's active organization.
 * Answers that the web reads get a contract parse. A refused call throws `ApiClientError`, like a REST error.
 */
import {
	type WorkspaceInvitation,
	type WorkspaceOrganization,
	type WorkspaceRoleName,
	workspaceInvitationSchema,
	workspaceOrganizationSchema,
} from "@wandit/contracts";

import { authClient } from "@/features/auth";
import { isOpenInvitation } from "@/features/workspaces/lib/helpers";
import { ApiClientError } from "@/lib/api-client";

/** The error half of a Better Auth client answer. `code` is a Better Auth or Wandit error code. */
type AuthClientFailure = {
	code?: string;
	message?: string;
	status: number;
	statusText: string;
};

/** A Better Auth client answer: data or an error, never both. */
type AuthClientResult<TData> =
	| { data: TData; error: null }
	| { data: null; error: AuthClientFailure };

function toApiClientError(
	failure: AuthClientFailure,
	path: string,
): ApiClientError {
	return new ApiClientError({
		code: failure.code ?? `HTTP_${failure.status}`,
		message: failure.message ?? failure.statusText,
		path,
		// Better Auth answers carry no request id.
		requestId: "unknown",
		statusCode: failure.status,
		timestamp: new Date().toISOString(),
	});
}

function unwrapAuthResult<TData extends object | null>(
	result: AuthClientResult<TData>,
	path: string,
): TData {
	if (result.error) {
		throw toApiClientError(result.error, path);
	}

	return result.data;
}

/** Creates a team workspace and answers its organization id. The create dialog calls it before the Business checkout. */
export async function createWorkspace(input: {
	name: string;
	/** Must not start with `personal-`: the server keeps that prefix for personal workspaces. */
	slug: string;
}): Promise<string> {
	const organization = unwrapAuthResult(
		await authClient.organization.create(input),
		"/organization/create",
	);

	return workspaceOrganizationSchema.pick({ id: true }).parse(organization).id;
}

/** Sets the session's active organization (null for personal). Only the UI reads it: the server scopes by the header. */
export async function setActiveWorkspace(
	organizationId: string | null,
): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.setActive({ organizationId }),
		"/organization/set-active",
	);
}

/** The organization with its members. Any member can read it. */
export async function getWorkspaceOrganization(
	organizationId: string,
): Promise<WorkspaceOrganization> {
	const path = "/organization/get-full-organization";
	const organization = unwrapAuthResult(
		await authClient.organization.getFullOrganization({
			query: { organizationId },
		}),
		path,
	);

	if (!organization) {
		throw toApiClientError(
			{
				code: "ORGANIZATION_NOT_FOUND",
				status: 404,
				statusText: "Not Found",
			},
			path,
		);
	}

	return workspaceOrganizationSchema.parse(organization);
}

/** Open email invitations of the workspace. Better Auth also lists accepted, canceled, and expired rows. */
export async function listPendingWorkspaceInvitations(
	organizationId: string,
): Promise<WorkspaceInvitation[]> {
	const invitations = workspaceInvitationSchema.array().parse(
		unwrapAuthResult(
			await authClient.organization.listInvitations({
				query: { organizationId },
			}),
			"/organization/list-invitations",
		),
	);
	const now = new Date();

	return invitations.filter((invitation) => isOpenInvitation(invitation, now));
}

/** Sends one email invitation. The server hook decides which roles the caller may send. */
export async function inviteWorkspaceMember(input: {
	organizationId: string;
	email: string;
	role: WorkspaceRoleName;
}): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.inviteMember(input),
		"/organization/invite-member",
	);
}

/** Cancels a pending invitation. Better Auth allows owners and admins only. */
export async function cancelWorkspaceInvitation(
	invitationId: string,
): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.cancelInvitation({ invitationId }),
		"/organization/cancel-invitation",
	);
}

/** Removes a member. Owners and admins only. Better Auth refuses the last owner. */
export async function removeWorkspaceMember(input: {
	organizationId: string;
	/** `member.id` of the row, not the user id. */
	memberId: string;
}): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.removeMember({
			memberIdOrEmail: input.memberId,
			organizationId: input.organizationId,
		}),
		"/organization/remove-member",
	);
}

/** Sets the role of a member. The server refuses `owner` in a personal workspace. */
export async function updateWorkspaceMemberRole(input: {
	organizationId: string;
	/** `member.id` of the row, not the user id. */
	memberId: string;
	role: WorkspaceRoleName;
}): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.updateMemberRole(input),
		"/organization/update-member-role",
	);
}

/** Leaves the workspace. A server hook then removes the caller's project grants there (workspaces-sharing.md 2.1). */
export async function leaveWorkspace(organizationId: string): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.leave({ organizationId }),
		"/organization/leave",
	);
}

/** Changes only the name. The slug of a personal workspace must never change. */
export async function renameWorkspace(input: {
	organizationId: string;
	name: string;
}): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.update({
			organizationId: input.organizationId,
			data: { name: input.name },
		}),
		"/organization/update",
	);
}

/** Open workspace invitations to the signed-in user's email. Better Auth filters on status only, not on expiry. */
export async function listUserWorkspaceInvitations(): Promise<
	WorkspaceInvitation[]
> {
	const invitations = workspaceInvitationSchema
		.array()
		.parse(
			unwrapAuthResult(
				await authClient.organization.listUserInvitations(),
				"/organization/list-user-invitations",
			),
		);
	const now = new Date();

	return invitations.filter((invitation) => isOpenInvitation(invitation, now));
}

/** One invitation of the signed-in user, with the workspace name. Better Auth refuses an expired one. */
export async function getWorkspaceInvitation(
	invitationId: string,
): Promise<WorkspaceInvitation> {
	return workspaceInvitationSchema.parse(
		unwrapAuthResult(
			await authClient.organization.getInvitation({
				query: { id: invitationId },
			}),
			"/organization/get-invitation",
		),
	);
}

/** Accepts an invitation of the signed-in user. The session email must match the invitation email. */
export async function acceptWorkspaceInvitation(
	invitationId: string,
): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.acceptInvitation({ invitationId }),
		"/organization/accept-invitation",
	);
}

/** Declines an invitation of the signed-in user. */
export async function rejectWorkspaceInvitation(
	invitationId: string,
): Promise<void> {
	unwrapAuthResult(
		await authClient.organization.rejectInvitation({ invitationId }),
		"/organization/reject-invitation",
	);
}
