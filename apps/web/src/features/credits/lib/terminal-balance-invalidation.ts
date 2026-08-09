import type { QueryClient } from "@tanstack/react-query";

import { creditsKeys } from "../api/credits.queries";

// Several async runners publish their durable `failed` row just before the
// metering refund finishes. Refresh immediately for responsive UI, then once
// more after the short server-side settlement window so a pre-refund response
// cannot remain fresh in the shared balance cache.
const FAILURE_SETTLEMENT_RECHECK_MS = 2_000;

export function invalidateBalanceAfterGenerationTerminal(
	queryClient: QueryClient,
	status: string,
) {
	void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });

	if (status === "failed") {
		globalThis.setTimeout(() => {
			void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });
		}, FAILURE_SETTLEMENT_RECHECK_MS);
	}
}
