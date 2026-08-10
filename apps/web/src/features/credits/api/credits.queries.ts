import { useQuery } from "@tanstack/react-query";
import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";
import type { CreditLedgerQuery } from "./credits.dto";

import { getCreditBalance, getCreditLedger } from "./credits.services";

// Workspace-scoped keys (teams-workspaces.md §9): the balance/ledger shown are
// the ACTIVE workspace's pool, so the key carries the workspace segment.
export const creditsKeys = {
	all: ["credits"] as const,
	scope: () => [...creditsKeys.all, getActiveWorkspaceId()] as const,
	balance: () => [...creditsKeys.scope(), "balance"] as const,
	ledgers: () => [...creditsKeys.scope(), "ledger"] as const,
	ledger: ({ page, pageSize }: CreditLedgerQuery) =>
		[...creditsKeys.ledgers(), page, pageSize] as const,
};

type CreditQueryOptions = {
	enabled?: boolean;
};

export function useCreditBalanceQuery(options: CreditQueryOptions = {}) {
	return useQuery({
		queryKey: creditsKeys.balance(),
		queryFn: getCreditBalance,
		enabled: options.enabled ?? true,
		// Async jobs can finish after their originating chat card has unmounted.
		// Terminal surfaces invalidate immediately; this mounted-query fallback
		// prevents a reservation-era value from persisting for the whole session.
		refetchInterval: 15_000,
	});
}

export function useCreditLedgerQuery(
	query: CreditLedgerQuery,
	options: CreditQueryOptions = {},
) {
	return useQuery({
		queryKey: creditsKeys.ledger(query),
		queryFn: () => getCreditLedger(query),
		enabled: options.enabled ?? true,
	});
}
