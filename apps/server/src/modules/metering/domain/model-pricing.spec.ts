import { describe, expect, it, vi } from "vitest";

import { BUILDER_MODEL_BY_OPTION } from "../../ai-chat/agent/tools/builder-model-options";
import { ModelPricingService } from "../application/services/model-pricing.service";
import type {
	ModelPriceRow,
	ModelPricesRepository,
} from "../infrastructure/persistence/model-prices.repository";
import {
	dollarsStringToUsdMicros,
	gatewayModelToPersistedPrice,
	imageUsageCostUsdMicros,
	type ModelPrice,
	normalizeTokenUsage,
	parseGatewayModelsResponse,
	perTokenDollarsStringToUsdMicrosPerMTok,
	tokenUsageCostUsdMicros,
	usdMicrosToCredits,
} from "./model-pricing";

const GENERATED_AT = new Date("2026-08-01T12:00:00.000Z");
const REPO_DEFAULT_MODEL_IDS = [
	...Object.values(BUILDER_MODEL_BY_OPTION),
	// packages/env/src/server.ts defaults.
	"openai/gpt-4o-mini",
	"openai/gpt-4o-mini-transcribe",
	"openai/gpt-5.6-luna",
	"anthropic/claude-sonnet-5",
	// The defensive fallback in project-title.service.ts remains catalogued even
	// though AI_TITLE_MODEL currently has its own environment default.
	"deepseek/deepseek-v4-flash",
] as const;

function modelPrice(overrides: Partial<ModelPrice> = {}): ModelPrice {
	return {
		cacheReadUsdMicrosPerMTok: 100_000,
		cacheWriteUsdMicrosPerMTok: 1_250_000,
		imageUsdMicros: 40_000,
		inputUsdMicrosPerMTok: 1_000_000,
		modelId: "provider/model",
		modelType: "language",
		outputUsdMicrosPerMTok: 2_000_000,
		provider: "provider",
		raw: {},
		refreshedAt: GENERATED_AT,
		source: "database",
		...overrides,
	};
}

function row(overrides: Partial<ModelPriceRow> = {}): ModelPriceRow {
	return {
		cacheReadUsdMicrosPerMTok: 75_000,
		cacheWriteUsdMicrosPerMTok: null,
		imageUsdMicros: null,
		inputUsdMicrosPerMTok: 150_000,
		modelId: "openai/gpt-4o-mini",
		modelType: "language",
		outputUsdMicrosPerMTok: 600_000,
		provider: "openai",
		raw: {},
		refreshedAt: GENERATED_AT,
		...overrides,
	};
}

function seed(
	models: unknown[] = [
		{
			id: "seed/image",
			owned_by: "seed-provider",
			pricing: { image: "0.04", input: "0.0000005", output: "0.000001" },
			type: "image",
		},
	],
) {
	return {
		data: models,
		generatedAt: GENERATED_AT.toISOString(),
		object: "list",
	};
}

class FakeModelPricesRepository {
	readonly findByModelId = vi.fn(
		async (modelId: string) => this.rows.get(modelId) ?? null,
	);
	readonly upsertMany = vi.fn(
		async (prices: readonly unknown[]) => prices.length,
	);

	constructor(readonly rows = new Map<string, ModelPriceRow>()) {}
}

