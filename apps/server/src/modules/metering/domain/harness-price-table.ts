/**
 * Prices a builder turn from the one LLM price table.
 * `turns.service.ts` calls it for the create-time estimate; the
 * builder-turn runtime calls it for the settle pricing snapshot.
 * Calls `llm-model-prices.ts` and `model-pricing.ts`; pure math, no I/O.
 */
import {
	llmModelPrice,
	priceUsdMicros,
} from "../../app-builder/domain/llm-model-prices";
import { usdMicrosToCentiCredits } from "./model-pricing";

/**
 * The settle `pricingSnapshot.table` value. Bump it when a row in
 * `LLM_MODEL_PRICES` changes so a settled event names the table that
 * priced it.
 */
export const HARNESS_PRICE_TABLE_VERSION = "llm-model-prices@1";

/**
 * Cost of `modelId` relative to the default model, rounded to 2 decimals.
 * Compares output rates. Output dominates a builder turn's cost. D10
 * quotes Opus as 2.5x Sonnet on that rate. Throws when either model has
 * no price row.
 */
export function harnessModelMultiplier(
	modelId: string,
	defaultModelId: string,
): number {
	return (
		Math.round(
			(outputUsdPerMTok(modelId) / outputUsdPerMTok(defaultModelId)) * 100,
		) / 100
	);
}

/**
 * The WANDIT-151 typical message: one builder turn is about 60k fresh
 * input, 180k cache reads, 20k cache writes, and 12k output tokens.
 * Source: Linear WANDIT-151 measurements, D2 notes.
 */
export const TYPICAL_TURN_USAGE = {
	cacheReadTokens: 180_000,
	cacheWriteTokens: 20_000,
	inputTokens: 60_000,
	outputTokens: 12_000,
} as const satisfies Parameters<typeof priceUsdMicros>[1];

/**
 * Centi-credit estimate of one typical turn on `modelId` (1 credit =
 * 100 cc). Throws when the model has no price row.
 */
export function typicalTurnCredits(
	modelId: string,
	usdMicrosPerCredit: number,
): number {
	const costUsdMicros = priceUsdMicros(modelId, TYPICAL_TURN_USAGE);
	if (costUsdMicros === null) {
		throw new Error(`No price row for model ${modelId}`);
	}
	return usdMicrosToCentiCredits(costUsdMicros, usdMicrosPerCredit);
}

// Output rate of one model; the rate the multiplier compares.
function outputUsdPerMTok(modelId: string): number {
	const price = llmModelPrice(modelId);
	if (price === undefined) {
		throw new Error(`No price row for model ${modelId}`);
	}
	return price.outputUsdPerMTok;
}
