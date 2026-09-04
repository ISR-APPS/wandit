import { Inject, Injectable, Optional } from "@nestjs/common";
import { env } from "@wandit/env/server";

import modelPriceSeed from "../../data/model-prices.seed.json";
import {
	AI_GATEWAY_MODELS_URL,
	DEFAULT_MODEL_PRICE_CACHE_TTL_MS,
	dollarsStringToUsdMicros,
	gatewayModelToPersistedPrice,
	type ImageUsageQuote,
	type ImageVariantPrice,
	imageEstimateUsdMicros,
	imageUnitUsdMicros,
	imageUsageCostUsdMicros,
	type MeasuredCostEstimate,
	type MediaVariantPricing,
	type MeteredTokenUsage,
	type ModelPrice,
	ModelPriceUnavailableError,
	normalizeTokenUsage,
	parseGatewayModelsResponse,
	pricingSnapshot,
	type TokenUsageQuote,
	tokenUsageCostUsdMicros,
	transcriptionEstimateUsdMicros,
	usdMicrosToCentiCredits,
	type VideoEstimateInput,
	type VideoVariantPrice,
	videoEstimateUsdMicros,
	videoUnitUsdMicrosPerSecond,
} from "../../domain/model-pricing";
import {
	type ModelPriceRow,
	ModelPricesRepository,
} from "../../infrastructure/persistence/model-prices.repository";

export const MODEL_PRICING_OPTIONS = Symbol("MODEL_PRICING_OPTIONS");

export type ModelPricingFetchResponse = {
	json: () => Promise<unknown>;
	ok: boolean;
	status: number;
	statusText: string;
};

type CacheEntry = {
	expiresAtMs: number;
	price: ModelPrice | null;
};

export type ModelPricingCache = Map<string, CacheEntry>;

export type ModelPricingOptions = {
	cache?: ModelPricingCache;
	cacheTtlMs?: number;
	fetch?: (
		url: string,
		init: { headers: Record<string, string>; signal: AbortSignal },
	) => Promise<ModelPricingFetchResponse>;
	now?: () => Date;
	seedResponse?: unknown;
	usdMicrosPerCredit?: number;
};

export type MeasuredCostEstimateInput =
	| { count: number; kind: "image"; modelId: string; size?: string }
	| ({ kind: "video"; modelId: string } & VideoEstimateInput)
	| { durationSeconds: number; kind: "transcription"; modelId: string };

export type ModelPriceRefreshResult = {
	fetched: number;
	persisted: number;
	refreshedAt: Date;
};

@Injectable()
export class ModelPricingService {
	private readonly cache: ModelPricingCache;
	private readonly cacheTtlMs: number;
	private readonly fetchModels: NonNullable<ModelPricingOptions["fetch"]>;
	private readonly now: () => Date;
	private readonly seedByModelId: ReadonlyMap<string, ModelPrice>;
	readonly usdMicrosPerCredit: number;

	constructor(
		@Inject(ModelPricesRepository)
		private readonly repository: ModelPricesRepository,
		@Optional()
		@Inject(MODEL_PRICING_OPTIONS)
		options: ModelPricingOptions = {},
	) {
		this.cache = options.cache ?? new Map();
		this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_MODEL_PRICE_CACHE_TTL_MS;
		if (!Number.isSafeInteger(this.cacheTtlMs) || this.cacheTtlMs <= 0) {
			throw new Error("Model pricing cache TTL must be a positive integer");
		}

		this.fetchModels = options.fetch ?? defaultFetchModels;
		this.now = options.now ?? (() => new Date());
		// The ?? repeats the env schema default because SKIP_ENV_VALIDATION
		// (tests) bypasses zod defaults and leaves the value undefined.
		this.usdMicrosPerCredit =
			options.usdMicrosPerCredit ??
			dollarsStringToUsdMicros(String(env.AI_USD_PER_CREDIT ?? 0.032));
		this.seedByModelId = buildSeedMap(options.seedResponse ?? modelPriceSeed);
	}

	async get(modelId: string): Promise<ModelPrice | null> {
		const nowMs = this.now().getTime();
		const cached = this.cache.get(modelId);

		if (cached && cached.expiresAtMs > nowMs) {
			return cached.price;
		}

		const row = await this.repository.findByModelId(modelId);
		const price = row
			? databaseRowToModelPrice(row)
			: (this.seedByModelId.get(modelId) ?? null);

		this.cache.set(modelId, {
			expiresAtMs: nowMs + this.cacheTtlMs,
			price,
		});

		return price;
	}

