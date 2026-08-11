// TanStack Query queries + query keys for custom domains. The project list
// polls while any domain is registering/configuring, or while the BYO verify
// UI is explicitly checking.

import { useQuery } from "@tanstack/react-query";

import { DOMAIN_POLL_INTERVAL_MS } from "../lib/constants";
import { hasTransitionalDomains } from "../lib/helpers";
import { listProjectDomains, searchDomains } from "./domains.services";

export const domainKeys = {
	all: ["domains"] as const,
	lists: () => [...domainKeys.all, "list"] as const,
	list: (projectId: string) => [...domainKeys.lists(), projectId] as const,
	searches: () => [...domainKeys.all, "search"] as const,
	search: (q: string) => [...domainKeys.searches(), q] as const,
};

type DomainsQueryOptions = {
	enabled?: boolean;
	pollWhileChecking?: boolean;
	refetchInterval?: number;
};

export function useDomainsQuery(
	projectId: string,
	options: DomainsQueryOptions = {},
) {
	const {
		enabled = true,
		pollWhileChecking = false,
		refetchInterval = DOMAIN_POLL_INTERVAL_MS,
	} = options;

	return useQuery({
		queryKey: domainKeys.list(projectId),
		queryFn: () => listProjectDomains(projectId),
		enabled,
		refetchInterval: (query) =>
			pollWhileChecking || hasTransitionalDomains(query.state.data)
				? refetchInterval
				: false,
	});
}

export function useDomainSearchQuery(q: string, enabled: boolean) {
	return useQuery({
		queryKey: domainKeys.search(q),
		queryFn: () => searchDomains(q),
		enabled,
	});
}
