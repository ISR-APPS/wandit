// Pure decision logic for the prompt → project balance precheck, extracted
// from useCreateProjectWithPrompt so it stays testable without a DOM.

import { isApiClientError } from "@/lib/api-client";

export type CreatePrecheckResult =
	| "balance-unavailable"
	| "insufficient"
	| "ok";

/**
 * Convenience precheck only — the server reservation stays authoritative.
 * Operations bill measured cost, so ANY positive balance may start a run;
 * only a zero or negative balance blocks locally.
 */
export function precheckCreateBalance(
	availableCredits: number | undefined,
): CreatePrecheckResult {
	if (availableCredits === undefined) return "balance-unavailable";
	if (availableCredits <= 0) return "insufficient";
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
