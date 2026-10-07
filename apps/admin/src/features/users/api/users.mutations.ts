/**
 * TanStack Query mutations for staff actions on a user account.
 * The users table, the user detail page, and their dialogs call them.
 * Each success writes the new detail into the cache and refreshes the lists.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { creditGrantKeys } from "@/features/credit-grants";

import type {
	ChangeUserRoleInput,
	GrantUserCreditsInput,
	SetUserAdminViewsInput,
	SetUserBannedInput,
	UserDetail,
} from "./users.dto";
import { userKeys } from "./users.queries";
import {
	changeUserRole,
	grantUserCredits,
	setUserAdminViews,
	setUserBanned,
} from "./users.services";

/** Grants promo credits to a user. A success also refreshes the credit grant log. */
export function useGrantCreditsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: GrantUserCreditsInput) => grantUserCredits(input),
		onSuccess: (user) => {
			syncUserQueries(queryClient, user);
			void queryClient.invalidateQueries({ queryKey: creditGrantKeys.all });
		},
	});
}

export function useChangeUserRoleMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: ChangeUserRoleInput) => changeUserRole(input),
		onSuccess: (user) => syncUserQueries(queryClient, user),
	});
}

export function useSetAdminViewsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: SetUserAdminViewsInput) => setUserAdminViews(input),
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
export const useSetUserBanned = useSetUserBannedMutation;
