/**
 * HTTP calls of the workspaces REST API, parsed with the contract schemas.
 * The list call works in every scope. Member limits, collaborators, and
 * invite links use the active workspace header (BaseService adds it).
 * The invite link preview and accept routes take the token, not the header.
 */
import {
	type AcceptInviteLinkResponse,
	acceptInviteLinkResponseSchema,
	type CreateWorkspaceInviteLinkBody,
	type InviteLinkPreview,
	inviteLinkPreviewSchema,
	type ListWorkspaceCollaboratorsResponse,
	type ListWorkspaceInviteLinksResponse,
	type ListWorkspacesResponse,
	listWorkspaceCollaboratorsResponseSchema,
	listWorkspaceInviteLinksResponseSchema,
	listWorkspacesResponseSchema,
	type PutWorkspaceMemberLimitsBody,
	type WorkspaceInviteLink,
	type WorkspaceMemberLimitsResponse,
	workspaceInviteLinkSchema,
	workspaceMemberLimitsResponseSchema,
	workspacesRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

export async function listWorkspaces(): Promise<ListWorkspacesResponse> {
	const payload = await apiClient.get(workspacesRoutes.list);

	return listWorkspacesResponseSchema.parse(payload);
}

export async function getWorkspaceMemberLimits(): Promise<WorkspaceMemberLimitsResponse> {
	const payload = await apiClient.get(workspacesRoutes.memberLimits);

	return workspaceMemberLimitsResponseSchema.parse(payload);
}

export async function putWorkspaceMemberLimits(
	body: PutWorkspaceMemberLimitsBody,
): Promise<WorkspaceMemberLimitsResponse> {
	const payload = await apiClient.put(workspacesRoutes.memberLimits, body);

	return workspaceMemberLimitsResponseSchema.parse(payload);
}

/** External collaborators of the active workspace. Owners and admins only. */
export async function listWorkspaceCollaborators(): Promise<ListWorkspaceCollaboratorsResponse> {
	const payload = await apiClient.get(workspacesRoutes.collaborators);

	return listWorkspaceCollaboratorsResponseSchema.parse(payload);
}

/** Active invite links of the active workspace, at most one per role. Owners and admins only. */
export async function listWorkspaceInviteLinks(): Promise<ListWorkspaceInviteLinksResponse> {
	const payload = await apiClient.get(workspacesRoutes.inviteLinks);

	return listWorkspaceInviteLinksResponseSchema.parse(payload);
}

/** Creates a link for one role. The server revokes the old link of that role. */
export async function createWorkspaceInviteLink(
	body: CreateWorkspaceInviteLinkBody,
): Promise<WorkspaceInviteLink> {
	const payload = await apiClient.post(workspacesRoutes.inviteLinks, body);

	return workspaceInviteLinkSchema.parse(payload);
}

/** Revokes one link. The server answers 204. */
export async function revokeWorkspaceInviteLink(linkId: string): Promise<void> {
	await apiClient.delete(workspacesRoutes.inviteLink(linkId));
}

/** Preview of a workspace or project link. An unknown or revoked token answers 404 `INVITE_LINK_INVALID`. */
export async function getInviteLinkPreview(
	token: string,
): Promise<InviteLinkPreview> {
	const payload = await apiClient.get(
		workspacesRoutes.inviteLinkPreview(token),
	);

	return inviteLinkPreviewSchema.parse(payload);
}

/** Joins through a link. The answer names the workspace or the project to open. */
export async function acceptInviteLink(
	token: string,
): Promise<AcceptInviteLinkResponse> {
	const payload = await apiClient.post(
		workspacesRoutes.acceptInviteLink(token),
	);

	return acceptInviteLinkResponseSchema.parse(payload);
}
