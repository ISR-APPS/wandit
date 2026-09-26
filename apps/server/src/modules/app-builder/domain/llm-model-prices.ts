/**
 * Provider price table for the V2 LLM proxy, in USD per million tokens.
 * `LlmProxyService` prices each answered request; WANDIT-174 imports the
 * same table for settlement, so a change here moves both.
 * Pure data and math; no I/O.
 */
import type { LlmModelPrice } from "@wandit/contracts";

import type { LlmTokenUsage } from "./anthropic-sse-usage";

// 1 USD in the unit the tables and Redis counters carry.
const MICROS_PER_USD = 1_000_000n;

// Token counts per million-token unit, same scale as `usdPerMTok` fields.
const TOKENS_PER_MTOK = 1_000_000n;

/**
 * One price row per allow-listed model. `cacheWriteUsdPerMTok` is the
 * 1-hour cache-write rate. Rows marked ESTIMATE wait on WANDIT-151's
 * measurements; add a row for `V2_DEFAULT_MODEL` when it is picked.
 */
export const LLM_MODEL_PRICES: readonly LlmModelPrice[] = [
	{
		provider: "anthropic",
		modelId: "anthropic/claude-sonnet-5",
		inputUsdPerMTok: 2,
		outputUsdPerMTok: 10,
		cacheReadUsdPerMTok: 0.2,
		cacheWriteUsdPerMTok: 4,
	},
	{
		// The builder default since 2026-09-25 (Zack). Vercel AI Gateway list
		// prices read that day. Cache write is the 1-hour rate, 2x input.
		provider: "anthropic",
		modelId: "anthropic/claude-opus-5.5",
		inputUsdPerMTok: 4,
		outputUsdPerMTok: 20,
		cacheReadUsdPerMTok: 0.2,
		cacheWriteUsdPerMTok: 8,
	},
	{
		// ESTIMATE: WANDIT-151 measures the real Opus rate before billing on it.
		provider: "anthropic",
		modelId: "anthropic/claude-opus-5",
		inputUsdPerMTok: 5,
		outputUsdPerMTok: 25,
		cacheReadUsdPerMTok: 0.5,
		cacheWriteUsdPerMTok: 10,
	},
	{
		// ESTIMATE: WANDIT-151 measures the real Haiku rate before billing on it.
		provider: "anthropic",
		modelId: "anthropic/claude-haiku-4-5",
		inputUsdPerMTok: 1,
		outputUsdPerMTok: 5,
		cacheReadUsdPerMTok: 0.1,
		cacheWriteUsdPerMTok: 2,
	},
];

// Converts a dollars-per-MTok field into micros-per-MTok without float
// error; exact for any price with at most 6 decimals.
function microsPerMTok(usdPerMTok: number): bigint {
	return BigInt(Math.round(usdPerMTok * Number(MICROS_PER_USD)));
}

/**
 * The price row for one allow-list model id, or undefined. The proxy
 * refuses to forward a model this returns undefined for.
 */
export function llmModelPrice(modelId: string): LlmModelPrice | undefined {
	return LLM_MODEL_PRICES.find((row) => row.modelId === modelId);
}

/**
 * Cost of one request in USD micros, integer math throughout. Rounds the
 * total up so a partial million-token unit never underbills. Returns null
 * when the model has no price row — the caller still writes the usage row.
 */
export function priceUsdMicros(
	modelId: string,
	usage: LlmTokenUsage,
): number | null {
	const price = llmModelPrice(modelId);
	if (price === undefined) {
		return null;
	}
	const numerator =
		BigInt(usage.inputTokens) * microsPerMTok(price.inputUsdPerMTok) +
		BigInt(usage.outputTokens) * microsPerMTok(price.outputUsdPerMTok) +
		BigInt(usage.cacheReadTokens) * microsPerMTok(price.cacheReadUsdPerMTok) +
		BigInt(usage.cacheWriteTokens) * microsPerMTok(price.cacheWriteUsdPerMTok);
	// Ceiling division: any token fraction rounds up to a whole micro.
	return Number((numerator + TOKENS_PER_MTOK - 1n) / TOKENS_PER_MTOK);
}
