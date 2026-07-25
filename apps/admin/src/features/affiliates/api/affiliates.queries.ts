import { useQuery } from "@tanstack/react-query";

import { getAffiliate, listAffiliates } from "./affiliates.services";

export const affiliateKeys = {
	all: ["admin-affiliates"] as const,
	lists: () => [...affiliateKeys.all, "list"] as const,
	list: () => [...affiliateKeys.lists()] as const,
	details: () => [...affiliateKeys.all, "detail"] as const,
	detail: (affiliateId: string) =>
		[...affiliateKeys.details(), affiliateId] as const,
};

export function useAffiliatesQuery() {
	return useQuery({
		queryKey: affiliateKeys.list(),
		queryFn: listAffiliates,
	});
}

export function useAffiliateQuery(affiliateId: string | undefined) {
	return useQuery({
		queryKey: affiliateKeys.detail(affiliateId ?? "none"),
		queryFn: () => getAffiliate(affiliateId as string),
		enabled: Boolean(affiliateId),
	});
}
