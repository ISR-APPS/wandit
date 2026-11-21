/**
 * TanStack Query mutations for staff actions on an organization.
 * The organization detail page and its dialogs call them.
 * Each success writes the new detail into the cache and refreshes the lists.
 */
import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { creditGrantKeys } from "@/features/credit-grants";

import type {
	ChangeOrganizationStarterPassInput,
	GrantOrganizationCreditsInput,
	OrganizationDetail,
	SetOrganizationMemberRoleInput,
} from "./organizations.dto";
import { organizationKeys } from "./organizations.queries";
import {
	changeOrganizationStarterPass,
	grantOrganizationCredits,
	setOrganizationMemberRole,
} from "./organizations.services";

/** Grants promo credits to an org pool. A success also refreshes the credit grant log. */
export function useGrantOrganizationCreditsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: GrantOrganizationCreditsInput) =>
			grantOrganizationCredits(input),
		onSuccess: (detail) => {
			syncOrganizationQueries(queryClient, detail);
			void queryClient.invalidateQueries({ queryKey: creditGrantKeys.all });
		},
	});
}

export function useSetOrganizationMemberRoleMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: SetOrganizationMemberRoleInput) =>
			setOrganizationMemberRole(input),
		onSuccess: (detail) => syncOrganizationQueries(queryClient, detail),
	});
}

/**
 * Grants or revokes the Starter pass of a team pool.
 * The answer holds only the pass, so a success refetches the organization detail and the lists.
 */
export function useChangeOrganizationStarterPassMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: ChangeOrganizationStarterPassInput) =>
			changeOrganizationStarterPass(input),
		onSuccess: (_starterPass, input) => {
			void queryClient.invalidateQueries({
				queryKey: organizationKeys.detail(input.organizationId),
			});
			void queryClient.invalidateQueries({
				queryKey: organizationKeys.lists(),
			});
		},
	});
}

function syncOrganizationQueries(
	queryClient: QueryClient,
	detail: OrganizationDetail,
) {
	queryClient.setQueryData(organizationKeys.detail(detail.id), detail);
	void queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
}