describe("model pricing math", () => {
	it("converts gateway decimal strings exactly into persisted units", () => {
		expect(perTokenDollarsStringToUsdMicrosPerMTok("0.00000015")).toBe(150_000);
		expect(perTokenDollarsStringToUsdMicrosPerMTok("0.0000000002")).toBe(200);
		expect(dollarsStringToUsdMicros("0.04")).toBe(40_000);
		expect(() => dollarsStringToUsdMicros("0.0000001")).toThrow(
			"cannot be represented exactly",
		);
		expect(() => dollarsStringToUsdMicros("free")).toThrow(
			"Invalid USD micros decimal",
		);
	});

	it("parses token, cache, and default image prices from the gateway", () => {
		const payload = parseGatewayModelsResponse(
			seed([
				{
					id: "google/image",
					owned_by: "google",
					pricing: {
						image_dimension_quality_pricing: [
							{ cost: "0.067", size: "default" },
							{ cost: "0.151", size: "4K" },
						],
						input: "0.0000005",
						input_cache_read: "0.00000005",
						input_cache_write: "0.0000006",
						output: "0.000003",
					},
					type: "language",
				},
			]),
		);
		const gatewayModel = payload.data[0];
		if (!gatewayModel) {
			throw new Error("Expected the test gateway model");
		}
		const price = gatewayModelToPersistedPrice(gatewayModel, GENERATED_AT);

		expect(price).toMatchObject({
			cacheReadUsdMicrosPerMTok: 50_000,
			cacheWriteUsdMicrosPerMTok: 600_000,
			imageUsdMicros: 67_000,
			inputUsdMicrosPerMTok: 500_000,
			outputUsdMicrosPerMTok: 3_000_000,
		});
	});

	it("rejects malformed known pricing fields instead of persisting zero", () => {
		expect(() =>
			parseGatewayModelsResponse({
				data: [
					{
						id: "bad/model",
						owned_by: "bad",
						pricing: { input: "unknown" },
						type: "language",
					},
				],
			}),
		).toThrow();
	});

	it("uses cache-specific rates and bills missing input details as uncached", () => {
		const detailed = normalizeTokenUsage({
			inputTokenDetails: {
				cacheReadTokens: 200,
				cacheWriteTokens: 100,
				noCacheTokens: 700,
			},
			inputTokens: 1_000,
			outputTokens: 100,
		});

		expect(tokenUsageCostUsdMicros(modelPrice(), detailed)).toBe(1_045);

		const missingDetails = normalizeTokenUsage({
			inputTokens: 1_000,
			outputTokens: 0,
		});

		expect(missingDetails.uncachedInputTokens).toBe(1_000);
		expect(tokenUsageCostUsdMicros(modelPrice(), missingDetails)).toBe(1_000);
	});

	it("falls back to the base input rate when a cache rate is absent", () => {
		const usage = normalizeTokenUsage({
			inputTokenDetails: { cacheReadTokens: 1_000 },
			inputTokens: 1_000,
		});

		expect(
			tokenUsageCostUsdMicros(
				modelPrice({ cacheReadUsdMicrosPerMTok: null }),
				usage,
			),
		).toBe(1_000);
	});

	it("applies max(1, ceil(cost / usdPerCredit))", () => {
		expect(usdMicrosToCredits(0)).toBe(1);
		expect(usdMicrosToCredits(50_000)).toBe(1);
		expect(usdMicrosToCredits(50_001)).toBe(2);
		expect(usdMicrosToCredits(125_000, 50_000)).toBe(3);
	});

	it("prices provider image cost per successful image", () => {
		expect(imageUsageCostUsdMicros(modelPrice(), 3)).toBe(120_000);
	});
});

