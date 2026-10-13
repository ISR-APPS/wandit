/**
 * TanStack Query mutations for staff actions on a user account.
 * The users table, the user detail page, and their dialogs call them.
 * Each success refreshes the user detail and the user lists in the cache.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { creditGrantKeys } from "@/features/credit-grants";

import type {
	ChangeUserRoleInput,
	GrantUserCreditsInput,
	RefundUserInput,
	SetUserAdminViewsInput,
	SetUserBannedInput,
	UserDetail,
} from "./users.dto";
import { userKeys } from "./users.queries";
import {
	changeUserRole,
	grantUserCredits,
	refundUser,
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

/**
 * Refunds the last Stripe plan payment and cancels the Stripe plan.
 * The subscription and credits change later, when the Stripe webhooks arrive.
 * A failure also refreshes the preview, because the refund can succeed before the cancel fails.
 */
export function useRefundUserMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: RefundUserInput) => refundUser(input),
		onSettled: (_result, _error, input) => {
			// The detail key is a prefix of the refund preview key, so this refreshes both.
			void queryClient.invalidateQueries({
				queryKey: userKeys.detail(input.userId),
			});
			void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
		},
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
