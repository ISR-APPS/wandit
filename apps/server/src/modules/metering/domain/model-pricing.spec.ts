import {
	APP_AI_IMAGE_MODELS,
	APP_AI_MODELS,
	APP_AI_SPEECH_MODELS,
	APP_AI_TRANSCRIPTION_MODELS,
	APP_AI_VIDEO_CAPABILITIES,
	APP_AI_VIDEO_MODELS,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { BUILDER_MODEL_BY_OPTION } from "../../ai-chat/agent/tools/builder-model-options";
import { ModelPricingService } from "../application/services/model-pricing.service";
import type {
	ModelPriceRow,
	ModelPricesRepository,
} from "../infrastructure/persistence/model-prices.repository";
import {
	dollarsStringToUsdMicros,
	gatewayModelSchema,
	gatewayModelToPersistedPrice,
	imageEstimateUsdMicros,
	imageGenerateSizes,
	imageUsageCostUsdMicros,
	type ModelPrice,
	ModelPriceUnavailableError,
	normalizeTokenUsage,
	parseGatewayModelsResponse,
	perTokenDollarsStringToUsdMicrosPerMTok,
	priceAtPromptSize,
	pricingSnapshot,
	speechEstimateUsdMicros,
	tokenUsageCostUsdMicros,
	transcriptionEstimateUsdMicros,
	usdMicrosToCentiCredits,
	videoEstimateUsdMicros,
	videoUnitUsdMicrosPerSecond,
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
		transcriptionUsdMicrosPerSecond: null,
		variantPricing: null,
		...overrides,
	};
}

// The catalog pricing of openai/gpt-6.1-sol: the tier starts at 272,001 prompt tokens.
const OPENAI_TIERED_PRICING = {
	input: "0.000002",
	input_tiers: [
		{ cost: "0.000002", min: 0, max: 272_001 },
		{ cost: "0.000004", min: 272_001 },
	],
	output: "0.00001",
	output_tiers: [
		{ cost: "0.00001", min: 0, max: 272_001 },
		{ cost: "0.000015", min: 272_001 },
	],
	input_cache_read: "0.0000001",
	input_cache_read_tiers: [
		{ cost: "0.0000001", min: 0, max: 272_001 },
		{ cost: "0.0000002", min: 272_001 },
	],
	input_cache_write: "0.0000025",
	input_cache_write_tiers: [
		{ cost: "0.0000025", min: 0, max: 272_001 },
		{ cost: "0.000005", min: 272_001 },
	],
};

// The catalog pricing of anthropic/claude-haiku-5.5: 5 x from 100,001 prompt tokens.
const HAIKU_TIERED_PRICING = {
	input: "0.0000001",
	input_tiers: [
		{ cost: "0.0000001", min: 0, max: 100_001 },
		{ cost: "0.0000005", min: 100_001 },
	],
	output: "0.0000005",
	output_tiers: [
		{ cost: "0.0000005", min: 0, max: 100_001 },
		{ cost: "0.0000025", min: 100_001 },
	],
	input_cache_read: "0.00000001",
	input_cache_read_tiers: [
		{ cost: "0.00000001", min: 0, max: 100_001 },
		{ cost: "0.00000005", min: 100_001 },
	],
	input_cache_write: "0.000000125",
	input_cache_write_tiers: [
		{ cost: "0.000000125", min: 0, max: 100_001 },
		{ cost: "0.000000625", min: 100_001 },
	],
};

// The catalog pricing of openai/gpt-6-astra: its first tiers have no `min`.
const FIRST_TIER_WITHOUT_MIN_PRICING = {
	input: "0.00001",
	input_tiers: [
		{ cost: "0.00001", max: 272_001 },
		{ cost: "0.00002", min: 272_001 },
	],
	output: "0.00005",
	output_tiers: [
		{ cost: "0.00005", max: 272_001 },
		{ cost: "0.000075", min: 272_001 },
	],
	input_cache_read: "0.000001",
	input_cache_read_tiers: [
		{ cost: "0.000001", max: 272_001 },
		{ cost: "0.000002", min: 272_001 },
	],
	input_cache_write: "0.0000125",
	input_cache_write_tiers: [
		{ cost: "0.0000125", max: 272_001 },
		{ cost: "0.000025", min: 272_001 },
	],
};

