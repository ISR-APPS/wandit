import { useQuery } from "@tanstack/react-query";

import type { CreditLedgerQuery } from "./credits.dto";
import { getCreditBalance, getCreditLedger } from "./credits.services";

export const creditsKeys = {
	all: ["credits"] as const,
	balance: () => [...creditsKeys.all, "balance"] as const,
	ledgers: () => [...creditsKeys.all, "ledger"] as const,
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
