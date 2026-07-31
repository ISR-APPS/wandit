import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
	ChangeUserRoleInput,
	GrantUserCreditsInput,
	SetUserAccessInput,
	SetUserBannedInput,
	UserDetail,
} from "./users.dto";
import { userKeys } from "./users.queries";
import {
	changeUserRole,
	grantUserCredits,
	setUserAccess,
	setUserBanned,
} from "./users.services";

export function useGrantCreditsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: GrantUserCreditsInput) => grantUserCredits(input),
		onSuccess: (user) => syncUserQueries(queryClient, user),
	});
}

export function useChangeUserRoleMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: ChangeUserRoleInput) => changeUserRole(input),
		onSuccess: (user) => syncUserQueries(queryClient, user),
	});
}

export function useSetUserAccessMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: SetUserAccessInput) => setUserAccess(input),
		onSuccess: (user) => syncUserQueries(queryClient, user),
	});
}

export function useSetUserBannedMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: SetUserBannedInput) => setUserBanned(input),
		onSuccess: (user) => syncUserQueries(queryClient, user),
	});
}

function syncUserQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	user: UserDetail,
) {
	queryClient.setQueryData(userKeys.detail(user.id), user);
	void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
}

export const useGrantUserCredits = useGrantCreditsMutation;
export const useChangeUserRole = useChangeUserRoleMutation;
export const useSetUserAccess = useSetUserAccessMutation;
export const useSetUserBanned = useSetUserBannedMutation;
