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
 * measurements; add a row for `V2_DEFAULT_MODEL` when it is picked. When you
 * change a row, bump `HARNESS_PRICE_TABLE_VERSION` in
 * modules/metering/domain/harness-price-table.ts.
 * The builder menu shows a row `<id>-fast` as the Fast toggle of the row `<id>`,
 * when `<id>` is in this table. A lone `-fast` row keeps its own menu row.
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
		// Vercel AI Gateway list prices read 2026-10-06: 2x the Opus 5.5 rates.
		// The gateway lists the 5-minute cache write ($10). This row uses the
		// 1-hour rate, 2x input, like the Opus 5.5 row.
		provider: "anthropic",
		modelId: "anthropic/claude-opus-5.5-fast",
		inputUsdPerMTok: 8,
		outputUsdPerMTok: 40,
		cacheReadUsdPerMTok: 0.4,
		cacheWriteUsdPerMTok: 16,
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
		// Gateway list prices read 2026-11-03: 2x the Opus 5 rates. Anthropic
		// is the only host. Its `/endpoints` row shows the Opus 5 rates, so
		// this row uses the higher list rates. Cache write is the 1-hour rate,
		// 2x input, like the Opus 5.5 rows.
		provider: "anthropic",
		modelId: "anthropic/claude-opus-5-fast",
		inputUsdPerMTok: 10,
		outputUsdPerMTok: 50,
		cacheReadUsdPerMTok: 1,
		cacheWriteUsdPerMTok: 20,
	},
	{
		// Gateway list prices read 2026-11-03, the same on Anthropic, Bedrock,
		// and Vertex. The gateway lists the 5-minute cache write ($12.50).
		// This row uses the 1-hour rate, 2x input, like the Opus 5.5 rows.
		provider: "anthropic",
		modelId: "anthropic/claude-fable-5.1",
		inputUsdPerMTok: 10,
		outputUsdPerMTok: 50,
		cacheReadUsdPerMTok: 0.25,
		cacheWriteUsdPerMTok: 20,
	},
	{
		// Paper Instruments list prices read 2026-10-17 (docs billing page).
		// Reasoning bills as output. Paper has no cache-write rate, so a
		// cache-creation token bills as plain input.
		provider: "paperinstruments",
		modelId: "paperinstruments/ultramarine-1-flash",
		inputUsdPerMTok: 0.15,
		outputUsdPerMTok: 0.5,
		cacheReadUsdPerMTok: 0.03,
		cacheWriteUsdPerMTok: 0.15,
	},
	{
		// Gateway rates of Fireworks, read 2026-10-22 (/v1/models/<id>/endpoints).
		// The gateway tries our Fireworks key first, then Baseten at the same
		// rates. The gateway lists $0.075 / $0.30, the rate of the DeepSeek host.
		// Cache read is the Baseten rate, the higher of the two. Cache write
		// has no rate, so it bills as input.
		// LIMIT: a fallback host with system keys can bill another rate.
		// Upgrade: read `provider_metadata.gateway.marketCost` from the stream.
		provider: "deepseek",
		modelId: "deepseek/deepseek-v4.1-flash-1017",
		inputUsdPerMTok: 0.3,
		outputUsdPerMTok: 1.2,
		cacheReadUsdPerMTok: 0.007,
		cacheWriteUsdPerMTok: 0.3,
	},
	{
		// Gateway rates read 2026-10-22. Baseten is the only host. Cache write
		// has no rate, so it bills as input.
		provider: "deepseek",
		modelId: "deepseek/deepseek-v4.1-flash-1017-fast",
		inputUsdPerMTok: 0.6,
		outputUsdPerMTok: 2.4,
		cacheReadUsdPerMTok: 0.014,
		cacheWriteUsdPerMTok: 0.6,
	},
	{
		// Gateway rates read 2026-11-03 (/v1/models/<id>/endpoints). The gateway
		// tries our Fireworks key first: $1.40 / $4.40, the list rate. Fireworks
		// bills cache read at $0.26, above the $0.14 list rate (Baseten), so
		// this row uses $0.26. Cache write has no rate, so it bills as input.
		// LIMIT: a fallback host with system keys can bill more, for example
		// Bedrock at $1.68 / $5.28. Upgrade: read `provider_metadata.gateway.marketCost`.
		provider: "zai",
		modelId: "zai/glm-5.3",
		inputUsdPerMTok: 1.4,
		outputUsdPerMTok: 4.4,
		cacheReadUsdPerMTok: 0.26,
		cacheWriteUsdPerMTok: 1.4,
	},
	{
		// Gateway rates read 2026-11-03. Baseten bills the list rate: $2.10 /
		// $6.60, cache read $0.21. Alibaba bills $2.80 / $8.80, cache read $0.56.
		// Fireworks does not host this model, so the gateway can pick either
		// host first. This row uses the higher Alibaba rates. Cache write has
		// no rate, so it bills as input.
		provider: "zai",
		modelId: "zai/glm-5.3-fast",
		inputUsdPerMTok: 2.8,
		outputUsdPerMTok: 8.8,
		cacheReadUsdPerMTok: 0.56,
		cacheWriteUsdPerMTok: 2.8,
	},
	{
		// Gateway rates read 2026-10-22: the same on Fireworks, Baseten, and
		// Z.ai. Cache write has no rate, so it bills as input.
		provider: "zai",
		modelId: "zai/glm-5.3-flash",
		inputUsdPerMTok: 0.15,
		outputUsdPerMTok: 0.5,
		cacheReadUsdPerMTok: 0.03,
		cacheWriteUsdPerMTok: 0.15,
	},
	{
		// Gateway list prices read 2026-11-03, the same on Google and Vertex.
		// Cache write has no rate, so it bills as input.
		provider: "google",
		modelId: "google/gemini-4-argon",
		inputUsdPerMTok: 2,
		outputUsdPerMTok: 10,
		cacheReadUsdPerMTok: 0.1,
		cacheWriteUsdPerMTok: 2,
	},
	{
		// Gateway list prices read 2026-11-03, the same on OpenAI and Azure.
		// LIMIT: above 272k prompt tokens, OpenAI bills 2x input, cache read, and
		// cache write, and 1.5x output. Claude Code assumes a 200k window for
		// this id, so most requests stay below.
		// Upgrade: price each request from its prompt size.
		provider: "openai",
		modelId: "openai/gpt-6.1-terra",
		inputUsdPerMTok: 1,
		outputUsdPerMTok: 5,
		cacheReadUsdPerMTok: 0.05,
		cacheWriteUsdPerMTok: 1.25,
	},
	{
		// Gateway list prices read 2026-11-03: 2x the Terra rates. OpenAI is
		// the only host. Its `/endpoints` row shows the Terra rates and a
		// `priority` tier at $2 / $10, so this row uses the higher list rates.
		// LIMIT: above 272k prompt tokens, OpenAI bills $4 / $15, and 2x cache
		// read and cache write. Claude Code assumes a 200k window for this id.
		// Upgrade: price each request from its prompt size.
		provider: "openai",
		modelId: "openai/gpt-6.1-terra-fast",
		inputUsdPerMTok: 2,
		outputUsdPerMTok: 10,
		cacheReadUsdPerMTok: 0.1,
		cacheWriteUsdPerMTok: 2.5,
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
