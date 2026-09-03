import { describe, expect, it } from "vitest";

import {
	formatTokenCount,
	summarizeConversationTokenUsage,
} from "./token-usage";

describe("formatTokenCount", () => {
	it.each([
		[950, "950"],
		[8_421, "8.4k"],
		[1_234_000, "1.2M"],
	])("formats %i compactly", (tokens, expected) => {
		expect(formatTokenCount(tokens)).toBe(expected);
	});
});

describe("summarizeConversationTokenUsage", () => {
	it("uses final-step usage for context without changing cumulative spend", () => {
		const summary = summarizeConversationTokenUsage([
			{
				role: "assistant",
				metadata: {
					stepCount: 3,
					lastStepUsage: {
						inputTokens: 63_000,
						inputTokenDetails: { cacheReadTokens: 48_000 },
						outputTokens: 1_000,
					},
					usage: {
						inputTokens: 190_000,
						outputTokens: 4_000,
					},
				},
			},
		]);

		expect(summary).toEqual({
			cumulativeInputTokens: 190_000,
			cumulativeOutputTokens: 4_000,
			contextPercent: 6.4,
			contextTokens: 64_000,
			latestCacheReadShare: 48_000 / 63_000,
			totalTokens: 194_000,
		});
	});

	it("uses the latest assistant context and sums conversation totals", () => {
		const summary = summarizeConversationTokenUsage([
			{
				role: "assistant",
				metadata: {
					usage: {
						inputTokens: 80_000,
						inputTokenDetails: { cacheReadTokens: 60_000 },
						outputTokens: 20_000,
					},
				},
			},
			{
				role: "user",
				metadata: {
					usage: {
						inputTokens: 999_000,
						outputTokens: 1_000,
						totalTokens: 1_000_000,
					},
				},
			},
			{
				role: "assistant",
				metadata: {
					usage: {
						inputTokens: 120_000,
						inputTokenDetails: { cacheReadTokens: 90_000 },
						outputTokens: 3_400,
						totalTokens: 125_000,
					},
				},
			},
		]);

		expect(summary).toEqual({
			cumulativeInputTokens: 200_000,
			cumulativeOutputTokens: 23_400,
			contextPercent: 12.34,
			contextTokens: 123_400,
			latestCacheReadShare: 0.75,
			totalTokens: 225_000,
		});
	});

	it("keeps the latest completed usage while a new reply only has model metadata", () => {
		const summary = summarizeConversationTokenUsage([
			{
				role: "assistant",
				metadata: {
					usage: {
						inputTokens: 500,
						inputTokenDetails: { cacheReadTokens: 125 },
						outputTokens: 250,
					},
				},
			},
			{ role: "assistant", metadata: { model: "provider/model" } },
		]);

		expect(summary?.contextTokens).toBe(750);
		expect(summary?.latestCacheReadShare).toBe(0.25);
	});

	it("omits the cache-read share when the latest input count is zero", () => {
		const summary = summarizeConversationTokenUsage([
			{
				role: "assistant",
				metadata: {
					usage: {
						inputTokens: 0,
						inputTokenDetails: { cacheReadTokens: 0 },
						outputTokens: 250,
					},
				},
			},
		]);

		expect(summary?.latestCacheReadShare).toBeUndefined();
	});

	it("preserves an explicit zero cache-read share", () => {
		const summary = summarizeConversationTokenUsage([
			{
				role: "assistant",
				metadata: {
					usage: {
						inputTokens: 100,
						inputTokenDetails: { cacheReadTokens: 0 },
						outputTokens: 10,
					},
				},
			},
		]);

		expect(summary?.latestCacheReadShare).toBe(0);
	});

	it("does not carry a stale cache share into a newer completed turn", () => {
		const summary = summarizeConversationTokenUsage([
			{
				role: "assistant",
				metadata: {
					usage: {
						inputTokens: 100,
						inputTokenDetails: { cacheReadTokens: 90 },
						outputTokens: 10,
					},
				},
			},
			{
				role: "assistant",
				metadata: { usage: { inputTokens: 200, outputTokens: 20 } },
			},
		]);

		expect(summary?.latestCacheReadShare).toBeUndefined();
	});

	it("returns null when no assistant has input or output usage", () => {
		expect(
			summarizeConversationTokenUsage([
				{ role: "user" },
				{ role: "assistant", metadata: { model: "provider/model" } },
			]),
		).toBeNull();
	});
});
