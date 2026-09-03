// TanStack Query queries + query keys for custom domains. The project list
// polls while any domain is registering/configuring, or while the BYO verify
// UI is explicitly checking.

import { useQuery } from "@tanstack/react-query";

import { DOMAIN_POLL_INTERVAL_MS } from "../lib/constants";
import { hasTransitionalDomains } from "../lib/helpers";
import {
	getDomainDnsStatus,
	listProjectDomains,
	searchDomains,
} from "./domains.services";

const DNS_STATUS_POLL_INTERVAL_MS = 20_000;

export const domainKeys = {
	all: ["domains"] as const,
	lists: () => [...domainKeys.all, "list"] as const,
	list: (projectId: string) => [...domainKeys.lists(), projectId] as const,
	dnsStatuses: () => [...domainKeys.all, "dns-status"] as const,
	dnsStatus: (domainId: string) =>
		[...domainKeys.dnsStatuses(), domainId] as const,
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

export function useDomainDnsStatusQuery(
	domainId: string | null,
	options: { enabled?: boolean; poll?: boolean } = {},
) {
	const { enabled = true, poll = false } = options;

	return useQuery({
		queryKey: domainKeys.dnsStatus(domainId ?? "pending"),
		queryFn: () => getDomainDnsStatus(domainId as string),
		enabled: enabled && domainId !== null,
		// A transport/rate-limit failure should not start an automatic retry loop.
		// Unknown DNS resolver results are successful responses and keep polling.
		refetchInterval: (query) =>
			dnsStatusRefetchInterval(poll, query.state.error !== null),
		retry: false,
	});
}

export function dnsStatusRefetchInterval(poll: boolean, hasError: boolean) {
	return poll && !hasError ? DNS_STATUS_POLL_INTERVAL_MS : false;
}

export function useDomainSearchQuery(q: string, enabled: boolean) {
	return useQuery({
		queryKey: domainKeys.search(q),
		queryFn: () => searchDomains(q),
		enabled,
	});
}
