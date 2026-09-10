import { createGateway, GatewayResponseError } from "@ai-sdk/gateway";
import { APICallError, generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLlmModel } from "../../../ai-provider/domain/llm-provider";
import { MARKETING_ASSET_PROVIDER_TIMEOUT_MS } from "./marketing-generation-budget";
import { generateMarketingAssetHtml } from "./marketing-html";

const mockEnv = vi.hoisted(() => ({
	AI_CHAT_MODEL: undefined as string | undefined,
	AI_GATEWAY_API_KEY: "gateway_test",
	AI_MARKETING_MODEL: undefined as string | undefined,
	AI_PAGE_BUILDER_MODEL: undefined as string | undefined,
	AI_PAGE_DESIGN_MODEL: undefined as string | undefined,
	AI_PROVIDER: undefined as "openrouter" | "vercel" | undefined,
	OPENROUTER_API_KEY: "openrouter_test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));
vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateText: vi.fn(),
}));
vi.mock("../../../ai-provider/domain/llm-provider", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("../../../ai-provider/domain/llm-provider")
		>();
	return { ...original, createLlmModel: vi.fn(original.createLlmModel) };
});

const INPUT = {
	assetType: "ad-copy" as const,
	brief: "BUSINESS: Example",
	dateLabel: "1 août 2026",
	name: "Campaign",
};
const METERING = { operation: "marketing" as const, userId: "user_1" };

