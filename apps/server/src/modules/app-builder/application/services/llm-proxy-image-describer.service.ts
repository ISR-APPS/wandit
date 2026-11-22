/**
 * Describes one image in text for a builder model whose hosts cannot read images.
 * `LlmProxyService` calls `describe` when it rewrites a request for such a model.
 * It makes one AI SDK call to `IMAGE_DESCRIBER_MODEL` and prices the tokens with `ModelPricingService`.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/nestjs";
import { type FinishReason, generateText } from "ai";

import {
	createLlmModel,
	withLlmAttribution,
} from "../../../ai-provider/domain/llm-provider";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import type { TokenUsageQuote } from "../../../metering/domain/model-pricing";
import type { LlmTokenUsage } from "../../domain/anthropic-sse-usage";

/**
 * The vision model of the describer. The gateway lists it (`model-prices.seed.json`),
 * it reads images, and it costs $0.50 input and $3 output per million tokens.
 */
export const IMAGE_DESCRIBER_MODEL = "google/gemini-3-flash";

/** The `provider` of the `llm_proxy_requests` row of one description. */
export const IMAGE_DESCRIBER_PROVIDER = "google";

// 30 s. The builder request waits for the description, and Claude Code retries a slow request.
const IMAGE_DESCRIBER_TIMEOUT_MS = 30_000;

// 3 000 tokens, at most $0.009 per image. A full page with its text needs about 1 500.
// Thinking tokens count against this cap too, so the call sets a low thinking level.
const IMAGE_DESCRIBER_MAX_OUTPUT_TOKENS = 3_000;

const IMAGE_DESCRIBER_PROMPT = [
	"Describe this image for a coding agent that cannot see it. The agent builds or changes an app from your text.",
	"Give the layout from top to bottom and from left to right: regions, columns, and the position of each part.",
	"Copy every visible text verbatim, in quotes.",
	"Give each color as a hex code: backgrounds, text, borders, buttons, and gradients.",
	"Name each UI component: buttons, inputs, cards, lists, tabs, icons, images, and charts.",
	"Give the sizes and the spacing in pixels, as an estimate.",
	"Give the state: selected, disabled, hover, focus, errors, empty states, and loading states.",
	"If the image is a photo or an illustration, describe its subject, style, and colors.",
	"Write only the description, with no preamble.",
].join("\n");

/** One image of a builder request, from a base64 `image` block. */
export type DescribedImage = {
	/** `source.media_type` of the block, for example `image/png`. */
	mediaType: string;
	/** The decoded bytes of `source.data`. */
	bytes: Buffer;
};

/** The workspace that pays for the description, from the run token claims. */
export type DescriberPayer = {
	userId: string;
	/** Null for a personal workspace. */
	organizationId: string | null;
};

/** The answer of one description, with the cost that the turn pays. */
export type ImageDescription = {
	/** The description, trimmed. Can be empty when the model answered nothing. */
	text: string;
	/** Token counts in the `llm_proxy_requests` form. `inputTokens` holds only the uncached input. */
	usage: LlmTokenUsage;
	/** Cost in USD micros. Null when no price is available: the error is already logged. */
	usdMicros: number | null;
	/** "length" when the text stops at `IMAGE_DESCRIBER_MAX_OUTPUT_TOKENS`. The caller then marks the text as cut. */
	finishReason: FinishReason;
	/** The response id of the provider, for the `upstream_request_id` of the row. */
	generationId: string;
	/** Wall time of the describer call, in milliseconds. */
	latencyMs: number;
};

/** The describer of the LLM proxy; see file header. */
@Injectable()
export class LlmProxyImageDescriber {
	private readonly logger = new Logger(LlmProxyImageDescriber.name);

	constructor(
		// The Pick keeps the seam small. A spec passes a plain fake.
		@Inject(ModelPricingService)
		private readonly pricing: Pick<ModelPricingService, "quoteTokenUsage">,
	) {}

	/** The description of `image`. A model error or a timeout throws: the caller puts a fixed text instead. */
	async describe(
		image: DescribedImage,
		payer: DescriberPayer,
	): Promise<ImageDescription> {
		const startedAt = Date.now();
		// The gateway tags the call with the builder turn operation and the user.
		const meteringContext = {
			operation: "agent_session" as const,
			organizationId: payer.organizationId,
			userId: payer.userId,
		};
		const result = await generateText({
			abortSignal: AbortSignal.timeout(IMAGE_DESCRIBER_TIMEOUT_MS),
			maxOutputTokens: IMAGE_DESCRIBER_MAX_OUTPUT_TOKENS,
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: IMAGE_DESCRIBER_PROMPT },
						{ type: "image", image: image.bytes, mediaType: image.mediaType },
					],
				},
			],
			// No LLM task is for the proxy. "chat" keeps the describer on the default provider.
			model: createLlmModel(IMAGE_DESCRIBER_MODEL, {
				context: meteringContext,
				task: "chat",
			}),
			providerOptions: withLlmAttribution(
				// Gemini 3 Flash thinks at "high" by default, and the thinking can use most of the output cap.
				{ google: { thinkingConfig: { thinkingLevel: "low" } } },
				meteringContext,
				"chat",
			),
			telemetry: { functionId: "llm_proxy_image_description" },
		});

		let quote: TokenUsageQuote | null = null;
		try {
			quote = await this.pricing.quoteTokenUsage(
				IMAGE_DESCRIBER_MODEL,
				result.usage,
			);
		} catch (error) {
			// The description is good, so the request goes on. A missing price loses this charge, so alert.
			this.logger.error("llm-proxy.image-describer.price-failed", {
				message: getErrorMessage(error),
				model: IMAGE_DESCRIBER_MODEL,
			});
			Sentry.captureException(error, {
				tags: { feature: "llm-proxy", model: IMAGE_DESCRIBER_MODEL },
			});
		}
		return {
			text: result.text.trim(),
			usage: {
				inputTokens:
					quote?.usage.uncachedInputTokens ?? result.usage.inputTokens ?? 0,
				outputTokens:
					quote?.usage.outputTokens ?? result.usage.outputTokens ?? 0,
				cacheReadTokens: quote?.usage.cacheReadTokens ?? 0,
				cacheWriteTokens: quote?.usage.cacheWriteTokens ?? 0,
				cacheWrite5mTokens: 0,
			},
			usdMicros: quote?.costUsdMicros ?? null,
			finishReason: result.finishReason,
			generationId: result.response.id,
			latencyMs: Date.now() - startedAt,
		};
	}
}
