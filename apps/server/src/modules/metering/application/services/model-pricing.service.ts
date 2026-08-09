import { Inject, Injectable, Optional } from "@nestjs/common";
import { env } from "@wandit/env/server";

import modelPriceSeed from "../../data/model-prices.seed.json";
import {
	AI_GATEWAY_MODELS_URL,
	DEFAULT_MODEL_PRICE_CACHE_TTL_MS,
	dollarsStringToUsdMicros,
	gatewayModelToPersistedPrice,
	type ImageUsageQuote,
	imageUsageCostUsdMicros,
	type MeteredTokenUsage,
	type ModelPrice,
	ModelPriceUnavailableError,
	normalizeTokenUsage,
	parseGatewayModelsResponse,
	pricingSnapshot,
	type TokenUsageQuote,
	tokenUsageCostUsdMicros,
	usdMicrosToCredits,
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
		this.usdMicrosPerCredit =
			options.usdMicrosPerCredit ??
			dollarsStringToUsdMicros(String(env.AI_USD_PER_CREDIT ?? 0.028));
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
			credits: usdMicrosToCredits(costUsdMicros, usdMicrosPerCredit),
			pricingSnapshot: pricingSnapshot(price, usdMicrosPerCredit),
			usage: normalizedUsage,
		};
	}

	/**
	 * Provider cost for image reconciliation. Customer debits remain the fixed
	 * operation-registry price (5 credits/image), not usdMicrosToCredits here.
	 */
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
