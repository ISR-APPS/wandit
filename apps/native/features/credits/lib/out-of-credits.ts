import { useQuery } from "@tanstack/react-query";
import type { CreditBalanceResponse } from "@wandit/contracts";

import { creditsKeys } from "../api/credits.keys";
import { getCreditBalance } from "../api/credits.requests";

/**
 * Gate on `settledBalance` (reserves excluded) so the composer never locks
 * during an in-flight hold. Settle-on-actuals can push it below zero (a
 * running generation is never killed mid-flight), so "out" means <= 0.
 * An unloaded/failed balance never blocks: composers fail open and let the
 * server's 402 be the authority. (Web parity: out-of-credits.ts.)
 */
export function isOutOfCredits(
	balance: CreditBalanceResponse | undefined,
): boolean {
	return balance !== undefined && balance.settledBalance <= 0;
}

/**
 * Reactive out-of-credits gate for composer surfaces. No polling: the chat
 * hook and the generation cards invalidate the balance on billing errors and
 * on settle, so the gate engages on a refusal and lifts once a top-up (done
 * on web) lands and the query refetches. Mounted only inside the
 * authenticated app group, so no session gate is needed; a signed-out/failed
 * fetch leaves `data` undefined and fails open.
 */
export function useOutOfCredits() {
	const balanceQuery = useQuery({
		queryKey: creditsKeys.balance(),
		queryFn: getCreditBalance,
	});

	return { outOfCredits: isOutOfCredits(balanceQuery.data) };
}
