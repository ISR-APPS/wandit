/**
 * Cap constants and the month boundary the Turn API and the
 * builder-turn runtime share.
 * Pure constants and date math; no I/O.
 */

/**
 * Default per-turn cap in centi-credits: 50 credits = $1.60 of provider
 * cost at $0.032/credit. The plan default until WANDIT-184 entitlements; a
 * `project_cost_caps.perTurnCapCredits` row overrides it.
 */
export const DEFAULT_PER_TURN_CAP_CREDITS = 5000;

/**
 * First instant of the UTC calendar month `now` falls in. The monthly cap
 * window is the UTC calendar month, the same window `enforceMemberLimit`
 * uses for member spend.
 */
export function monthStartUtc(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
