import { z } from "zod";

export const AI_GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
export const DEFAULT_MODEL_PRICE_CACHE_TTL_MS = 60 * 60 * 1000;
export const DEFAULT_USD_MICROS_PER_CREDIT = 32_000;

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const NON_NEGATIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;

const pricingStringSchema = z
	.string()
	.trim()
	.regex(
		NON_NEGATIVE_DECIMAL_PATTERN,
		"Expected a non-negative decimal string",
	);

const imageVariantPriceSchema = z
	.object({
		cost: pricingStringSchema,
		operation: z.string().optional(),
		size: z.string().optional(),
		style: z.string().optional(),
	})
	.passthrough();

export const gatewayModelSchema = z
	.object({
		id: z.string().min(1),
		owned_by: z.string().min(1),
		pricing: z
			.object({
				image: pricingStringSchema.optional(),
				image_dimension_quality_pricing: z
					.array(imageVariantPriceSchema)
					.optional(),
				input: pricingStringSchema.optional(),
				input_cache_read: pricingStringSchema.optional(),
				input_cache_write: pricingStringSchema.optional(),
				output: pricingStringSchema.optional(),
				transcription_duration_cost_per_second: z.string().optional(),
			})
			.passthrough(),
		type: z.string().min(1),
	})
	.passthrough();

export const gatewayModelsResponseSchema = z
	.object({
		data: z.array(gatewayModelSchema).min(1),
		object: z.string().optional(),
	})
	.passthrough();

export type GatewayModel = z.infer<typeof gatewayModelSchema>;
export type GatewayModelsResponse = z.infer<typeof gatewayModelsResponseSchema>;

export type ModelPriceSource = "database" | "seed";

export type ImageVariantPrice = {
	operation?: string;
	size?: string;
	style?: string;
	usdMicros: number;
};

/** Size/mode-specific image rates kept next to the default rate. */
export type MediaVariantPricing = {
	image?: ImageVariantPrice[];
};

export type ModelPrice = {
	cacheReadUsdMicrosPerMTok: number | null;
	cacheWriteUsdMicrosPerMTok: number | null;
	imageUsdMicros: number | null;
	inputUsdMicrosPerMTok: number | null;
	modelId: string;
	modelType: string;
	outputUsdMicrosPerMTok: number | null;
	provider: string;
	raw: Record<string, unknown>;
	refreshedAt: Date;
	source: ModelPriceSource;
	transcriptionUsdMicrosPerSecond: number | null;
	variantPricing: MediaVariantPricing | null;
};

export type PersistedModelPrice = Omit<ModelPrice, "source">;

export type MeteredTokenUsage = {
	inputTokenDetails?: {
		cacheReadTokens?: number | null;
		cacheWriteTokens?: number | null;
		noCacheTokens?: number | null;
	} | null;
	inputTokens?: number | null;
	outputTokens?: number | null;
};

export type NormalizedTokenUsage = {
	cacheReadTokens: number;
	cacheWriteTokens: number;
	inputTokens: number;
	outputTokens: number;
	uncachedInputTokens: number;
};

export type PricingSnapshot = {
	cacheReadUsdMicrosPerMTok: number | null;
	cacheWriteUsdMicrosPerMTok: number | null;
	imageUsdMicros: number | null;
	inputUsdMicrosPerMTok: number | null;
	modelId: string;
	modelType: string;
	outputUsdMicrosPerMTok: number | null;
	provider: string;
	refreshedAt: string;
	source: ModelPriceSource;
	transcriptionUsdMicrosPerSecond: number | null;
	/** Micros per WHOLE credit (32,000), never per centi-credit. */
	usdMicrosPerCredit: number;
};

/** Local (pre-gateway) provider cost estimate for one measured operation. */
export type MeasuredCostEstimate = {
	costUsdMicros: number;
	/** Integer centi-credits (1 credit = 100 cc). */
	credits: number;
	pricingSnapshot: PricingSnapshot;
	/** Cost of one unit (for example, one image) the estimate was built from. */
	unitUsdMicros: number;
};

