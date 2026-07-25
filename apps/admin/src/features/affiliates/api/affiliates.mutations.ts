import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
	Affiliate,
	CreateAffiliateCodeInput,
	CreateAffiliateInput,
	SetAffiliateCodeStatusInput,
	SetAffiliateStatusInput,
} from "./affiliates.dto";
import { affiliateKeys } from "./affiliates.queries";
import {
	createAffiliate,
	createAffiliateCode,
	setAffiliateCodeStatus,
	setAffiliateStatus,
} from "./affiliates.services";

export function useCreateAffiliateMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateAffiliateInput) => createAffiliate(input),
		onSuccess: (affiliate) => syncAffiliateQueries(queryClient, affiliate),
	});
}

export function useCreateAffiliateCodeMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateAffiliateCodeInput) => createAffiliateCode(input),
		onSuccess: (affiliate) => syncAffiliateQueries(queryClient, affiliate),
	});
}

export function useSetAffiliateStatusMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: SetAffiliateStatusInput) => setAffiliateStatus(input),
		onSuccess: (affiliate) => syncAffiliateQueries(queryClient, affiliate),
	});
}

export function useSetAffiliateCodeStatusMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: SetAffiliateCodeStatusInput) =>
			setAffiliateCodeStatus(input),
		onSuccess: (affiliate) => syncAffiliateQueries(queryClient, affiliate),
	});
}

function syncAffiliateQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	affiliate: Affiliate,
) {
	queryClient.setQueryData(affiliateKeys.detail(affiliate.id), affiliate);
	void queryClient.invalidateQueries({ queryKey: affiliateKeys.lists() });
	void queryClient.invalidateQueries({
		queryKey: affiliateKeys.detail(affiliate.id),
	});
}
