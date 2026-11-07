/**
 * HTTP calls of project sharing (workspaces-sharing.md 5). Each function calls
 * one route of `projectSharingRoutes` and parses the answer with its contract.
 * Called by sharing.queries.ts and sharing.mutations.ts. The routes use the
 * project role of the caller, never the workspace header.
 */
import {
	type AcceptProjectInvitationResponse,
	acceptProjectInvitationResponseSchema,
	type CreateProjectInvitationsBody,
	type CreateProjectInvitationsResponse,
	createProjectInvitationsResponseSchema,
	type ListSharedProjectsResponse,
	listSharedProjectsResponseSchema,
	type MoveProjectBody,
	type ProjectInviteLink,
	type ProjectMember,
	type ProjectSharingState,
	type PutProjectInviteLinkBody,
	projectInviteLinkSchema,
	projectMemberSchema,
	projectSharingRoutes,
	projectSharingStateSchema,
	type ReceivedProjectInvitation,
	receivedProjectInvitationSchema,
	type TransferProjectBody,
	type UpdateProjectMemberBody,
	type UpdateProjectWorkspaceAccessBody,
	updateProjectWorkspaceAccessBodySchema,
	type WorkspaceRoleName,
	workspaceRoleNameSchema,
} from "@wandit/contracts";

import { authClient } from "@/features/auth";
import { ApiClientError, apiClient } from "@/lib/api-client";

/** `GET .../sharing`. A viewer gets no `invitations` and no link token. */
export async function getProjectSharing(
	projectId: string,
): Promise<ProjectSharingState> {
	const data = await apiClient.get<unknown>(
		projectSharingRoutes.sharing(projectId),
	);
	return projectSharingStateSchema.parse(data);
}

/** `POST .../invitations`. Answers the pending invitations it created or renewed. */
export async function createProjectInvitations(
	projectId: string,
	body: CreateProjectInvitationsBody,
): Promise<CreateProjectInvitationsResponse> {
	const data = await apiClient.post<unknown>(
		projectSharingRoutes.invitations(projectId),
		body,
	);
	return createProjectInvitationsResponseSchema.parse(data);
}

/** `DELETE .../invitations/:invitationId`. Answers 204. */
export async function cancelProjectInvitation(
	projectId: string,
	invitationId: string,
): Promise<void> {
	await apiClient.delete(
		projectSharingRoutes.invitation(projectId, invitationId),
	);
}

/** `PATCH .../members/:userId`. Answers the changed grant. */
export async function updateProjectMember(
	projectId: string,
	userId: string,
	body: UpdateProjectMemberBody,
): Promise<ProjectMember> {
	const data = await apiClient.patch<unknown>(
		projectSharingRoutes.member(projectId, userId),
		body,
	);
	return projectMemberSchema.parse(data);
}

/** `DELETE .../members/:userId`. The caller's own id leaves the project. Answers 204. */
export async function removeProjectMember(
	projectId: string,
	userId: string,
): Promise<void> {
	await apiClient.delete(projectSharingRoutes.member(projectId, userId));
}

/** `PATCH .../workspace-access`. Answers the stored value. */
export async function updateProjectWorkspaceAccess(
	projectId: string,
	body: UpdateProjectWorkspaceAccessBody,
): Promise<UpdateProjectWorkspaceAccessBody> {
	const data = await apiClient.patch<unknown>(
		projectSharingRoutes.workspaceAccess(projectId),
		body,
	);
	return updateProjectWorkspaceAccessBodySchema.parse(data);
}

/** `PUT .../invite-link`. Revokes the active link and answers the new one. */
export async function putProjectInviteLink(
	projectId: string,
	body: PutProjectInviteLinkBody,
): Promise<ProjectInviteLink> {
	const data = await apiClient.put<unknown>(
		projectSharingRoutes.inviteLink(projectId),
		body,
	);
	return projectInviteLinkSchema.parse(data);
}

/** `DELETE .../invite-link`. Answers 204. */
export async function deleteProjectInviteLink(
	projectId: string,
): Promise<void> {
	await apiClient.delete(projectSharingRoutes.inviteLink(projectId));
}

/** `POST .../transfer` (owner, team projects only). Answers 204. */
export async function transferProject(
	projectId: string,
	body: TransferProjectBody,
): Promise<void> {
	await apiClient.post(projectSharingRoutes.transfer(projectId), body);
}

/** `POST .../move`. A 409 `PROJECT_MOVE_BLOCKED` carries the reason in `details`. Answers 204. */
export async function moveProject(
	projectId: string,
	body: MoveProjectBody,
): Promise<void> {
	await apiClient.post(projectSharingRoutes.move(projectId), body);
}

/** `GET /api/v2/shared-projects`: the projects with a direct grant for the caller. */
export async function listSharedProjects(): Promise<ListSharedProjectsResponse> {
	const data = await apiClient.get<unknown>(
		projectSharingRoutes.sharedProjects,
	);
	return listSharedProjectsResponseSchema.parse(data);
}

/** `GET /api/v2/project-invitations/:id`. 404 unless the session email is the invited email. */
export async function getReceivedProjectInvitation(
	invitationId: string,
): Promise<ReceivedProjectInvitation> {
	const data = await apiClient.get<unknown>(
		projectSharingRoutes.receivedInvitation(invitationId),
	);
	return receivedProjectInvitationSchema.parse(data);
}

/** `POST .../accept`. Answers the project to open. */
export async function acceptProjectInvitation(
	invitationId: string,
): Promise<AcceptProjectInvitationResponse> {
	const data = await apiClient.post<unknown>(
		projectSharingRoutes.acceptInvitation(invitationId),
	);
	return acceptProjectInvitationResponseSchema.parse(data);
}

/** `POST .../decline`. Answers 204. */
export async function declineProjectInvitation(
	invitationId: string,
): Promise<void> {
	await apiClient.post(projectSharingRoutes.declineInvitation(invitationId));
}

/** One member of a workspace, as the Transfer ownership list shows it. */
export type WorkspaceMember = {
	/** Better Auth user id. The transfer body sends it as `newOwnerUserId`. */
	userId: string;
	name: string;
	email: string;
	/** Parsed from `member.role`, which Better Auth stores as a comma list. Unknown roles drop out. */
	roles: WorkspaceRoleName[];
};

/**
 * The members of one workspace through Better Auth. The caller must be a member,
 * else Better Auth answers 403 and this function throws `ApiClientError`.
 * LIMIT: the first 100 members (Better Auth default page). Upgrade: page with `offset`.
 */
export async function listWorkspaceMembers(
	organizationId: string,
): Promise<WorkspaceMember[]> {
	const result = await authClient.organization.listMembers({
		query: { organizationId },
	});
	// The API error type keeps the Better Auth code. The card shows its text, and query-client.ts skips a 403 in Sentry.
	if (result.error) {
		throw new ApiClientError({
			code: result.error.code ?? `HTTP_${result.error.status}`,
			message: result.error.message ?? result.error.statusText,
			path: "/organization/list-members",
			// Better Auth answers carry no request id.
			requestId: "unknown",
			statusCode: result.error.status,
			timestamp: new Date().toISOString(),
		});
	}
	return result.data.members.map((member) => ({
		userId: member.user.id,
		name: member.user.name,
		email: member.user.email,
		roles: member.role.split(",").flatMap((role) => {
			const parsed = workspaceRoleNameSchema.safeParse(role.trim());
			return parsed.success ? [parsed.data] : [];
		}),
	}));
}