export type TokenUsageQuote = {
	costUsdMicros: number;
	/** Integer centi-credits (1 credit = 100 cc). */
	credits: number;
	pricingSnapshot: PricingSnapshot;
	usage: NormalizedTokenUsage;
};

export type ImageUsageQuote = {
	costUsdMicros: number;
	imageCount: number;
	pricingSnapshot: PricingSnapshot;
};

export class ModelPriceUnavailableError extends Error {
	constructor(
		readonly modelId: string,
		readonly missingRate?: string,
	) {
		super(
			missingRate
				? `Model ${modelId} has no ${missingRate} price`
				: `No pricing is available for model ${modelId}`,
		);
		this.name = "ModelPriceUnavailableError";
	}
}

/** Convert a dollar decimal to integer USD micros without binary-float math. */
export function dollarsStringToUsdMicros(value: string): number {
	return decimalStringToScaledInteger(value, 6, "USD micros");
}

/**
 * Gateway token prices are dollar strings PER TOKEN. Multiplying their exact
 * decimal representation by 1e12 yields USD micros per one million tokens.
 */
export function perTokenDollarsStringToUsdMicrosPerMTok(value: string): number {
	return decimalStringToScaledInteger(value, 12, "USD micros per MTok");
}

/**
 * Convert provider cost to integer CENTI-credits (1 credit = 100 cc).
 * `usdMicrosPerCredit` stays micros per WHOLE credit (32,000); this function
 * owns the ×100. Minimum charge is 1 cc (0.01 credit).
 */
export function usdMicrosToCentiCredits(
	costUsdMicros: number,
	usdMicrosPerCredit = DEFAULT_USD_MICROS_PER_CREDIT,
): number {
	assertNonNegativeSafeInteger(costUsdMicros, "costUsdMicros");
	assertPositiveSafeInteger(usdMicrosPerCredit, "usdMicrosPerCredit");

	const centiCredits = divideRoundingUp(
		BigInt(costUsdMicros) * 100n,
		BigInt(usdMicrosPerCredit),
	);

	return Math.max(1, bigintToSafeNumber(centiCredits));
}

export function normalizeTokenUsage(
	usage: MeteredTokenUsage,
): NormalizedTokenUsage {
	const inputTokens = normalizedCount(usage.inputTokens, "inputTokens");
	const outputTokens = normalizedCount(usage.outputTokens, "outputTokens");
	const details = usage.inputTokenDetails;
	const cacheReadTokens = normalizedCount(
		details?.cacheReadTokens,
		"inputTokenDetails.cacheReadTokens",
	);
	const cacheWriteTokens = normalizedCount(
		details?.cacheWriteTokens,
		"inputTokenDetails.cacheWriteTokens",
	);
	const reportedNoCacheTokens = details?.noCacheTokens;
	const uncachedInputTokens =
		reportedNoCacheTokens == null
			? Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)
			: normalizedCount(
					reportedNoCacheTokens,
					"inputTokenDetails.noCacheTokens",
				);

	return {
		cacheReadTokens,
		cacheWriteTokens,
		inputTokens,
		outputTokens,
		uncachedInputTokens,
	};
}

export function tokenUsageCostUsdMicros(
	price: ModelPrice,
	usage: NormalizedTokenUsage,
): number {
	const inputRate = requiredRate(
		price,
		"input",
		price.inputUsdMicrosPerMTok,
		usage.uncachedInputTokens,
	);
	const outputRate = requiredRate(
		price,
		"output",
		price.outputUsdMicrosPerMTok,
		usage.outputTokens,
	);
	// A provider that reports cached tokens but no discounted cache rate bills
	// them at the ordinary input rate. Missing metadata must never make input
	// tokens free.
	const cacheReadRate = requiredRate(
		price,
		"cache-read/input",
		price.cacheReadUsdMicrosPerMTok ?? price.inputUsdMicrosPerMTok,
		usage.cacheReadTokens,
	);
	const cacheWriteRate = requiredRate(
		price,
		"cache-write/input",
		price.cacheWriteUsdMicrosPerMTok ?? price.inputUsdMicrosPerMTok,
		usage.cacheWriteTokens,
	);
	const numerator =
		BigInt(usage.uncachedInputTokens) * BigInt(inputRate) +
		BigInt(usage.cacheReadTokens) * BigInt(cacheReadRate) +
		BigInt(usage.cacheWriteTokens) * BigInt(cacheWriteRate) +
		BigInt(usage.outputTokens) * BigInt(outputRate);

	return bigintToSafeNumber(divideRoundingUp(numerator, 1_000_000n));
}

