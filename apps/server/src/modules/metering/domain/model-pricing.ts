/**
 * Price math of the Vercel AI Gateway catalog. It parses the model rates and
 * gives the cost of tokens, images, transcription, speech, and video in USD
 * micros. `ModelPricingService` and the metering flows call it. It uses zod only.
 */
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

// One tier of a token rate: `cost` is USD per token from `min` prompt
// tokens up (inclusive). The catalog leaves out `min` on some first tiers.
const tokenTierListSchema = z
	.array(
		z.object({
			cost: pricingStringSchema,
			min: z.int().nonnegative().optional(),
		}),
	)
	.nullish();

// The tier lists live only in `raw`: no column holds them. A row without
// `pricing` (an old row, a spec row) has no tiers.
const tokenTierPriceSchema = z.object({
	pricing: z
		.object({
			input_tiers: tokenTierListSchema,
			output_tiers: tokenTierListSchema,
			input_cache_read_tiers: tokenTierListSchema,
			input_cache_write_tiers: tokenTierListSchema,
		})
		.optional(),
});

/**
 * The price row with the four token rates of the tier that a prompt of
 * `promptTokens` reaches (cached tokens included). Every token of the call
 * bills at that tier, as OpenAI and Anthropic bill a long prompt. The
 * builder has the same rule in `priceUsdMicros` (app-builder llm-model-prices.ts).
 * Throws `ModelPriceUnavailableError` on a malformed tier list (fail closed).
 */
export function priceAtPromptSize(
	price: ModelPrice,
	promptTokens: number,
): ModelPrice {
	const parsed = tokenTierPriceSchema.safeParse(price.raw);
	if (!parsed.success) {
		throw new ModelPriceUnavailableError(price.modelId, "tier");
	}
	const tiers = parsed.data.pricing;
	if (tiers === undefined) {
		return price;
	}
	const rateAt = (
		baseRate: number | null,
		list: z.infer<typeof tokenTierListSchema>,
	) => tierRate(price.modelId, baseRate, list, promptTokens);

	return {
		...price,
		cacheReadUsdMicrosPerMTok: rateAt(
			price.cacheReadUsdMicrosPerMTok,
			tiers.input_cache_read_tiers,
		),
		cacheWriteUsdMicrosPerMTok: rateAt(
			price.cacheWriteUsdMicrosPerMTok,
			tiers.input_cache_write_tiers,
		),
		inputUsdMicrosPerMTok: rateAt(
			price.inputUsdMicrosPerMTok,
			tiers.input_tiers,
		),
		outputUsdMicrosPerMTok: rateAt(
			price.outputUsdMicrosPerMTok,
			tiers.output_tiers,
		),
	};
}

// The highest rate of the tiers that the prompt reaches, never below the
// base rate. A tier cost that is not a whole number of micros per 1M
// tokens throws `ModelPriceUnavailableError`.
function tierRate(
	modelId: string,
	baseRate: number | null,
	tiers: z.infer<typeof tokenTierListSchema>,
	promptTokens: number,
): number | null {
	let rate = baseRate;
	for (const tier of tiers ?? []) {
		if ((tier.min ?? 0) > promptTokens) {
			continue;
		}
		let tierUsdMicrosPerMTok: number;
		try {
			tierUsdMicrosPerMTok = perTokenDollarsStringToUsdMicrosPerMTok(tier.cost);
		} catch {
			// Money path: a tier rate that does not convert must not bill the
			// base rate. The error names the model and the tier.
			throw new ModelPriceUnavailableError(modelId, "tier");
		}
		rate =
			rate === null
				? tierUsdMicrosPerMTok
				: Math.max(rate, tierUsdMicrosPerMTok);
	}
	return rate;
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
				isPlainGenerateVariant(variant),
		);

		if (match) {
			return match.usdMicros;
		}
	}

	return price.imageUsdMicros;
}

/**
 * Sizes with their own generate price, for example `1024x1024`. The app AI
 * gateway accepts a subset of these sizes (see `googleImageJob`), so a size
 * never bills the default rate.
 */
export function imageGenerateSizes(price: ModelPrice): string[] {
	return (price.variantPricing?.image ?? []).flatMap((variant) =>
		variant.size !== undefined &&
		variant.size !== "default" &&
		isPlainGenerateVariant(variant)
			? [variant.size]
			: [],
	);
}

