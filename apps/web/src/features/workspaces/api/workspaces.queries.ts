// TanStack Query layer for team workspaces. The workspace LIST is
// deliberately un-scoped (same answer in every workspace); member limits are
// scoped by the active workspace via the shared header, so their key carries
// the workspace segment like every other scoped resource.
// Better Auth reads name their organization explicitly, so their keys carry that id.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PutWorkspaceMemberLimitsBody } from "@wandit/contracts";

import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";
import {
	getWorkspaceInvitation,
	getWorkspaceOrganization,
	listPendingWorkspaceInvitations,
	listUserWorkspaceInvitations,
} from "./workspace-members.services";
import {
	getInviteLinkPreview,
	getWorkspaceMemberLimits,
	listWorkspaceCollaborators,
	listWorkspaceInviteLinks,
	listWorkspaces,
	putWorkspaceMemberLimits,
} from "./workspaces.services";

/** Query keys of the workspaces feature. Header-scoped keys carry the active workspace id. */
export const workspacesKeys = {
	all: ["workspaces"] as const,
	list: () => [...workspacesKeys.all, "list"] as const,
	memberLimits: () =>
		[...workspacesKeys.all, getActiveWorkspaceId(), "member-limits"] as const,
	// Invitations addressed to the signed-in user — user-level, not
	// workspace-scoped, so no workspace segment.
	userInvitations: () => [...workspacesKeys.all, "user-invitations"] as const,
	organization: (organizationId: string) =>
		[...workspacesKeys.all, "organization", organizationId] as const,
	invitations: (organizationId: string) =>
		[...workspacesKeys.all, "invitations", organizationId] as const,
	collaborators: () =>
		[...workspacesKeys.all, getActiveWorkspaceId(), "collaborators"] as const,
	inviteLinks: () =>
		[...workspacesKeys.all, getActiveWorkspaceId(), "invite-links"] as const,
	inviteLinkPreview: (token: string) =>
		[...workspacesKeys.all, "invite-link-preview", token] as const,
	invitation: (invitationId: string) =>
		[...workspacesKeys.all, "invitation", invitationId] as const,
};

/** Every workspace of the user, the own personal one first. The provider and the switcher read it. */
export function useWorkspacesQuery(options: { enabled?: boolean } = {}) {
	return useQuery({
		queryKey: workspacesKeys.list(),
		queryFn: listWorkspaces,
		enabled: options.enabled ?? true,
	});
}

export function useWorkspaceMemberLimitsQuery(
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: workspacesKeys.memberLimits(),
		queryFn: getWorkspaceMemberLimits,
		enabled: options.enabled ?? true,
	});
}

/** Pending workspace invitations to the signed-in user's email, for the invitations banner. */
export function useUserInvitationsQuery(options: { enabled?: boolean } = {}) {
	return useQuery({
		queryKey: workspacesKeys.userInvitations(),
		queryFn: listUserWorkspaceInvitations,
		enabled: options.enabled ?? true,
	});
}

/** Members and name of one workspace. Any member can read it. */
export function useWorkspaceOrganizationQuery(organizationId: string) {
	return useQuery({
		queryKey: workspacesKeys.organization(organizationId),
		queryFn: () => getWorkspaceOrganization(organizationId),
	});
}

/**
 * Pending email invitations of one workspace. Enable it only for owners, admins, and editors.
 * Better Auth 1.7 answers 403 to a viewer. It hides owner invitations from a caller who is not an owner.
 */
export function useWorkspaceInvitationsQuery(
	organizationId: string,
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: workspacesKeys.invitations(organizationId),
		queryFn: () => listPendingWorkspaceInvitations(organizationId),
		enabled: options.enabled ?? true,
	});
}

/** External collaborators of the active workspace. Enable it only for owners and admins: others get 403. */
export function useWorkspaceCollaboratorsQuery(
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: workspacesKeys.collaborators(),
		queryFn: listWorkspaceCollaborators,
		enabled: options.enabled ?? true,
	});
}

/** Active invite links of the active workspace. Owners and admins only: others get 403. */
export function useWorkspaceInviteLinksQuery() {
	return useQuery({
		queryKey: workspacesKeys.inviteLinks(),
		queryFn: listWorkspaceInviteLinks,
	});
}

/** Preview of the `/join/$token` page. No retry: a 404 means the link is not valid. */
export function useInviteLinkPreviewQuery(
	token: string,
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: workspacesKeys.inviteLinkPreview(token),
		queryFn: () => getInviteLinkPreview(token),
		enabled: options.enabled ?? true,
		retry: false,
	});
}

/** One workspace invitation of the signed-in user. No retry: an error means invalid or expired. */
export function useWorkspaceInvitationQuery(
	invitationId: string,
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: workspacesKeys.invitation(invitationId),
		queryFn: () => getWorkspaceInvitation(invitationId),
		enabled: options.enabled ?? true,
		retry: false,
	});
}

export function usePutWorkspaceMemberLimitsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: PutWorkspaceMemberLimitsBody) =>
			putWorkspaceMemberLimits(body),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.memberLimits(),
			});
		},
	});
}