	async require(modelId: string): Promise<ModelPrice> {
		const price = await this.get(modelId);

		if (!price) {
			throw new ModelPriceUnavailableError(modelId);
		}

		return price;
	}

	async quoteTokenUsage(
		modelId: string,
		usage: MeteredTokenUsage,
		usdMicrosPerCredit = this.usdMicrosPerCredit,
	): Promise<TokenUsageQuote> {
		const price = await this.require(modelId);
		const normalizedUsage = normalizeTokenUsage(usage);
		const costUsdMicros = tokenUsageCostUsdMicros(price, normalizedUsage);

		return {
			costUsdMicros,
			credits: usdMicrosToCentiCredits(costUsdMicros, usdMicrosPerCredit),
			pricingSnapshot: pricingSnapshot(price, usdMicrosPerCredit),
			usage: normalizedUsage,
		};
	}

	async quoteImages(
		modelId: string,
		imageCount: number,
		usdMicrosPerCredit = this.usdMicrosPerCredit,
	): Promise<ImageUsageQuote> {
		const price = await this.require(modelId);

		return {
			costUsdMicros: imageUsageCostUsdMicros(price, imageCount),
			imageCount,
			pricingSnapshot: pricingSnapshot(price, usdMicrosPerCredit),
		};
	}

	/**
	 * Local provider-cost estimates for measured operations. They size the
	 * reserve and the provisional settlement; gateway reconciliation replaces
	 * them with the exact cost. `null` means the catalog has no usable rate
	 * for this model (caller falls back to the registry floor).
	 */
	async quoteImageEstimate(
		modelId: string,
		count: number,
		size?: string,
		usdMicrosPerCredit = this.usdMicrosPerCredit,
	): Promise<MeasuredCostEstimate | null> {
		const price = await this.get(modelId);
		const unitUsdMicros = price ? imageUnitUsdMicros(price, size) : null;

		if (!price || unitUsdMicros === null) {
			return null;
		}

		const costUsdMicros = imageEstimateUsdMicros(price, count, size) ?? 0;

		return this.measuredEstimate(
			price,
			costUsdMicros,
			unitUsdMicros,
			usdMicrosPerCredit,
		);
	}

	async quoteVideoEstimate(
		modelId: string,
		input: VideoEstimateInput,
		usdMicrosPerCredit = this.usdMicrosPerCredit,
	): Promise<MeasuredCostEstimate | null> {
		const price = await this.get(modelId);
		const costUsdMicros = price ? videoEstimateUsdMicros(price, input) : null;

		if (!price || costUsdMicros === null) {
			return null;
		}

		return this.measuredEstimate(
			price,
			costUsdMicros,
			videoUnitUsdMicrosPerSecond(price, input) ?? 0,
			usdMicrosPerCredit,
		);
	}

	async quoteTranscriptionEstimate(
		modelId: string,
		durationSeconds: number,
		usdMicrosPerCredit = this.usdMicrosPerCredit,
	): Promise<MeasuredCostEstimate | null> {
		const price = await this.get(modelId);
		const costUsdMicros = price
			? transcriptionEstimateUsdMicros(price, durationSeconds)
			: null;

		if (!price || costUsdMicros === null) {
			return null;
		}

		return this.measuredEstimate(
			price,
			costUsdMicros,
			price.transcriptionUsdMicrosPerSecond ?? 0,
			usdMicrosPerCredit,
		);
	}

	/** Dispatches on the operation kind; see the three quote*Estimate methods. */
	async quoteMeasuredEstimate(
		input: MeasuredCostEstimateInput,
		usdMicrosPerCredit = this.usdMicrosPerCredit,
	): Promise<MeasuredCostEstimate | null> {
		switch (input.kind) {
			case "image":
				return this.quoteImageEstimate(
					input.modelId,
					input.count,
					input.size,
					usdMicrosPerCredit,
				);
			case "video":
				return this.quoteVideoEstimate(
					input.modelId,
					input,
					usdMicrosPerCredit,
				);
			case "transcription":
				return this.quoteTranscriptionEstimate(
					input.modelId,
					input.durationSeconds,
					usdMicrosPerCredit,
				);
		}
	}

