import type { CreditBalanceResponse } from "@wandit/contracts";

import { useSession } from "@/features/auth";
import { useCreditBalanceQuery } from "../api/credits.queries";

/**
 * Settle-on-actuals can push the balance below zero (a running generation is
 * never killed mid-flight), so "out" means <= 0 — not just exactly empty.
 * Fractional balances below the 0.10-credit chat reserve floor (e.g. 0.05)
 * deliberately pass this gate: the server's 402 stays the authority on
 * whether a reserve is affordable, and the composer surfaces that error.
 * An unloaded/failed balance never blocks: composers fail open.
 */
export function isOutOfCredits(
	balance: CreditBalanceResponse | undefined,
): boolean {
	return balance !== undefined && balance.balance <= 0;
}

/**
 * Reactive out-of-credits gate for composer surfaces. Recovery needs no manual
 * wiring: the underlying balance query polls every 15s and is invalidated on
 * billing errors, finished turns and the /billing/success return — so the gate
 * lifts on its own once a resubscribe or top-up lands.
 */
export function useOutOfCredits() {
	const { data: session } = useSession();
	const balanceQuery = useCreditBalanceQuery({ enabled: Boolean(session) });

	return {
		outOfCredits: Boolean(session) && isOutOfCredits(balanceQuery.data),
	};
}
