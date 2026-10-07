import { llmModelPriceSchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { LLM_MODEL_PRICES, priceUsdMicros } from "./llm-model-prices";

describe("LLM_MODEL_PRICES", () => {
	it("pins the table shape WANDIT-174 reads", () => {
		for (const row of LLM_MODEL_PRICES) {
			expect(llmModelPriceSchema.safeParse(row).success).toBe(true);
		}
		// The allow-listed Anthropic models each need a row.
		const ids = LLM_MODEL_PRICES.map((row) => row.modelId);
		expect(ids).toContain("anthropic/claude-sonnet-5");
		expect(ids).toContain("anthropic/claude-opus-5.5");
		expect(ids).toContain("anthropic/claude-opus-5");
		expect(ids).toContain("anthropic/claude-haiku-4-5");
	});
});

describe("priceUsdMicros", () => {
	it("prices one million tokens per side exactly", () => {
		// Sonnet: $2 in + $10 out = $12 → 12_000_000 micros.
		expect(
			priceUsdMicros("anthropic/claude-sonnet-5", {
				inputTokens: 1_000_000,
				outputTokens: 1_000_000,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
		).toBe(12_000_000);
	});

	it("prices the Opus 5.5 default at $4 in and $20 out", () => {
		// The dotted id is the gateway id; the proxy forwards it unchanged.
		expect(
			priceUsdMicros("anthropic/claude-opus-5.5", {
				inputTokens: 1_000_000,
				outputTokens: 1_000_000,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
		).toBe(24_000_000);
	});

	it("applies cache-read and cache-write rates", () => {
		// Sonnet cache read $0.20/MTok, 1h write $4/MTok.
		expect(
			priceUsdMicros("anthropic/claude-sonnet-5", {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 1_000_000,
				cacheWriteTokens: 1_000_000,
			}),
		).toBe(4_200_000);
	});

	it("rounds a partial million-token unit up to whole micros", () => {
		// 1 sonnet input token = $2/MTok → 2 micros exactly.
		expect(
			priceUsdMicros("anthropic/claude-sonnet-5", {
				inputTokens: 1,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
		).toBe(2);
		// 1 sonnet cache-read token = $0.20/MTok → 0.2 micros → 1 (ceil).
		expect(
			priceUsdMicros("anthropic/claude-sonnet-5", {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 1,
				cacheWriteTokens: 0,
			}),
		).toBe(1);
	});

	it("returns 0 for zero usage and null for an unpriced model", () => {
		expect(
			priceUsdMicros("anthropic/claude-sonnet-5", {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
		).toBe(0);
		expect(
			priceUsdMicros("unknown/model", {
				inputTokens: 10,
				outputTokens: 10,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
		).toBeNull();
	});
});
