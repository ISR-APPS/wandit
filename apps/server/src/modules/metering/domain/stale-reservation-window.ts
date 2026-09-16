/**
 * Stale-reservation windows for the stranded-hold sweep.
 * The recover-stranded-metering task calls `staleAfterMsFor` for its two
 * cutoff dates. The specs read the constants directly.
 */
import type { AiUsageOperation } from "./operation-registry";

/**
 * 40 minutes: well past the longest chat stream or measured generation, so a
 * live reservation of a non-agent operation is never refunded under it.
 */
export const RESERVATION_STALE_AFTER_MS = 40 * 60_000;

/**
 * 180 minutes. A running turn is safe under its execution lease; the window
 * only covers a queued turn. It waits behind at most two 60-minute turns
 * (three holds per actor), so 180 leaves margin before the sweep refunds it.
 */
export const AGENT_SESSION_STALE_AFTER_MS = 180 * 60_000;

/** Stale cutoff in ms for one operation; agent_session gets the longer window. */
export function staleAfterMsFor(operation: AiUsageOperation): number {
	return operation === "agent_session"
		? AGENT_SESSION_STALE_AFTER_MS
		: RESERVATION_STALE_AFTER_MS;
}