export function imageUsageCostUsdMicros(
	price: ModelPrice,
	imageCount: number,
): number {
	assertPositiveSafeInteger(imageCount, "imageCount");

	if (price.imageUsdMicros == null) {
		throw new ModelPriceUnavailableError(price.modelId, "per-image");
	}

	return bigintToSafeNumber(BigInt(price.imageUsdMicros) * BigInt(imageCount));
}

/** Per-image rate for a requested size, else the default image rate. */
export function imageUnitUsdMicros(
	price: ModelPrice,
	size?: string,
): number | null {
	const variants = price.variantPricing?.image;

	if (size !== undefined && variants) {
		const match = variants.find(
			(variant) =>
				variant.size?.toLowerCase() === size.toLowerCase() &&
				variant.style === undefined &&
				(variant.operation === undefined || variant.operation === "generate"),
		);

		if (match) {
			return match.usdMicros;
		}
	}

	return price.imageUsdMicros;
}

export function imageEstimateUsdMicros(
	price: ModelPrice,
	count: number,
	size?: string,
): number | null {
	assertPositiveSafeInteger(count, "count");
	const unit = imageUnitUsdMicros(price, size);

	return unit === null
		? null
		: bigintToSafeNumber(BigInt(unit) * BigInt(count));
}

export function transcriptionEstimateUsdMicros(
	price: ModelPrice,
	durationSeconds: number,
): number | null {
	if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
		throw new Error("durationSeconds must be a non-negative number");
	}

	return price.transcriptionUsdMicrosPerSecond === null
		? null
		: Math.ceil(price.transcriptionUsdMicrosPerSecond * durationSeconds);
}

export function pricingSnapshot(
	price: ModelPrice,
	usdMicrosPerCredit = DEFAULT_USD_MICROS_PER_CREDIT,
): PricingSnapshot {
	assertPositiveSafeInteger(usdMicrosPerCredit, "usdMicrosPerCredit");

	return {
		cacheReadUsdMicrosPerMTok: price.cacheReadUsdMicrosPerMTok,
		cacheWriteUsdMicrosPerMTok: price.cacheWriteUsdMicrosPerMTok,
		imageUsdMicros: price.imageUsdMicros,
		inputUsdMicrosPerMTok: price.inputUsdMicrosPerMTok,
		modelId: price.modelId,
		modelType: price.modelType,
		outputUsdMicrosPerMTok: price.outputUsdMicrosPerMTok,
		provider: price.provider,
		refreshedAt: price.refreshedAt.toISOString(),
		source: price.source,
		transcriptionUsdMicrosPerSecond: price.transcriptionUsdMicrosPerSecond,
		usdMicrosPerCredit,
	};
}

export function parseGatewayModelsResponse(
	input: unknown,
): GatewayModelsResponse {
	return gatewayModelsResponseSchema.parse(input);
}

export function gatewayModelToPersistedPrice(
	model: GatewayModel,
	refreshedAt: Date,
): PersistedModelPrice {
	return {
		cacheReadUsdMicrosPerMTok: optionalPerTokenRate(
			model.pricing.input_cache_read,
		),
		cacheWriteUsdMicrosPerMTok: optionalPerTokenRate(
			model.pricing.input_cache_write,
		),
		imageUsdMicros: imageRate(model),
		inputUsdMicrosPerMTok: optionalPerTokenRate(model.pricing.input),
		modelId: model.id,
		modelType: model.type,
		outputUsdMicrosPerMTok: optionalPerTokenRate(model.pricing.output),
		provider: model.owned_by,
		raw: model,
		refreshedAt,
		transcriptionUsdMicrosPerSecond: transcriptionRate(model),
		variantPricing: variantPricing(model),
	};
}

