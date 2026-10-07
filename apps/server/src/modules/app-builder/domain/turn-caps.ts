/**
 * Cap constants and the month boundary the Turn API and the
 * builder-turn runtime share.
 * Pure constants and date math; no I/O.
 */

/**
 * Default per-turn cap in centi-credits: 10,000 credits = $320 of provider
 * cost at $0.032/credit. Zack's choice: a full first build on Opus 5.5 cost
 * more than the old 50-credit cap and failed mid-turn. The LLM proxy daily
 * cap per user (`LLM_PROXY_DAILY_USER_CAP_USD`) still applies. A
 * `project_cost_caps.perTurnCapCredits` row overrides this default.
 */
export const DEFAULT_PER_TURN_CAP_CREDITS = 1_000_000;

/**
 * First instant of the UTC calendar month `now` falls in. The monthly cap
 * window is the UTC calendar month, the same window `enforceMemberLimit`
 * uses for member spend.
 */
export function monthStartUtc(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
