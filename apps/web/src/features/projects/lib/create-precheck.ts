// Pure decision logic for the prompt → project balance precheck, extracted
// from useCreateProjectWithPrompt so it stays testable without a DOM.

import type { CreditBalanceResponse } from "@wandit/contracts";

import { isOutOfCredits } from "@/features/credits";
import { isApiClientError } from "@/lib/api-client";

export type CreatePrecheckResult =
	| "balance-unavailable"
	| "insufficient"
	| "ok";

/**
 * Convenience precheck only — the server reservation stays authoritative.
 * Operations bill measured cost, so ANY positive balance may start a run;
 * only a zero or negative settled balance, or a pool with no Starter pass, blocks locally.
 * `balance` is the cached balance of the active workspace pool; undefined while it loads or after it fails.
 */
export function precheckCreateBalance(
	balance: CreditBalanceResponse | undefined,
): CreatePrecheckResult {
	if (balance === undefined) return "balance-unavailable";
	if (isOutOfCredits(balance)) return "insufficient";
	return "ok";
}

/** The server refused the create for credits — invalidate balance and stop. */
export function isInsufficientCreditsApiError(error: unknown): boolean {
	return (
		isApiClientError(error) &&
		error.statusCode === 402 &&
		(error.code === "INSUFFICIENT_CREDITS" ||
			error.code === "GENERATION_PAYMENT_REQUIRED")
	);
}
