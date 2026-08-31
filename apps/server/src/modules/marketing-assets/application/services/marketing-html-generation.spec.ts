import { APICallError, generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateMarketingAssetHtml } from "./marketing-html";

const mockEnv = vi.hoisted(() => ({
	AI_CHAT_MODEL: undefined as string | undefined,
	AI_GATEWAY_API_KEY: "gateway_test",
	AI_MARKETING_MODEL: "google/gemini-2.5-pro",
	AI_PROVIDER: undefined as "openrouter" | "vercel" | undefined,
	OPENROUTER_API_KEY: "openrouter_test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));
vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateText: vi.fn(),
}));

beforeEach(() => {
	mockEnv.AI_PROVIDER = undefined;
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
						tags: ["op:marketing", "ws:personal"],
						user: "user_1",
					},
					google: { thinkingConfig: { thinkingLevel: "high" } },
					openai: { reasoningEffort: "high" },
				},
				telemetry: { functionId: "marketing.html" },
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

	it("classifies an OpenRouter one-shot failure without returning raw text", async () => {
		mockEnv.AI_PROVIDER = "openrouter";
		vi.mocked(generateText).mockRejectedValueOnce(
			new APICallError({
				message: "upstream internal payload must stay private",
				requestBodyValues: {},
				statusCode: 502,
				url: "https://openrouter.ai/api/v1/chat/completions",
			}),
		);

		const result = await generateMarketingAssetHtml(
			{
				assetType: "ad-copy",
				brief: "BUSINESS: Example",
				dateLabel: "1 août 2026",
				name: "Campaign",
			},
			{ operation: "marketing", userId: "user_1" },
		);

		expect(result).toMatchObject({
			failure: {
				kind: "provider_error",
				source: "openrouter",
			},
			message: "The AI provider returned an error. Please try again.",
			status: "failed",
		});
		if (result.status === "generated") {
			throw new Error("Expected marketing generation to fail");
		}
		expect(result.message).not.toContain("internal payload");
	});
});
