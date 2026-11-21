/**
 * Out-of-credits gate for the composers: true when the settled balance is zero or below,
 * or when the pool must buy the Starter pass first.
 * The chat and page-build composers call useOutOfCredits. It reads useCreditBalanceQuery.
 * The create flows and the builder chat call isStarterPassRequiredError on a 402.
 */
import {
	type CreditBalanceResponse,
	paymentRequiredDetailsSchema,
} from "@wandit/contracts";

import { useSession } from "@/features/auth";
import { isApiClientError } from "@/lib/api-client";
import { useCreditBalanceQuery } from "../api/credits.queries";

/**
 * Settle-on-actuals can push the balance below zero (a running generation is
 * never killed mid-flight), so "out" means <= 0 — not just exactly empty.
 * The server's 402 admission check runs on the same SETTLED balance, so this
 * gate and the server agree by design: a stuck reserve hold can no longer
 * lock the composer while the header pill still shows credits (or vice
 * versa). Fractional balances below the 0.10-credit chat reserve floor
 * (e.g. 0.05) deliberately pass this gate: the server's 402 stays the
 * authority on whether a reserve is affordable, and the composer surfaces
 * that error. An unloaded/failed balance never blocks: composers fail open.
 * A pool that needs the Starter pass is locked too, whatever its balance:
 * the server refuses every spend of that pool.
 */
export function isOutOfCredits(
	balance: CreditBalanceResponse | undefined,
): boolean {
	return (
		balance !== undefined &&
		(balance.starterPassRequired === true || balance.settledBalance <= 0)
	);
}

/**
 * Reactive out-of-credits gate for composer surfaces. Recovery needs no manual
 * wiring: the underlying balance query is invalidated on billing errors,
 * finished operations, window focus and the /billing/success return — so the
 * gate lifts on its own once a top-up lands.
 * `starterPassRequired` tells the surfaces to sell the Starter pass, not a top-up.
 */
export function useOutOfCredits() {
	const { data: session } = useSession();
	const balanceQuery = useCreditBalanceQuery({ enabled: Boolean(session) });
	const isSignedIn = Boolean(session);

	return {
		outOfCredits: isSignedIn && isOutOfCredits(balanceQuery.data),
		starterPassRequired:
			isSignedIn && balanceQuery.data?.starterPassRequired === true,
	};
}

// Only the reason field is read. The other details fields can be absent on a bare 402.
const starterPassReasonSchema = paymentRequiredDetailsSchema.pick({
	reason: true,
});

/**
 * True when the API refused a spend with 402 because the pool has no Starter pass.
 * `error` is a caught error: an ApiClientError, or any other failure (then false).
 */
export function isStarterPassRequiredError(error: unknown): boolean {
	return (
		isApiClientError(error) &&
		error.statusCode === 402 &&
		starterPassReasonSchema.safeParse(error.details).data?.reason ===
			"starter_pass_required"
	);
}
