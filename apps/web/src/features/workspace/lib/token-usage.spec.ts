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
	it("uses the latest assistant context and sums conversation totals", () => {
		const summary = summarizeConversationTokenUsage([
			{
				role: "assistant",
				metadata: {
					usage: { inputTokens: 80_000, outputTokens: 20_000 },
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
						outputTokens: 3_400,
						totalTokens: 125_000,
					},
				},
			},
		]);

		expect(summary).toEqual({
			contextPercent: 12.34,
			contextTokens: 123_400,
			totalTokens: 225_000,
		});
	});

	it("keeps the latest completed usage while a new reply only has model metadata", () => {
		const summary = summarizeConversationTokenUsage([
			{
				role: "assistant",
				metadata: { usage: { inputTokens: 500, outputTokens: 250 } },
			},
			{ role: "assistant", metadata: { model: "provider/model" } },
		]);

		expect(summary?.contextTokens).toBe(750);
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
