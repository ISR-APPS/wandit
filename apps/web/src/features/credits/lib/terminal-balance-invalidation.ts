import type { QueryClient } from "@tanstack/react-query";

import { creditsKeys } from "../api/credits.queries";

// Several async runners publish their durable `failed` row just before the
// metering refund finishes. settledBalance is flat before and after a full
// refund, so the recheck only fixes the activity row status, never the number.
const FAILURE_SETTLEMENT_RECHECK_MS = 2_000;

/** Refresh the balance and the activity list together after an operation ends. */
export function invalidateCreditActivity(queryClient: QueryClient) {
	void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });
	void queryClient.invalidateQueries({ queryKey: creditsKeys.activities() });
}

export function invalidateBalanceAfterGenerationTerminal(
	queryClient: QueryClient,
	status: string,
) {
	invalidateCreditActivity(queryClient);

	if (status === "failed") {
		globalThis.setTimeout(() => {
			invalidateCreditActivity(queryClient);
		}, FAILURE_SETTLEMENT_RECHECK_MS);
	}
}