// A price row built from one catalog entry, as the hourly refresh builds it.
function catalogPrice(pricing: unknown): ModelPrice {
	const model = gatewayModelSchema.parse({
		id: "provider/model",
		owned_by: "provider",
		pricing,
		type: "language",
	});
	return {
		...gatewayModelToPersistedPrice(model, GENERATED_AT),
		source: "database",
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
		transcriptionUsdMicrosPerSecond: null,
		variantPricing: null,
		...overrides,
	};
}

function gatewayPrice(model: unknown) {
	const payload = parseGatewayModelsResponse(seed([model]));
	const gatewayModel = payload.data[0];
	if (!gatewayModel) {
		throw new Error("Expected the test gateway model");
	}
	return gatewayModelToPersistedPrice(gatewayModel, GENERATED_AT);
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

	it("parses the transcription per-second rate", () => {
		const whisper = gatewayPrice({
			id: "openai/whisper",
			owned_by: "openai",
			pricing: {
				input: "0.0000000001",
				transcription_duration_cost_per_second: "0.0001",
			},
			type: "transcription",
		});

		expect(whisper.transcriptionUsdMicrosPerSecond).toBe(100);
		expect(
			transcriptionEstimateUsdMicros({ ...whisper, source: "database" }, 61.5),
		).toBe(6_150);
		expect(transcriptionEstimateUsdMicros(modelPrice(), 60)).toBe(null);
	});

	// Money: scribe-v2 has a rate below whole micros. Without the round up
	// the rate is null and the app gateway refuses every call.
	it("rounds a transcription rate below whole micros up", () => {
		const scribe = gatewayPrice({
			id: "elevenlabs/scribe",
			owned_by: "elevenlabs",
			pricing: { transcription_duration_cost_per_second: "0.000061112" },
			type: "transcription",
		});

		expect(scribe.transcriptionUsdMicrosPerSecond).toBe(62);
		expect(
			transcriptionEstimateUsdMicros({ ...scribe, source: "database" }, 60),
		).toBe(3_720);
	});

	it.each([
		["a whole-micro rate", { speech_input_character_cost: "0.00004" }, 400_000],
		["no character rate", { input: "0.00004" }, null],
		[
			"a rate below one micro",
			{ speech_input_character_cost: "0.0000001" },
			null,
		],
	])("prices 10,000 speech characters with %s", (_label, pricing, expected) => {
		const speech = gatewayPrice({
			id: "elevenlabs/voice",
			owned_by: "elevenlabs",
			pricing,
			type: "speech",
		});

		expect(
			speechEstimateUsdMicros({ ...speech, source: "database" }, 10_000),
		).toBe(expected);
	});

	it.each([
		["720p", false, 8, 30_000],
		["720p", true, 8, 50_000],
		// A row with no audio key prices both audio values.
		["1080p", true, 8, 49_000],
		// Wandit sends only a text prompt, so a row with another mode never matches.
		["4k", false, 8, null],
		// Two rows match: the price is unclear, so nothing bills.
		["480p", false, 8, null],
		// The row with no resolution is the provider default tier; it never matches.
		["2k", false, 8, null],
		// The text_to_video row wins over the image and reference rows.
		["768p", false, 5, 18_000],
		// A row "over 15 s" does not price 15 s.
		["768p", false, 15, 18_000],
		// No document gives the rule above 15 s, so a longer clip gets no price.
		["768p", false, 16, null],
	])("selects the %s video rate with audio %s for %i s", (resolution, audio, seconds, expected) => {
		const video = gatewayPrice({
			id: "google/video",
			owned_by: "google",
			pricing: {
				video_duration_pricing: [
					{ resolution: "720p", audio: false, cost_per_second: "0.03" },
					{ resolution: "720p", audio: true, cost_per_second: "0.05" },
					{ resolution: "1080p", cost_per_second: "0.049" },
					{ resolution: "4k", mode: "std", cost_per_second: "0.3" },
					{ resolution: "480p", cost_per_second: "0.01" },
					{ resolution: "480p", cost_per_second: "0.02" },
					{ cost_per_second: "0.08" },
					{
						resolution: "768p",
						mode: "image_to_video",
						cost_per_second: "0.02",
					},
					{
						resolution: "768p",
						mode: "reference_to_video",
						cost_per_second: "0.05",
					},
					{
						resolution: "768p",
						mode: "text_to_video",
						cost_per_second: "0.018",
					},
					{
						duration_over_seconds: 15,
						resolution: "768p",
						mode: "text_to_video",
						cost_per_second: "0.075",
					},
				],
			},
			type: "video",
		});

		expect(
			videoUnitUsdMicrosPerSecond(
				{ ...video, source: "database" },
				{ audio, resolution, seconds },
			),
		).toBe(expected);
	});

	// Money: ceil(pixels x 24 x rate x 1.03 / 1024 / 1,000,000). 480p bills the
	// 854x480 frame: 409,920 x 24 x 10,700,000 x 103 / 102,400,000,000 = 105,884.3.
	it.each([
		["bytedance/seedance-2.5", "480p", 105_885],
		["bytedance/seedance-2.5", "720p", 238_054],
		// 1080p uses the 11.7 tier, not the 10.7 tier.
		["bytedance/seedance-2.5", "1080p", 585_679],
		["bytedance/seedance-2.5-flash", "480p", 69_271],
		["bytedance/seedance-2.5-flash", "720p", 155_736],
		["bytedance/seedance-2.5", "768p", null],
		// Seedance 2.0 renders 480p at 864x496, so the frame table does not fit it.
		["bytedance/seedance-2.0", "480p", null],
	])("prices one second of %s at %s from the video token tiers", (id, resolution, expected) => {
		const tier = (name: string, cost: string) => ({
			resolution: name,
			no_video_input: { cost_per_million_tokens: cost },
			with_video_input: { cost_per_million_tokens: "4.3" },
		});
		const fullRate = id === "bytedance/seedance-2.5-flash" ? "7" : "10.7";
		const video = gatewayPrice({
			id,
			owned_by: "bytedance",
			pricing: {
				video_token_pricing: {
					tiers: [
						tier("480p", fullRate),
						tier("720p", fullRate),
						tier("768p", fullRate),
						tier("1080p", "11.7"),
					],
				},
			},
			type: "video",
		});

		expect(
			videoUnitUsdMicrosPerSecond(
				{ ...video, source: "database" },
				{ audio: false, resolution, seconds: 5 },
			),
		).toBe(expected);
	});

	it("prices a video as whole seconds times the matched rate", () => {
		const video = gatewayPrice({
			id: "google/video",
			owned_by: "google",
			pricing: {
				video_duration_pricing: [
					{ resolution: "720p", audio: true, cost_per_second: "0.05" },
				],
			},
			type: "video",
		});
		const price = { ...video, source: "database" as const };

		expect(
			videoEstimateUsdMicros(price, {
				audio: true,
				resolution: "720p",
				seconds: 8,
			}),
		).toBe(400_000);
		expect(
			videoEstimateUsdMicros(modelPrice(), {
				audio: false,
				resolution: "720p",
				seconds: 8,
			}),
		).toBe(null);
	});

	// Money: the app gateway accepts only these sizes, so a style variant or
	// the default row must never become a size an app can pick.
	it("lists only the plain generate sizes of an image model", () => {
		const recraft = gatewayPrice({
			id: "recraft/image",
			owned_by: "recraft",
			pricing: {
				image: "0.035",
				image_dimension_quality_pricing: [
					{ cost: "0.08", style: "vector_illustration" },
					{ cost: "0.035", size: "default" },
					{ cost: "0.05", operation: "edit", size: "1024x1024" },
					{ cost: "0.04", size: "1536x1536" },
				],
			},
			type: "image",
		});

		expect(imageGenerateSizes({ ...recraft, source: "database" })).toEqual([
			"1536x1536",
		]);
	});

	it("selects image variants by size and falls back to the default rate", () => {
		const gemini = gatewayPrice({
			id: "google/image",
			owned_by: "google",
			pricing: {
				image_dimension_quality_pricing: [
					{ cost: "0.1344", size: "1K" },
					{ cost: "0.24", size: "4K" },
					{ cost: "0.1344", size: "default" },
				],
			},
			type: "language",
		});
		const price = { ...gemini, source: "database" as const };

		expect(imageEstimateUsdMicros(price, 2)).toBe(268_800);
		expect(imageEstimateUsdMicros(price, 1, "4K")).toBe(240_000);
		expect(imageEstimateUsdMicros(price, 1, "8K")).toBe(134_400);
		expect(
			imageEstimateUsdMicros(modelPrice({ imageUsdMicros: null }), 1),
		).toBe(null);
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

	// Money: the app AI token fallback bills each uncached prompt token as a
	// cache write, so a model without a write rate must bill the input rate.
	it.each([
		[
			"cache read",
			{ cacheReadUsdMicrosPerMTok: null },
			{ cacheReadTokens: 1_000 },
		],
		[
			"cache write",
			{ cacheWriteUsdMicrosPerMTok: null },
			{ cacheWriteTokens: 1_000, noCacheTokens: 0 },
		],
	])("falls back to the base input rate when the %s rate is absent", (_label, rates, inputTokenDetails) => {
		const usage = normalizeTokenUsage({
			inputTokenDetails,
			inputTokens: 1_000,
		});

		expect(tokenUsageCostUsdMicros(modelPrice(rates), usage)).toBe(1_000);
	});

	// Money: OpenAI and Anthropic bill every token of a long prompt at the
	// higher tier. Rates in USD micros per 1M tokens: input, output, cache
	// read, cache write.
	it.each([
		[
			"an OpenAI tier list 1 token below its threshold",
			OPENAI_TIERED_PRICING,
			272_000,
			[2_000_000, 10_000_000, 100_000, 2_500_000],
		],
		[
			"an OpenAI tier list at its threshold",
			OPENAI_TIERED_PRICING,
			272_001,
			[4_000_000, 15_000_000, 200_000, 5_000_000],
		],
		[
			"the Haiku 5.5 tier list at its threshold (5 x)",
			HAIKU_TIERED_PRICING,
			100_001,
			[500_000, 2_500_000, 50_000, 625_000],
		],
		[
			"a first tier without min",
			FIRST_TIER_WITHOUT_MIN_PRICING,
			272_001,
			[20_000_000, 75_000_000, 2_000_000, 25_000_000],
		],
		[
			"a row with no tiers",
			{ input: "0.000003", output: "0.000015", input_cache_read: "0.00000015" },
			1_000_000,
			[3_000_000, 15_000_000, 150_000, null],
		],
	])("prices %s", (_label, pricing, promptTokens, rates) => {
		const price = priceAtPromptSize(catalogPrice(pricing), promptTokens);

		expect([
			price.inputUsdMicrosPerMTok,
			price.outputUsdMicrosPerMTok,
			price.cacheReadUsdMicrosPerMTok,
			price.cacheWriteUsdMicrosPerMTok,
		]).toEqual(rates);
	});

	// Money: a tier list that does not parse must fail closed, not bill the base rate.
	it("refuses to price a malformed tier list", () => {
		const price = modelPrice({
			raw: { pricing: { input_tiers: [{ cost: "free", min: 0 }] } },
		});

		expect(() => priceAtPromptSize(price, 1_000)).toThrow(
			ModelPriceUnavailableError,
		);
	});

	it("applies max(1, ceil(cost * 100 / usdPerWholeCredit)) in centi-credits", () => {
		expect(usdMicrosToCentiCredits(0)).toBe(1);
		expect(usdMicrosToCentiCredits(320)).toBe(1);
		expect(usdMicrosToCentiCredits(321)).toBe(2);
		expect(usdMicrosToCentiCredits(32_000)).toBe(100);
		expect(usdMicrosToCentiCredits(125_000, 50_000)).toBe(250);
	});

	it("stamps the default $0.032 anchor into pricing snapshots", () => {
		expect(pricingSnapshot(modelPrice()).usdMicrosPerCredit).toBe(32_000);
	});

	it("prices provider image cost per successful image", () => {
		expect(imageUsageCostUsdMicros(modelPrice(), 3)).toBe(120_000);
	});
});

describe("ModelPricingService", () => {
	it("defaults the credit anchor to $0.032 (32,000 micros) when env is unset", () => {
		const repository = new FakeModelPricesRepository();
		const service = new ModelPricingService(
			repository as unknown as ModelPricesRepository,
			{ seedResponse: seed() },
		);

		expect(service.usdMicrosPerCredit).toBe(32_000);
	});

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

	it("fills image and transcription rates from the checked-in seed", async () => {
		const repository = new FakeModelPricesRepository();
		const service = new ModelPricingService(
			repository as unknown as ModelPricesRepository,
		);

		expect(await service.get("openai/whisper-1")).toMatchObject({
			transcriptionUsdMicrosPerSecond: 100,
		});
		expect(
			await service.quoteImageEstimate("google/gemini-3-pro-image", 1, "4K"),
		).toMatchObject({ costUsdMicros: 240_000, credits: 750 });
		// A token-priced transcription model has no per-second rate.
		expect(
			await service.quoteTranscriptionEstimate(
				"openai/gpt-4o-mini-transcribe",
				60,
			),
		).toBe(null);
		expect(await service.quoteImageEstimate("missing/model", 1)).toBe(null);
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

	// Money: a V1 chat turn or a page build sends the sum of many steps. Each
	// step is below the tier, so the sum must not bill the tier rate.
	// 280,000 x 2 + 1,000 x 10 = 570,000 micros; the tier gives 1,135,000.
	it("bills a summed usage above a tier threshold at the base rates", async () => {
		const service = new ModelPricingService(new FakeModelPricesRepository(), {
			seedResponse: {
				generatedAt: GENERATED_AT.toISOString(),
				data: [
					{
						id: "openai/gpt-6.1-sol",
						owned_by: "openai",
						type: "language",
						pricing: OPENAI_TIERED_PRICING,
					},
				],
			},
		});

		const quote = await service.quoteTokenUsage("openai/gpt-6.1-sol", {
			inputTokens: 280_000,
			outputTokens: 1_000,
		});

		expect(quote.costUsdMicros).toBe(570_000);
	});

	// Money: an allowed app AI model without a price answers 503 on every
	// call. This case fails when a list gets an id that the seed cannot price.
	it("prices every app AI gateway model from the checked-in seed", async () => {
		const service = new ModelPricingService(new FakeModelPricesRepository());
		const unpriced: string[] = [];
		const check = (label: string, cost: number | null | undefined) => {
			if (cost == null || cost <= 0) {
				unpriced.push(label);
			}
		};

		for (const modelId of APP_AI_MODELS) {
			const quote = await service.quoteTokenUsage(modelId, {
				inputTokens: 1_000,
				outputTokens: 1_000,
			});
			check(modelId, quote.costUsdMicros);
		}
		for (const modelId of APP_AI_IMAGE_MODELS) {
			const price = await service.require(modelId);
			for (const size of [undefined, ...imageGenerateSizes(price)]) {
				const quote = await service.quoteImageEstimate(modelId, 1, size);
				check(`${modelId} ${size ?? "default"}`, quote?.costUsdMicros);
			}
			// A Google image model also bills tokens; without token rates it answers 503.
			if (price.modelType === "language") {
				const tokens = await service.quoteTokenUsage(modelId, {
					inputTokens: 1_000,
					outputTokens: 1_000,
				});
				check(`${modelId} tokens`, tokens.costUsdMicros);
			}
		}
		for (const modelId of APP_AI_SPEECH_MODELS) {
			const quote = await service.quoteSpeechEstimate(modelId, 100);
			check(modelId, quote?.costUsdMicros);
		}
		for (const modelId of APP_AI_TRANSCRIPTION_MODELS) {
			const quote = await service.quoteTranscriptionEstimate(modelId, 60);
			check(modelId, quote?.costUsdMicros);
		}
		for (const modelId of APP_AI_VIDEO_MODELS) {
			const capability = APP_AI_VIDEO_CAPABILITIES[modelId];
			const audioValues =
				capability.audio === "optional" ? [false, true] : [false];
			for (const resolution of capability.resolutions) {
				for (const seconds of capability.seconds) {
					for (const audio of audioValues) {
						const quote = await service.quoteVideoEstimate(modelId, {
							audio,
							resolution,
							seconds,
						});
						check(
							`${modelId} ${resolution} ${seconds} s audio ${audio}`,
							quote?.costUsdMicros,
						);
					}
				}
			}
		}

		expect(unpriced).toEqual([]);
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