function variantPricing(model: GatewayModel): MediaVariantPricing | null {
	const image = (model.pricing.image_dimension_quality_pricing ?? []).flatMap(
		(variant): ImageVariantPrice[] => {
			const usdMicros = lenientUsdMicros(variant.cost);

			return usdMicros === null
				? []
				: [
						{
							...(variant.operation === undefined
								? {}
								: { operation: variant.operation }),
							...(variant.size === undefined ? {} : { size: variant.size }),
							...(variant.style === undefined ? {} : { style: variant.style }),
							usdMicros,
						},
					];
		},
	);
	if (image.length === 0) {
		return null;
	}

	return { image };
}

function transcriptionRate(model: GatewayModel): number | null {
	const value = model.pricing.transcription_duration_cost_per_second;

	return value === undefined ? null : lenientUsdMicros(value);
}

function lenientUsdMicros(value: string): number | null {
	try {
		return dollarsStringToUsdMicros(value);
	} catch {
		return null;
	}
}

function imageRate(model: GatewayModel): number | null {
	if (model.pricing.image !== undefined) {
		return dollarsStringToUsdMicros(model.pricing.image);
	}

	const variants = model.pricing.image_dimension_quality_pricing;
	const defaultVariant = variants?.find(
		(variant) =>
			variant.size === "default" ||
			(variant.operation === "generate" && variant.style === undefined),
	);

	return defaultVariant ? dollarsStringToUsdMicros(defaultVariant.cost) : null;
}

function optionalPerTokenRate(value: string | undefined): number | null {
	return value === undefined
		? null
		: perTokenDollarsStringToUsdMicrosPerMTok(value);
}

function requiredRate(
	price: ModelPrice,
	label: string,
	rate: number | null,
	tokens: number,
): number {
	if (tokens === 0) {
		return 0;
	}

	if (rate == null) {
		throw new ModelPriceUnavailableError(price.modelId, label);
	}

	return rate;
}

function decimalStringToScaledInteger(
	value: string,
	scaleDigits: number,
	unit: string,
): number {
	const normalized = value.trim();
	const match = NON_NEGATIVE_DECIMAL_PATTERN.exec(normalized);

	if (!match) {
		throw new Error(`Invalid ${unit} decimal: ${value}`);
	}

	const [whole = "0", fraction = ""] = normalized.split(".");

	if (
		fraction.length > scaleDigits &&
		/[1-9]/u.test(fraction.slice(scaleDigits))
	) {
		throw new Error(
			`${value} cannot be represented exactly as integer ${unit}`,
		);
	}

	const scaled =
		BigInt(whole) * 10n ** BigInt(scaleDigits) +
		BigInt((fraction.slice(0, scaleDigits) || "0").padEnd(scaleDigits, "0"));

	if (scaled > BigInt(POSTGRES_INTEGER_MAX)) {
		throw new Error(
			`${value} exceeds the model_prices integer range for ${unit}`,
		);
	}

	return Number(scaled);
}

function normalizedCount(
	value: number | null | undefined,
	label: string,
): number {
	const normalized = value ?? 0;
	assertNonNegativeSafeInteger(normalized, label);
	return normalized;
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new Error(`${label} must be a non-negative safe integer`);
	}
}

function assertPositiveSafeInteger(value: number, label: string): void {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive safe integer`);
	}
}

function divideRoundingUp(numerator: bigint, denominator: bigint): bigint {
	return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

function bigintToSafeNumber(value: bigint): number {
	if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new Error("Calculated model cost exceeds JavaScript's safe range");
	}

	return Number(value);
}
