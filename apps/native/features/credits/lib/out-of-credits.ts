import { useQuery } from "@tanstack/react-query";
import type { CreditBalanceResponse } from "@wandit/contracts";

import { creditsKeys } from "../api/credits.keys";
import { getCreditBalance } from "../api/credits.requests";

/**
 * Settle-on-actuals can push the balance below zero (a running generation is
 * never killed mid-flight), so "out" means <= 0 — not just exactly empty.
 * An unloaded/failed balance never blocks: composers fail open and let the
 * server's 402 be the authority. (Web parity: out-of-credits.ts.)
 */
export function isOutOfCredits(
	balance: CreditBalanceResponse | undefined,
): boolean {
	return balance !== undefined && balance.balance <= 0;
}

/**
 * Reactive out-of-credits gate for composer surfaces. Recovery needs no
 * manual wiring: this observer polls every 15s and the chat hook invalidates
 * the balance on billing errors and finished turns — so the gate engages on a
 * refusal and lifts on its own once a top-up (done on web) lands. Mounted
 * only inside the authenticated app group, so no session gate is needed; a
 * signed-out/failed fetch leaves `data` undefined and fails open.
 */
export function useOutOfCredits() {
	const balanceQuery = useQuery({
		queryKey: creditsKeys.balance(),
		queryFn: getCreditBalance,
		refetchInterval: 15_000,
	});

	return { outOfCredits: isOutOfCredits(balanceQuery.data) };
}
