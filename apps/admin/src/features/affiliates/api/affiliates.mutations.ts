import { useMutation, useQueryClient } from "@tanstack/react-query";

import { affiliateKeys } from "./affiliates.queries";
import {
	archiveAffiliateProgram,
	buildAffiliatePayout,
	createAffiliate,
	createAffiliateLink,
	createAffiliateProgram,
	deactivateAffiliateLink,
	markAffiliatePayoutFailed,
	markAffiliatePayoutPaid,
	updateAffiliate,
	updateAffiliateLink,
	updateAffiliateProgram,
} from "./affiliates.services";

/**
 * Affiliate writes change aggregates and embedded identities across several
 * resources. Invalidating the domain prefix avoids displaying a fresh detail
 * beside stale programs, commissions, attributions, or payouts.
 */
function useDomainMutation<TVariables, TResult>(
	mutationFn: (variables: TVariables) => Promise<TResult>,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: affiliateKeys.all });
		},
	});
}

export function useCreateAffiliateProgramMutation() {
	return useDomainMutation(createAffiliateProgram);
}

export function useUpdateAffiliateProgramMutation() {
	return useDomainMutation(updateAffiliateProgram);
}

export function useArchiveAffiliateProgramMutation() {
	return useDomainMutation(archiveAffiliateProgram);
}

export function useCreateAffiliateMutation() {
	return useDomainMutation(createAffiliate);
}

export function useUpdateAffiliateMutation() {
	return useDomainMutation(updateAffiliate);
}

export function useCreateAffiliateLinkMutation() {
	return useDomainMutation(createAffiliateLink);
}

export function useUpdateAffiliateLinkMutation() {
	return useDomainMutation(updateAffiliateLink);
}

export function useDeactivateAffiliateLinkMutation() {
	return useDomainMutation(deactivateAffiliateLink);
}

export function useBuildAffiliatePayoutMutation() {
	return useDomainMutation(buildAffiliatePayout);
}

export function useMarkAffiliatePayoutPaidMutation() {
	return useDomainMutation(markAffiliatePayoutPaid);
}

export function useMarkAffiliatePayoutFailedMutation() {
	return useDomainMutation(markAffiliatePayoutFailed);
}
