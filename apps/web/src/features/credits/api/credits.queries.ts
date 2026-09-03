import { useQuery } from "@tanstack/react-query";
import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";
import type { CreditActivityQuery } from "./credits.dto";

import {
	getCreditActivity,
	getCreditBalance,
	getWorkspaceCreditBalances,
} from "./credits.services";

// Workspace-scoped keys (teams-workspaces.md §9): the balance/activity shown
// are the ACTIVE workspace's pool, so the key carries the workspace segment.
// The all-workspaces balances list is deliberately UN-scoped (same answer in
// every workspace) but stays under the "credits" prefix so billing-error
// invalidations refresh it too.
export const creditsKeys = {
	all: ["credits"] as const,
	scope: () => [...creditsKeys.all, getActiveWorkspaceId()] as const,
	balance: () => [...creditsKeys.scope(), "balance"] as const,
	balances: () => [...creditsKeys.all, "balances", "all-workspaces"] as const,
	activities: () => [...creditsKeys.scope(), "activity"] as const,
	activity: ({ page, pageSize }: CreditActivityQuery) =>
		[...creditsKeys.activities(), page, pageSize] as const,
};

type CreditQueryOptions = {
	enabled?: boolean;
};

// No poll: the balance moves once per operation, when the terminal surface
// invalidates it after settle. Window focus catches reconcile drift and jobs
// that finished after their card unmounted (the app default is false).
export function useCreditBalanceQuery(options: CreditQueryOptions = {}) {
	return useQuery({
		queryKey: creditsKeys.balance(),
		queryFn: getCreditBalance,
		enabled: options.enabled ?? true,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});
}

export function useWorkspaceCreditBalancesQuery(
	options: CreditQueryOptions = {},
) {
	return useQuery({
		queryKey: creditsKeys.balances(),
		queryFn: getWorkspaceCreditBalances,
		enabled: options.enabled ?? true,
		staleTime: 30_000,
	});
}

export function useCreditActivityQuery(
	query: CreditActivityQuery,
	options: CreditQueryOptions = {},
) {
	return useQuery({
		queryKey: creditsKeys.activity(query),
		queryFn: () => getCreditActivity(query),
		enabled: options.enabled ?? true,
		// Always stale: the list mounts when the dropdown opens, and nothing
		// invalidates it at operation start, so each open must refetch to show
		// the "In progress" row of a running operation.
		staleTime: 0,
		refetchOnWindowFocus: true,
	});
}
