/**
 * TanStack Query mutations of project sharing. Each one calls sharing.services.ts
 * and refreshes the sharing keys it changes. Accept and decline also refresh the
 * invitations banner of features/workspaces. Callers show the toasts and own
 * the caches of their own feature (the builder project, the project lists).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	CreateProjectInvitationsBody,
	MoveProjectBody,
	ProjectInviteLinkRole,
	ProjectMemberRole,
	ProjectWorkspaceAccess,
} from "@wandit/contracts";

import { projectInvitationsKeys } from "@/features/workspaces";
import { sharingKeys } from "./sharing.queries";
import {
	acceptProjectInvitation,
	cancelProjectInvitation,
	createProjectInvitations,
	declineProjectInvitation,
	deleteProjectInviteLink,
	moveProject,
	putProjectInviteLink,
	removeProjectMember,
	transferProject,
	updateProjectMember,
	updateProjectWorkspaceAccess,
} from "./sharing.services";

/** Refreshes the Share dialog of one project after a write. */
function useRefreshSharing(projectId: string) {
	const queryClient = useQueryClient();
	return () =>
		queryClient.invalidateQueries({ queryKey: sharingKeys.sharing(projectId) });
}

/** Invites 1 to 20 emails with one role. */
export function useInviteToProject(projectId: string) {
	const refresh = useRefreshSharing(projectId);
	return useMutation({
		mutationFn: (body: CreateProjectInvitationsBody) =>
			createProjectInvitations(projectId, body),
		onSuccess: refresh,
	});
}

/** Cancels one pending invitation. */
export function useCancelProjectInvitation(projectId: string) {
	const refresh = useRefreshSharing(projectId);
	return useMutation({
		mutationFn: (invitationId: string) =>
			cancelProjectInvitation(projectId, invitationId),
		onSuccess: refresh,
	});
}

/** Changes the role of one direct grant. */
export function useUpdateProjectMember(projectId: string) {
	const refresh = useRefreshSharing(projectId);
	return useMutation({
		mutationFn: (input: { userId: string; role: ProjectMemberRole }) =>
			updateProjectMember(projectId, input.userId, { role: input.role }),
		onSuccess: refresh,
	});
}

/** Removes one direct grant. With the caller's own id, the caller leaves the project. */
export function useRemoveProjectMember(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (userId: string) => removeProjectMember(projectId, userId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: sharingKeys.sharing(projectId),
			});
			// A leave takes the project out of "Shared with me".
			void queryClient.invalidateQueries({
				queryKey: sharingKeys.sharedProjects(),
			});
		},
	});
}

/** Sets the Workspace access row. */
export function useUpdateProjectWorkspaceAccess(projectId: string) {
	const refresh = useRefreshSharing(projectId);
	return useMutation({
		mutationFn: (workspaceAccess: ProjectWorkspaceAccess) =>
			updateProjectWorkspaceAccess(projectId, { workspaceAccess }),
		onSuccess: refresh,
	});
}

/** Creates the project invite link. The server revokes the old link first. */
export function usePutProjectInviteLink(projectId: string) {
	const refresh = useRefreshSharing(projectId);
	return useMutation({
		mutationFn: (role: ProjectInviteLinkRole) =>
			putProjectInviteLink(projectId, { role }),
		onSuccess: refresh,
	});
}

/** Revokes the project invite link. */
export function useDeleteProjectInviteLink(projectId: string) {
	const refresh = useRefreshSharing(projectId);
	return useMutation({
		mutationFn: () => deleteProjectInviteLink(projectId),
		onSuccess: refresh,
	});
}

/** Gives the project to another owner, admin, or editor of its team workspace. */
export function useTransferProject(projectId: string) {
	const refresh = useRefreshSharing(projectId);
	return useMutation({
		mutationFn: (newOwnerUserId: string) =>
			transferProject(projectId, { newOwnerUserId }),
		onSuccess: refresh,
	});
}

/** Moves the project to another workspace. A 409 carries the blocked reason. */
export function useMoveProject(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: MoveProjectBody) => moveProject(projectId, body),
		onSuccess: () => {
			// The move can delete direct grants, so both lists change.
			void queryClient.invalidateQueries({ queryKey: sharingKeys.all });
		},
	});
}

/** Accepts an invitation of the signed-in user. Answers the project to open. */
export function useAcceptProjectInvitation(invitationId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => acceptProjectInvitation(invitationId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: sharingKeys.all });
			// The invitations banner must drop the used invitation.
			void queryClient.invalidateQueries({
				queryKey: projectInvitationsKeys.all,
			});
		},
	});
}

/** Declines an invitation of the signed-in user. */
export function useDeclineProjectInvitation(invitationId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => declineProjectInvitation(invitationId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: sharingKeys.receivedInvitation(invitationId),
			});
			// The invitations banner must drop the used invitation.
			void queryClient.invalidateQueries({
				queryKey: projectInvitationsKeys.all,
			});
		},
	});
}
