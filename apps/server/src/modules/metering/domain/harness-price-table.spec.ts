import { describe, expect, it } from "vitest";

import { LLM_MODEL_PRICES } from "../../app-builder/domain/llm-model-prices";
import {
	harnessModelMultiplier,
	typicalTurnCredits,
} from "./harness-price-table";

describe("LLM_MODEL_PRICES", () => {
	it("pins the Sonnet 5 and Opus 5 rows the multiplier divides", () => {
		const sonnet = LLM_MODEL_PRICES.find(
			(row) => row.modelId === "anthropic/claude-sonnet-5",
		);
		const opus = LLM_MODEL_PRICES.find(
			(row) => row.modelId === "anthropic/claude-opus-5",
		);

		expect(sonnet).toMatchObject({
			cacheReadUsdPerMTok: 0.2,
			cacheWriteUsdPerMTok: 4,
			inputUsdPerMTok: 2,
			outputUsdPerMTok: 10,
		});
		expect(opus).toMatchObject({
			cacheReadUsdPerMTok: 0.5,
			cacheWriteUsdPerMTok: 10,
			inputUsdPerMTok: 5,
			outputUsdPerMTok: 25,
		});
	});
});

describe("harnessModelMultiplier", () => {
	it("returns 2.5 for Opus 5 over Sonnet 5", () => {
		expect(
			harnessModelMultiplier(
				"anthropic/claude-opus-5",
				"anthropic/claude-sonnet-5",
			),
		).toBe(2.5);
	});

	it("returns 1 for the same model", () => {
		expect(
			harnessModelMultiplier(
				"anthropic/claude-sonnet-5",
				"anthropic/claude-sonnet-5",
			),
		).toBe(1);
	});

	it("throws when a model has no price row", () => {
		expect(() =>
			harnessModelMultiplier("unknown/model", "anthropic/claude-sonnet-5"),
		).toThrow("No price row for model unknown/model");
		expect(() =>
			harnessModelMultiplier("anthropic/claude-sonnet-5", "unknown/model"),
		).toThrow("No price row for model unknown/model");
	});
});

describe("typicalTurnCredits", () => {
	it("prices the typical Sonnet 5 turn at exactly 1113 cc", () => {
		// 60_000x2 + 180_000x0.2 + 20_000x4 + 12_000x10 = $0.356 =
		// 356_000 micros; ceil(356_000 x 100 / 32_000) = 1113.
		expect(typicalTurnCredits("anthropic/claude-sonnet-5", 32_000)).toBe(1113);
	});

	it("throws when the model has no price row", () => {
		expect(() => typicalTurnCredits("unknown/model", 32_000)).toThrow(
			"No price row for model unknown/model",
		);
	});
});