	private measuredEstimate(
		price: ModelPrice,
		costUsdMicros: number,
		unitUsdMicros: number,
		usdMicrosPerCredit: number,
	): MeasuredCostEstimate {
		return {
			costUsdMicros,
			credits: usdMicrosToCentiCredits(costUsdMicros, usdMicrosPerCredit),
			pricingSnapshot: pricingSnapshot(price, usdMicrosPerCredit),
			unitUsdMicros,
		};
	}

	async refreshFromGateway(): Promise<ModelPriceRefreshResult> {
		const response = await this.fetchModels(AI_GATEWAY_MODELS_URL, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(30_000),
		});

		if (!response.ok) {
			throw new Error(
				`AI Gateway model refresh failed (${response.status} ${response.statusText})`,
			);
		}

		const payload = parseGatewayModelsResponse(await response.json());
		const refreshedAt = this.now();
		const prices = payload.data.map((model) =>
			gatewayModelToPersistedPrice(model, refreshedAt),
		);
		const persisted = await this.repository.upsertMany(prices);

		if (persisted !== prices.length) {
			throw new Error(
				`AI Gateway model refresh persisted ${persisted}/${prices.length} rows`,
			);
		}

		this.clearCache();

		return { fetched: prices.length, persisted, refreshedAt };
	}

	clearCache(): void {
		this.cache.clear();
	}
}

function buildSeedMap(seedResponse: unknown): ReadonlyMap<string, ModelPrice> {
	const payload = parseGatewayModelsResponse(seedResponse);
	const refreshedAt = seedGeneratedAt(seedResponse);
	const prices = new Map<string, ModelPrice>();

	for (const model of payload.data) {
		const persisted = gatewayModelToPersistedPrice(model, refreshedAt);
		prices.set(persisted.modelId, { ...persisted, source: "seed" });
	}

	return prices;
}

function seedGeneratedAt(seedResponse: unknown): Date {
	if (
		typeof seedResponse === "object" &&
		seedResponse !== null &&
		"generatedAt" in seedResponse &&
		typeof seedResponse.generatedAt === "string"
	) {
		const generatedAt = new Date(seedResponse.generatedAt);

		if (!Number.isNaN(generatedAt.getTime())) {
			return generatedAt;
		}
	}

	throw new Error("The checked-in model pricing seed has no valid generatedAt");
}

function databaseRowToModelPrice(row: ModelPriceRow): ModelPrice {
	return {
		cacheReadUsdMicrosPerMTok: row.cacheReadUsdMicrosPerMTok,
		cacheWriteUsdMicrosPerMTok: row.cacheWriteUsdMicrosPerMTok,
		imageUsdMicros: row.imageUsdMicros,
		inputUsdMicrosPerMTok: row.inputUsdMicrosPerMTok,
		modelId: row.modelId,
		modelType: row.modelType,
		outputUsdMicrosPerMTok: row.outputUsdMicrosPerMTok,
		provider: row.provider,
		raw: asRawRecord(row.raw),
		refreshedAt: row.refreshedAt,
		source: "database",
		transcriptionUsdMicrosPerSecond: row.transcriptionUsdMicrosPerSecond,
		variantPricing: asVariantPricing(row.variantPricing),
		videoUsdMicrosPerSecond: row.videoUsdMicrosPerSecond,
	};
}

function asVariantPricing(value: unknown): MediaVariantPricing | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}

	const record = value as Record<string, unknown>;
	const image = Array.isArray(record.image)
		? record.image.filter(
				(variant): variant is ImageVariantPrice =>
					typeof variant === "object" &&
					variant !== null &&
					Number.isSafeInteger((variant as ImageVariantPrice).usdMicros),
			)
		: [];
	const video = Array.isArray(record.video)
		? record.video.filter(
				(variant): variant is VideoVariantPrice =>
					typeof variant === "object" &&
					variant !== null &&
					Number.isSafeInteger(
						(variant as VideoVariantPrice).usdMicrosPerSecond,
					),
			)
		: [];

	if (image.length === 0 && video.length === 0) {
		return null;
	}

	return {
		...(image.length === 0 ? {} : { image }),
		...(video.length === 0 ? {} : { video }),
	};
}

function asRawRecord(raw: unknown): Record<string, unknown> {
	return typeof raw === "object" && raw !== null && !Array.isArray(raw)
		? (raw as Record<string, unknown>)
		: { value: raw };
}

async function defaultFetchModels(
	url: string,
	init: { headers: Record<string, string>; signal: AbortSignal },
): Promise<ModelPricingFetchResponse> {
	return fetch(url, init);
}
