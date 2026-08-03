import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateMarketingAssetHtml } from "./marketing-html";

const mockEnv = vi.hoisted(() => ({
	AI_CHAT_MODEL: undefined as string | undefined,
	AI_GATEWAY_API_KEY: "gateway_test",
	AI_MARKETING_MODEL: "google/gemini-2.5-pro",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));
vi.mock("ai", () => ({ generateText: vi.fn() }));

beforeEach(() => {
	vi.mocked(generateText)
		.mockReset()
		.mockResolvedValue({
			providerMetadata: { gateway: { generationId: "generation_1" } },
			text: "<!doctype html><html><body>Document</body></html>",
			usage: { inputTokens: 100, outputTokens: 50 },
		} as unknown as Awaited<ReturnType<typeof generateText>>);
});

describe("generateMarketingAssetHtml", () => {
	it("tags the gateway call and returns capture metadata", async () => {
		const onProviderGeneration = vi.fn(async () => undefined);
		const result = await generateMarketingAssetHtml(
			{
				assetType: "ad-copy",
				brief: "BUSINESS: Example",
				dateLabel: "1 août 2026",
				name: "Campaign",
			},
			{ operation: "marketing", userId: "user_1" },
			undefined,
			onProviderGeneration,
		);

		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "google/gemini-2.5-pro",
				providerOptions: {
					gateway: {
						quotaEntityId: "user_1",
						tags: ["op:marketing", "ws:personal"],
						user: "user_1",
					},
					google: { thinkingConfig: { thinkingLevel: "high" } },
					openai: { reasoningEffort: "high" },
				},
			}),
		);
		expect(result).toMatchObject({
			model: "google/gemini-2.5-pro",
			providerMetadata: { gateway: { generationId: "generation_1" } },
			status: "generated",
			usage: { inputTokens: 100, outputTokens: 50 },
		});
		expect(onProviderGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				providerMetadata: { gateway: { generationId: "generation_1" } },
			}),
		);
	});
});