beforeEach(() => {
	mockEnv.AI_CHAT_MODEL = "zai/glm-5.3-flash";
	mockEnv.AI_MARKETING_MODEL = "google/gemini-3.8-flash";
	mockEnv.AI_PAGE_BUILDER_MODEL = "openai/gpt-5.6-sol";
	mockEnv.AI_PAGE_DESIGN_MODEL = "openai/gpt-5.6-luna";
	mockEnv.AI_PROVIDER = undefined;
	vi.mocked(createLlmModel).mockClear();
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
				model: "google/gemini-3.8-flash",
				providerOptions: {
					gateway: {
						tags: ["op:marketing", "ws:personal"],
						user: "user_1",
					},
				},
				reasoning: "medium",
				telemetry: { functionId: "marketing.html" },
				timeout: MARKETING_ASSET_PROVIDER_TIMEOUT_MS,
			}),
		);
		expect(result).toMatchObject({
			model: "google/gemini-3.8-flash",
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

	it.each([
		{
			label: "explicit marketing override before either builder model",
			marketing: "google/gemini-3.8-flash",
			builder: "openai/gpt-5.6-sol",
			legacyBuilder: "openai/gpt-5.6-luna",
			expected: "google/gemini-3.8-flash",
		},
		{
			label: "builder model instead of the brain when marketing is unset",
			marketing: undefined,
			builder: "openai/gpt-5.6-sol",
			legacyBuilder: "openai/gpt-5.6-luna",
			expected: "openai/gpt-5.6-sol",
		},
		{
			label: "legacy builder model when the newer builder setting is unset",
			marketing: undefined,
			builder: undefined,
			legacyBuilder: "openai/gpt-5.6-luna",
			expected: "openai/gpt-5.6-luna",
		},
	])("uses $label", async ({ marketing, builder, legacyBuilder, expected }) => {
		mockEnv.AI_MARKETING_MODEL = marketing;
		mockEnv.AI_PAGE_BUILDER_MODEL = builder;
		mockEnv.AI_PAGE_DESIGN_MODEL = legacyBuilder;

		const result = await generateMarketingAssetHtml(INPUT, METERING);

		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({ model: expected, reasoning: "medium" }),
		);
		expect(result).toMatchObject({ model: expected, status: "generated" });
	});

	it("does not silently use the brain when no document model is configured", async () => {
		mockEnv.AI_MARKETING_MODEL = undefined;
		mockEnv.AI_PAGE_BUILDER_MODEL = undefined;
		mockEnv.AI_PAGE_DESIGN_MODEL = undefined;

		const result = await generateMarketingAssetHtml(INPUT, METERING);

		expect(result).toMatchObject({ status: "unavailable" });
		expect(generateText).not.toHaveBeenCalled();
	});

	it("requests medium reasoning on the OpenRouter path", async () => {
		mockEnv.AI_PROVIDER = "openrouter";

		await generateMarketingAssetHtml(INPUT, METERING);

		expect(createLlmModel).toHaveBeenCalledWith("google/gemini-3.8-flash", {
			context: METERING,
			reasoningEffort: "medium",
			task: "marketing",
		});
		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({ providerOptions: {}, reasoning: "medium" }),
		);
	});

	it("sends medium reasoning through the installed SDK and Gateway transport", async () => {
		const actualAi = await vi.importActual<typeof import("ai")>("ai");
		const fetch = vi.fn<typeof globalThis.fetch>(async () =>
			Response.json({
				content: [
					{ type: "text", text: "<!doctype html><html>Campaign</html>" },
				],
				finishReason: { unified: "stop", raw: "stop" },
				providerMetadata: { gateway: { generationId: "gen_gateway_medium" } },
				usage: {
					inputTokens: {
						total: 100,
						noCache: 100,
						cacheRead: 0,
						cacheWrite: 0,
					},
					outputTokens: { total: 50, text: 50, reasoning: 0 },
				},
			}),
		);
		vi.mocked(createLlmModel).mockReturnValueOnce(
			createGateway({ apiKey: "gateway_test", fetch })(
				"google/gemini-3.8-flash",
			),
		);
		vi.mocked(generateText).mockImplementationOnce(actualAi.generateText);

		const result = await generateMarketingAssetHtml(INPUT, METERING);

		expect(result).toMatchObject({ status: "generated" });
		expect(fetch).toHaveBeenCalledTimes(1);
		const requestBody = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
		expect(requestBody).toMatchObject({
			reasoning: "medium",
			providerOptions: {
				gateway: { tags: ["op:marketing", "ws:personal"], user: "user_1" },
			},
		});
		expect(requestBody.providerOptions.google).toBeUndefined();
		expect(requestBody.providerOptions.openai).toBeUndefined();
	});

	it("retains provider evidence when the provider deadline expires", async () => {
		const onProviderGeneration = vi.fn(async () => undefined);
		vi.mocked(generateText).mockRejectedValueOnce(
			new GatewayResponseError({
				cause: new DOMException("Deadline exceeded", "TimeoutError"),
				generationId: "gen_marketing_timeout",
			}),
		);

		const result = await generateMarketingAssetHtml(
			INPUT,
			METERING,
			undefined,
			onProviderGeneration,
		);

		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({ timeout: MARKETING_ASSET_PROVIDER_TIMEOUT_MS }),
		);
		expect(onProviderGeneration).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			failure: { kind: "timeout", requestId: "gen_marketing_timeout" },
			providerMetadata: { gateway: { generationId: "gen_marketing_timeout" } },
			providerUnits: 0,
			status: "failed",
		});
	});

	it("preserves the caller's cancellation signal and failure classification", async () => {
		const controller = new AbortController();
		controller.abort(new DOMException("Cancelled by caller", "AbortError"));
		vi.mocked(generateText).mockRejectedValue(controller.signal.reason);

		const result = await generateMarketingAssetHtml(
			INPUT,
			METERING,
			controller.signal,
		);

		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({ abortSignal: controller.signal }),
		);
		expect(result).toMatchObject({
			failure: { kind: "cancelled", source: "ours" },
			status: "failed",
		});
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
			message:
				"Our AI provider is experiencing high demand. Please try again in a few minutes.",
			status: "failed",
		});
		if (result.status === "generated") {
			throw new Error("Expected marketing generation to fail");
		}
		expect(result.message).not.toContain("internal payload");
	});
});
