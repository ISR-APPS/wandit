/**
 * TanStack Query mutations of the People page, the invite page, and the join page.
 * They call the Better Auth and REST services of this folder, then refresh the keys they change.
 * Callers show the toasts: each `mutate` call passes its own `onSuccess` and `onError`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	WorkspaceInviteLinkRole,
	WorkspaceRoleName,
} from "@wandit/contracts";

import { sharingKeys } from "@/features/project-sharing";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import {
	acceptWorkspaceInvitation,
	cancelWorkspaceInvitation,
	inviteWorkspaceMember,
	leaveWorkspace,
	rejectWorkspaceInvitation,
	removeWorkspaceMember,
	renameWorkspace,
	updateWorkspaceMemberRole,
} from "./workspace-members.services";
import { workspacesKeys } from "./workspaces.queries";
import {
	acceptInviteLink,
	createWorkspaceInviteLink,
	revokeWorkspaceInviteLink,
} from "./workspaces.services";

/** One email that the invite batch could not send. */
export type FailedWorkspaceInvite = {
	email: string;
	/** Better Auth or Wandit error code; null when the request never got an answer. */
	code: string | null;
	/** Translated reason from `getApiErrorMessage`, for codes the form does not name itself. */
	message: string;
};

/** Renames the workspace. The switcher list shows the name, so it refreshes too. */
export function useRenameWorkspaceMutation(organizationId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (name: string) => renameWorkspace({ organizationId, name }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: workspacesKeys.list() });
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.organization(organizationId),
			});
		},
	});
}

/**
 * Sends one invitation per email and answers the emails that failed.
 * One refused email does not stop the others.
 */
export function useInviteWorkspaceMembersMutation(organizationId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: {
			emails: string[];
			role: WorkspaceRoleName;
		}): Promise<FailedWorkspaceInvite[]> => {
			// Better Auth invites one email per call.
			const results = await Promise.allSettled(
				input.emails.map((email) =>
					inviteWorkspaceMember({ organizationId, email, role: input.role }),
				),
			);

			return input.emails.flatMap((email, index) => {
				const result = results[index];

				if (result?.status !== "rejected") {
					return [];
				}

				const reason: unknown = result.reason;

				return [
					{
						email,
						code: isApiClientError(reason) ? reason.code : null,
						message: getApiErrorMessage(reason),
					},
				];
			});
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.invitations(organizationId),
			});
		},
	});
}

/** Cancels a pending email invitation (owners and admins). */
export function useCancelWorkspaceInvitationMutation(organizationId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: cancelWorkspaceInvitation,
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.invitations(organizationId),
			});
		},
	});
}

/**
 * Removes a member. The removed member leaves the limits list, so it refreshes too.
 * The server also revokes every active invite link of the workspace (workspaces-sharing.md 2.1).
 */
export function useRemoveWorkspaceMemberMutation(organizationId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (memberId: string) =>
			removeWorkspaceMember({ organizationId, memberId }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.organization(organizationId),
			});
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.memberLimits(),
			});
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.inviteLinks(),
			});
		},
	});
}

/** Changes the role of a member (owners and admins). */
export function useUpdateWorkspaceMemberRoleMutation(organizationId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: { memberId: string; role: WorkspaceRoleName }) =>
			updateWorkspaceMemberRole({ organizationId, ...input }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.organization(organizationId),
			});
		},
	});
}

/** Leaves the workspace. The caller then switches to the own personal workspace. */
export function useLeaveWorkspaceMutation(organizationId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => leaveWorkspace(organizationId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: workspacesKeys.list() });
		},
	});
}

/** Creates the invite link of one role. The server revokes the old link of that role. */
export function useCreateWorkspaceInviteLinkMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (role: WorkspaceInviteLinkRole) =>
			createWorkspaceInviteLink({ role }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.inviteLinks(),
			});
		},
	});
}

/** Revokes one invite link. Anyone who still holds it can no longer join. */
export function useRevokeWorkspaceInviteLinkMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: revokeWorkspaceInviteLink,
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.inviteLinks(),
			});
		},
	});
}

/**
 * Joins through a workspace or project link. A workspace link changes the switcher list.
 * A project link adds a direct grant, so the dashboard "Shared with me" list changes.
 */
export function useAcceptInviteLinkMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: acceptInviteLink,
		onSuccess: (answer) => {
			if (answer.kind === "workspace") {
				void queryClient.invalidateQueries({
					queryKey: workspacesKeys.list(),
				});
				return;
			}

			void queryClient.invalidateQueries({
				queryKey: sharingKeys.sharedProjects(),
			});
		},
	});
}

/**
 * Accepts an email invitation. The banner list and the switcher list change.
 * Better Auth marks the invitation accepted before it adds the member, so a failure refreshes too.
 */
export function useAcceptWorkspaceInvitationMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: acceptWorkspaceInvitation,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.userInvitations(),
			});
			void queryClient.invalidateQueries({ queryKey: workspacesKeys.list() });
		},
	});
}

/** Declines an email invitation. The banner list changes. */
export function useRejectWorkspaceInvitationMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: rejectWorkspaceInvitation,
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.userInvitations(),
			});
		},
	});
}