// A variant without a style and for the generate operation: the variant
// that a plain text-to-image call bills.
function isPlainGenerateVariant(variant: ImageVariantPrice): boolean {
	return (
		variant.style === undefined &&
		(variant.operation === undefined || variant.operation === "generate")
	);
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

// The speech and video rates live only in `raw`: no column holds them.
// zod reads the named fields. A missing or malformed rate gives null.
const speechPriceSchema = z.object({
	pricing: z.object({ speech_input_character_cost: pricingStringSchema }),
});

// A video entry has rows for each second, or token tiers (Seedance 2.x).
const videoPriceSchema = z.object({
	pricing: z.object({
		video_duration_pricing: z
			.array(
				z.object({
					audio: z.boolean().optional(),
					cost_per_second: pricingStringSchema,
					// A row with this key is the rate of a clip longer than this many seconds.
					duration_over_seconds: z.number().nonnegative().optional(),
					// For example `text_to_video` or `image_to_video` (HeyGen).
					mode: z.string().optional(),
					resolution: z.string().optional(),
				}),
			)
			.optional(),
		video_token_pricing: z
			.object({
				tiers: z.array(
					z.object({
						resolution: z.string(),
						// The rate of a job with no input video: Wandit sends only text.
						no_video_input: z.object({
							// USD for one million video tokens, for example "10.7".
							cost_per_million_tokens: pricingStringSchema,
						}),
					}),
				),
			})
			.optional(),
	}),
});

type VideoPricing = z.infer<typeof videoPriceSchema>["pricing"];

// The row mode of a job with only a text prompt, the only mode Wandit sends.
const TEXT_TO_VIDEO_MODE = "text_to_video";

// Seedance 2.5 output frame in pixels for each tier, 16:9 or 9:16 (BytePlus
// Seedance 2.5 tutorial). The Seedance 2.0 series uses other frames, so
// it is not in the table.
const SEEDANCE_2_5_FRAME_PIXELS = new Map<string, bigint>([
	["480p", 854n * 480n],
	["720p", 1280n * 720n],
	["1080p", 1920n * 1080n],
]);
const SEEDANCE_2_5_MODEL_IDS: readonly string[] = [
	"bytedance/seedance-2.5",
	"bytedance/seedance-2.5-flash",
];
// BytePlus estimate: tokens = seconds x width x height x 24 fps / 1024.
const SEEDANCE_FRAMES_PER_SECOND = 24n;
const SEEDANCE_PIXELS_PER_TOKEN = 1024n;
// 3 % above the estimate. The one documented real count is 1.58 % above it,
// and one more frame at 1088 rows gives at most 1.79 %.
const SEEDANCE_MARGIN_PERCENT = 103n;

/**
 * USD micros for one input character of a speech model. Null when the
 * catalog entry has no rate, or a rate that is not a whole number of micros.
 */
export function speechUnitUsdMicros(price: ModelPrice): number | null {
	const parsed = speechPriceSchema.safeParse(price.raw);

	return parsed.success
		? lenientUsdMicros(parsed.data.pricing.speech_input_character_cost)
		: null;
}

/** Cost of one speech call: input characters times the character rate. */
export function speechEstimateUsdMicros(
	price: ModelPrice,
	characters: number,
): number | null {
	assertPositiveSafeInteger(characters, "characters");
	const unit = speechUnitUsdMicros(price);

	return unit === null
		? null
		: bigintToSafeNumber(BigInt(unit) * BigInt(characters));
}

/** The price row a video request selects, for example `720p` for 5 s without audio. */
export type VideoPriceTerms = {
	/** Catalog resolution name, for example `720p`. */
	resolution: string;
	/** True when the request asks for generated audio. */
	audio: boolean;
	/** Video length in whole seconds. Some rows apply only above a length. */
	seconds: number;
};

/**
 * USD micros for one second of a text-to-video job. It reads the rows for
 * each second, or else the Seedance 2.5 token tiers. No match, more than one
 * match, or an unknown rule gives null, so an unclear price never bills.
 */
export function videoUnitUsdMicrosPerSecond(
	price: ModelPrice,
	terms: VideoPriceTerms,
): number | null {
	const parsed = videoPriceSchema.safeParse(price.raw);
	if (!parsed.success) {
		return null;
	}
	const { video_duration_pricing: rows, video_token_pricing: tokens } =
		parsed.data.pricing;
	if (rows !== undefined) {
		return durationRowRate(rows, terms);
	}
	return tokens === undefined
		? null
		: seedanceTokenRate(price.modelId, tokens.tiers, terms.resolution);
}

// A row matches on the resolution, and on the text-to-video mode or no mode.
// It also matches on audio when the row has an audio key. A row with no resolution
// (MiniMax) is the price of the provider default tier. Wandit always sends
// a tier, so that row never matches.
function durationRowRate(
	rows: NonNullable<VideoPricing["video_duration_pricing"]>,
	terms: VideoPriceTerms,
): number | null {
	const matches = rows.filter(
		(row) =>
			(row.mode === undefined || row.mode === TEXT_TO_VIDEO_MODE) &&
			row.resolution?.toLowerCase() === terms.resolution.toLowerCase() &&
			(row.audio === undefined || row.audio === terms.audio),
	);
	// No document says if a rate "over N seconds" bills every second or only
	// the seconds above N. A longer request thus gets no price.
	if (
		matches.some(
			(row) =>
				row.duration_over_seconds !== undefined &&
				terms.seconds > row.duration_over_seconds,
		)
	) {
		return null;
	}
	const baseRows = matches.filter(
		(row) => row.duration_over_seconds === undefined,
	);
	const [row] = baseRows;

	return baseRows.length === 1 && row !== undefined
		? lenientUsdMicros(row.cost_per_second)
		: null;
}

// Seedance 2.5 bills video tokens. One second costs ceil(frame pixels x
// 24 x rate per 1M tokens x 1.03 / 1024 / 1,000,000), in USD micros.
// LIMIT: exact only for 16:9 and 9:16 on the Seedance 2.5 series; the public
// token estimate plus 3 %. Upgrade: settle from the real completion_tokens.
function seedanceTokenRate(
	modelId: string,
	tiers: NonNullable<VideoPricing["video_token_pricing"]>["tiers"],
	resolution: string,
): number | null {
	const framePixels = SEEDANCE_2_5_FRAME_PIXELS.get(resolution.toLowerCase());
	if (!SEEDANCE_2_5_MODEL_IDS.includes(modelId) || framePixels === undefined) {
		return null;
	}
	const matches = tiers.filter(
		(tier) => tier.resolution.toLowerCase() === resolution.toLowerCase(),
	);
	const [tier] = matches;
	const usdMicrosPerMillionTokens =
		matches.length === 1 && tier !== undefined
			? lenientUsdMicros(tier.no_video_input.cost_per_million_tokens)
			: null;
	if (usdMicrosPerMillionTokens === null) {
		return null;
	}
	// BigInt: 2,073,600 x 24 x 11,700,000 x 103 is above 2^53.
	const numerator =
		framePixels *
		SEEDANCE_FRAMES_PER_SECOND *
		BigInt(usdMicrosPerMillionTokens) *
		SEEDANCE_MARGIN_PERCENT;
	// The rate is for 1,000,000 tokens, and the margin is in percent.
	const denominator = SEEDANCE_PIXELS_PER_TOKEN * 1_000_000n * 100n;

	return bigintToSafeNumber(divideRoundingUp(numerator, denominator));
}

/** Cost of one video: whole seconds times the per-second rate. */
export function videoEstimateUsdMicros(
	price: ModelPrice,
	terms: VideoPriceTerms,
): number | null {
	assertPositiveSafeInteger(terms.seconds, "seconds");
	const unit = videoUnitUsdMicrosPerSecond(price, terms);

	return unit === null
		? null
		: bigintToSafeNumber(BigInt(unit) * BigInt(terms.seconds));
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

	// LIMIT: a rate below whole micros rounds up (scribe-v2: 61.112 to 62
	// micros per second, +1.5 %). Upgrade: a rate column with more decimals.
	return value === undefined ? null : lenientUsdMicros(value, "up");
}

// `up` rounds a rate with more than 6 decimals up to whole micros; `exact`
// gives null for it.
function lenientUsdMicros(
	value: string,
	rounding: DecimalRounding = "exact",
): number | null {
	try {
		return decimalStringToScaledInteger(value, 6, "USD micros", rounding);
	} catch {
		// A malformed or out-of-range rate means "no rate": the caller fails
		// closed or falls back to its floor.
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

type DecimalRounding = "exact" | "up";

function decimalStringToScaledInteger(
	value: string,
	scaleDigits: number,
	unit: string,
	rounding: DecimalRounding = "exact",
): number {
	const normalized = value.trim();
	const match = NON_NEGATIVE_DECIMAL_PATTERN.exec(normalized);

	if (!match) {
		throw new Error(`Invalid ${unit} decimal: ${value}`);
	}

	const [whole = "0", fraction = ""] = normalized.split(".");
	const hasRemainder =
		fraction.length > scaleDigits && /[1-9]/u.test(fraction.slice(scaleDigits));

	if (hasRemainder && rounding === "exact") {
		throw new Error(
			`${value} cannot be represented exactly as integer ${unit}`,
		);
	}

	const scaled =
		BigInt(whole) * 10n ** BigInt(scaleDigits) +
		BigInt((fraction.slice(0, scaleDigits) || "0").padEnd(scaleDigits, "0")) +
		(hasRemainder ? 1n : 0n);

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