describe("ModelPricingService", () => {
	it("reads through the database and retains an entry until its one-hour TTL", async () => {
		let now = GENERATED_AT;
		const repository = new FakeModelPricesRepository(
			new Map([["openai/gpt-4o-mini", row()]]),
		);
		const service = new ModelPricingService(
			repository as unknown as ModelPricesRepository,
			{
				cacheTtlMs: 60 * 60 * 1000,
				now: () => now,
				seedResponse: seed(),
			},
		);

		expect((await service.get("openai/gpt-4o-mini"))?.source).toBe("database");
		await service.get("openai/gpt-4o-mini");
		expect(repository.findByModelId).toHaveBeenCalledTimes(1);

		now = new Date(GENERATED_AT.getTime() + 60 * 60 * 1000 + 1);
		await service.get("openai/gpt-4o-mini");
		expect(repository.findByModelId).toHaveBeenCalledTimes(2);
	});

	it("can retain one TTL cache across per-run process adapters", async () => {
		let now = GENERATED_AT;
		const cache = new Map();
		const firstRepository = new FakeModelPricesRepository(
			new Map([["openai/gpt-4o-mini", row()]]),
		);
		const secondRepository = new FakeModelPricesRepository();
		const options = {
			cache,
			cacheTtlMs: 60 * 60 * 1000,
			now: () => now,
			seedResponse: seed(),
		};
		const first = new ModelPricingService(
			firstRepository as unknown as ModelPricesRepository,
			options,
		);
		const second = new ModelPricingService(
			secondRepository as unknown as ModelPricesRepository,
			options,
		);

		await expect(first.get("openai/gpt-4o-mini")).resolves.toMatchObject({
			source: "database",
		});
		await expect(second.get("openai/gpt-4o-mini")).resolves.toMatchObject({
			source: "database",
		});
		expect(secondRepository.findByModelId).not.toHaveBeenCalled();

		now = new Date(GENERATED_AT.getTime() + 60 * 60 * 1000 + 1);
		await expect(second.get("openai/gpt-4o-mini")).resolves.toBeNull();
		expect(secondRepository.findByModelId).toHaveBeenCalledOnce();
	});

	it("falls back to the checked-in seed on a database miss", async () => {
		const repository = new FakeModelPricesRepository();
		const service = new ModelPricingService(
			repository as unknown as ModelPricesRepository,
			{ seedResponse: seed() },
		);

		expect(await service.get("seed/image")).toMatchObject({
			imageUsdMicros: 40_000,
			source: "seed",
		});
		expect(await service.get("missing/model")).toBeNull();
	});

	it("loads the checked-in gateway catalog and covers every repo model default or selector", async () => {
		const repository = new FakeModelPricesRepository();
		const service = new ModelPricingService(
			repository as unknown as ModelPricesRepository,
			{ usdMicrosPerCredit: 50_000 },
		);
		const requiredModelIds = [...new Set(REPO_DEFAULT_MODEL_IDS)].sort();
		const prices = await Promise.all(
			requiredModelIds.map((modelId) => service.get(modelId)),
		);

		expect(
			requiredModelIds.filter((_modelId, index) => prices[index] == null),
		).toEqual([]);
		for (const price of prices) {
			expect(price).toMatchObject({ source: "seed" });
			expect(price?.inputUsdMicrosPerMTok).not.toBeNull();
			expect(price?.outputUsdMicrosPerMTok).not.toBeNull();
		}

		await expect(service.get("openai/gpt-4o-mini")).resolves.toMatchObject({
			inputUsdMicrosPerMTok: 150_000,
			source: "seed",
		});
		await expect(
			service.get("anthropic/claude-sonnet-5"),
		).resolves.toMatchObject({
			cacheReadUsdMicrosPerMTok: 200_000,
			cacheWriteUsdMicrosPerMTok: 2_500_000,
		});
	});

	it("refreshes without auth, persists normalized rows, and invalidates cache", async () => {
		const repository = new FakeModelPricesRepository(
			new Map([["openai/gpt-4o-mini", row()]]),
		);
		const fetchModels = vi.fn(async () => ({
			json: async () => (seed().data.length > 0 ? seed() : {}),
			ok: true,
			status: 200,
			statusText: "OK",
		}));
		const service = new ModelPricingService(
			repository as unknown as ModelPricesRepository,
			{ fetch: fetchModels, now: () => GENERATED_AT, seedResponse: seed() },
		);

		await service.get("openai/gpt-4o-mini");
		const result = await service.refreshFromGateway();
		await service.get("openai/gpt-4o-mini");

		expect(result).toEqual({
			fetched: 1,
			persisted: 1,
			refreshedAt: GENERATED_AT,
		});
		expect(fetchModels).toHaveBeenCalledWith(
			"https://ai-gateway.vercel.sh/v1/models",
			expect.objectContaining({ headers: { Accept: "application/json" } }),
		);
		expect(repository.upsertMany).toHaveBeenCalledWith([
			expect.objectContaining({
				imageUsdMicros: 40_000,
				modelId: "seed/image",
			}),
		]);
		expect(repository.findByModelId).toHaveBeenCalledTimes(2);
	});

	it("rejects a malformed refresh response before persistence", async () => {
		const repository = new FakeModelPricesRepository();
		const service = new ModelPricingService(
			repository as unknown as ModelPricesRepository,
			{
				fetch: async () => ({
					json: async () => ({ data: [] }),
					ok: true,
					status: 200,
					statusText: "OK",
				}),
				seedResponse: seed(),
			},
		);

		await expect(service.refreshFromGateway()).rejects.toThrow();
		expect(repository.upsertMany).not.toHaveBeenCalled();
	});
});
