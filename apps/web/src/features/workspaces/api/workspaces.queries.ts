// TanStack Query layer for team workspaces. The workspace LIST is
// deliberately un-scoped (same answer in every workspace); member limits are
// scoped by the active workspace via the shared header, so their key carries
// the workspace segment like every other scoped resource.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PutWorkspaceMemberLimitsBody } from "@wandit/contracts";

import { authClient } from "@/features/auth/lib/auth-client";
import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";
import {
	getWorkspaceMemberLimits,
	listWorkspaces,
	putWorkspaceMemberLimits,
} from "./workspaces.services";

export const workspacesKeys = {
	all: ["workspaces"] as const,
	list: () => [...workspacesKeys.all, "list"] as const,
	memberLimits: () =>
		[...workspacesKeys.all, getActiveWorkspaceId(), "member-limits"] as const,
	// Invitations addressed to the signed-in user — user-level, not
	// workspace-scoped, so no workspace segment.
	userInvitations: () => [...workspacesKeys.all, "user-invitations"] as const,
};

export function useWorkspacesQuery(options: { enabled?: boolean } = {}) {
	return useQuery({
		queryKey: workspacesKeys.list(),
		queryFn: listWorkspaces,
		enabled: options.enabled ?? true,
		staleTime: 30_000,
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

export function useUserInvitationsQuery(options: { enabled?: boolean } = {}) {
	return useQuery({
		queryKey: workspacesKeys.userInvitations(),
		queryFn: async () => {
			const result = await authClient.organization.listUserInvitations();

			return result.data ?? [];
		},
		enabled: options.enabled ?? true,
		staleTime: 30_000,
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
