/**
 * Pure helpers of the app AI gateway: parse and clean the inbound body,
 * and read the token usage and the gateway cost from an upstream answer
 * (JSON or SSE stream).
 * The three app AI services and `AppAiAdmission` call them. They call zod
 * and the contracts only.
 */
import {
	APP_AI_DEFAULT_MODEL,
	APP_AI_MAX_OUTPUT_TOKENS,
	APP_AI_MODELS,
	type AppAiChatCompletionRequest,
	type AppAiGatewayCost,
	type AppAiModel,
	type AppAiUpstreamUsage,
	appAiChatCompletionRequestSchema,
	appAiGatewayCostSchema,
	appAiUpstreamUsageSchema,
} from "@wandit/contracts";
import { z } from "zod";

import type { MeteredTokenUsage } from "../../metering/domain/model-pricing";

/**
 * The body the gateway sends upstream. Only the allow-listed fields stay;
 * `max_tokens` always has a value at or below `APP_AI_MAX_OUTPUT_TOKENS`.
 */
export type AppAiUpstreamBody = Omit<
	AppAiChatCompletionRequest,
	"model" | "max_tokens" | "max_completion_tokens"
> & {
	model: AppAiModel;
	max_tokens: number;
	/** Set for a stream only. It makes the upstream send the usage in the last frame. */
	stream_options?: { include_usage: boolean };
};

/**
 * The result of `parseAppAiRequest`. A refusal carries a short message for
 * the app developer. The message names field paths, never field values.
 */
export type AppAiRequestParse =
	| {
			ok: true;
			model: AppAiModel;
			/** The output token cap of the call; the reserve estimate uses it too. */
			maxOutputTokens: number;
			/** The upper input token estimate of the reserve: the body bytes plus each image part. */
			estimatedInputTokens: number;
			upstreamBody: AppAiUpstreamBody;
	  }
	| {
			ok: false;
			code: "invalid_request" | "model_not_allowed";
			message: string;
	  };

// The refusal message names at most this many zod issues.
const MAX_ISSUES_IN_MESSAGE = 5;

// One input token for each 4 body bytes: the reserve estimate of the text.
const BODY_BYTES_PER_TOKEN = 4;

// ESTIMATE: 5,000 tokens for one image part. The value is checked for the
// gpt-5.4 family only: detail low is 4,096 patches x 1.2 = 4,916 tokens.
// It sets only the hold. The settle bills the real cost of the answer.
// A remote image URL is only a few body bytes, so the byte count alone
// makes the hold too small.
const IMAGE_PART_MAX_TOKENS = 5_000;

// The choice-level `provider_metadata.gateway` cost of a message (JSON body)
// or a delta (stream frame). A malformed object reads as absent.
const choiceCostCarrierSchema = z
	.object({
		provider_metadata: z.object({ gateway: appAiGatewayCostSchema }),
	})
	.optional()
	.catch(undefined);

// An upstream answer or SSE frame that carries usage. Other fields stay
// unread. A malformed `choices` list never fails the read of the usage.
const usageCarrierSchema = z.object({
	usage: appAiUpstreamUsageSchema,
	choices: z
		.array(
			z.object({
				message: choiceCostCarrierSchema,
				delta: choiceCostCarrierSchema,
			}),
		)
		.optional()
		.catch(undefined),
});

/**
 * The usage of one answer, plus the documented choice-level gateway cost
 * of the same JSON body or stream frame. The settle stores it as `rawUsage`.
 */
export type AppAiAnswerUsage = AppAiUpstreamUsage & {
	/** `choices[0]` `provider_metadata.gateway`; null when the answer has none. */
	choiceGatewayCost: AppAiGatewayCost | null;
};

const USD_MICROS_PER_USD = 1_000_000;

// The int4 limit of the metering cost column. MeteringService refuses a larger cost.
const MAX_SETTLE_USD_MICROS = 2_147_483_647;

// The OpenAI error body of an upstream refusal.
const upstreamErrorSchema = z.object({
	error: z.object({ message: z.string() }),
});

/** The result of `parseAppAiFields`: the parsed fields, or a 400 refusal. */
export type AppAiBodyParse<Body extends Record<string, unknown>> =
	| { ok: true; data: Body }
	| {
			ok: false;
			code: "invalid_request" | "model_not_allowed";
			message: string;
	  };

/**
 * Parses the raw JSON body of one gateway call with `schema`. A bad
 * `model` gives `model_not_allowed` with the `models` list. It never throws.
 */
export function parseAppAiJsonBody<Schema extends z.ZodObject>(
	schema: Schema,
	body: Buffer,
	models: readonly string[],
): AppAiBodyParse<z.infer<Schema>> {
	let json: unknown;
	try {
		json = JSON.parse(body.toString("utf8"));
	} catch {
		// A body that is not JSON is a client error; the answer says so.
		return {
			ok: false,
			code: "invalid_request",
			message: "The body is not valid JSON.",
		};
	}
	return parseAppAiFields(schema, json, models);
}

/**
 * Parses the fields of one gateway call (a JSON value or the multipart text
 * fields) with `schema`. A bad `model` gives `model_not_allowed`. It never throws.
 */
export function parseAppAiFields<Schema extends z.ZodObject>(
	schema: Schema,
	fields: unknown,
	models: readonly string[],
): AppAiBodyParse<z.infer<Schema>> {
	const parsed = schema.safeParse(fields);
	if (parsed.success) {
		return { ok: true, data: parsed.data };
	}
	if (parsed.error.issues.some((issue) => issue.path[0] === "model")) {
		return {
			ok: false,
			code: "model_not_allowed",
			message: `Use one of these models: ${models.join(", ")}.`,
		};
	}
	const summary = parsed.error.issues
		.slice(0, MAX_ISSUES_IN_MESSAGE)
		.map((issue) => {
			const path = issue.path.map(String).join(".");
			return `${path.length > 0 ? path : "body"}: ${issue.message}`;
		})
		.join("; ");
	return { ok: false, code: "invalid_request", message: summary };
}

/**
 * Parses the raw body bytes of one gateway call. It drops every field
 * outside the allow list, sets the model, caps the output tokens, forces
 * the stream usage, and estimates the input tokens. It never throws.
 */
export function parseAppAiRequest(body: Buffer): AppAiRequestParse {
	const parsed = parseAppAiJsonBody(
		appAiChatCompletionRequestSchema,
		body,
		APP_AI_MODELS,
	);
	if (!parsed.ok) {
		return parsed;
	}
	const { max_completion_tokens, max_tokens, model, ...fields } = parsed.data;
	const chosenModel = model ?? APP_AI_DEFAULT_MODEL;
	// The cap bounds the cost of one call, also when the client asks for more.
	const maxOutputTokens = Math.min(
		max_tokens ?? max_completion_tokens ?? APP_AI_MAX_OUTPUT_TOKENS,
		APP_AI_MAX_OUTPUT_TOKENS,
	);
	const imageParts = fields.messages
		.flatMap((message) =>
			Array.isArray(message.content) ? message.content : [],
		)
		.filter((part) => part.type === "image_url").length;
	return {
		ok: true,
		model: chosenModel,
		maxOutputTokens,
		// LIMIT: an image data URL counts twice (its bytes and its part), so the
		// hold is high. Upgrade: a token count per model.
		estimatedInputTokens:
			Math.ceil(body.length / BODY_BYTES_PER_TOKEN) +
			imageParts * IMAGE_PART_MAX_TOKENS,
		upstreamBody: {
			...fields,
			model: chosenModel,
			max_tokens: maxOutputTokens,
			// Without it a stream carries no usage, and the call stays unbilled.
			...(fields.stream === true
				? { stream_options: { include_usage: true } }
				: {}),
		},
	};
}

/**
 * Maps the OpenAI usage to the metering usage of the token fallback. The
 * output adds the reasoning tokens, which `completion_tokens` leaves out
 * for OpenAI and Google models. Each prompt token that is not a cache read
 * bills as a cache write. An OpenAI GPT-6 model writes the cache without a
 * request field. The usage has no proved write count. A model without a
 * write rate bills these tokens at the input rate.
 */
export function appAiMeteredUsage(
	usage: AppAiUpstreamUsage,
): MeteredTokenUsage {
	const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
	return {
		inputTokens: usage.prompt_tokens,
		inputTokenDetails: {
			cacheReadTokens: cachedTokens,
			cacheWriteTokens: Math.max(0, usage.prompt_tokens - cachedTokens),
			noCacheTokens: 0,
		},
		outputTokens:
			usage.completion_tokens +
			(usage.completion_tokens_details?.reasoning_tokens ?? 0),
	};
}

/**
 * The cost that the gateway reports for one answer, in USD micros rounded
 * up: the highest of `usage.cost`, `usage.market_cost`,
 * `usage.cost_details.upstream_inference_cost`, and the choice-level
 * `cost` and `marketCost`. Null when no value is above 0 or the highest is
 * above the int4 limit of the metering. The caller then bills by tokens.
 */
export function appAiGatewayCostUsdMicros(
	usage: AppAiAnswerUsage,
): number | null {
	// BYOK: `cost` can be 0 while `market_cost` has the list rate, so the highest value wins.
	const highestUsd = Math.max(
		usage.cost ?? 0,
		usage.market_cost ?? 0,
		usage.cost_details?.upstream_inference_cost ?? 0,
		usage.choiceGatewayCost?.cost ?? 0,
		usage.choiceGatewayCost?.marketCost ?? 0,
	);
	return appAiGatewayUsdToMicros(highestUsd);
}

/**
 * A gateway cost in USD as whole USD micros, rounded up. Null when it is not
 * above 0 or above the int4 limit of the metering. The chat and the Google
 * image settle use it.
 */
export function appAiGatewayUsdToMicros(usd: number): number | null {
	// Float math gives 123.00000000000001 for 0.000123 USD. Rounding to 6
	// decimals of a micro first removes that noise before the round up.
	const usdMicros = Math.ceil(Number((usd * USD_MICROS_PER_USD).toFixed(6)));
	// The two comparisons also refuse NaN and Infinity.
	return usdMicros > 0 && usdMicros <= MAX_SETTLE_USD_MICROS ? usdMicros : null;
}

/**
 * The usage of a JSON answer body or of one stream frame, with the
 * choice-level gateway cost. Null when the text carries no usage.
 */
export function appAiUsageFromJson(text: string): AppAiAnswerUsage | null {
	const carrier = parseJsonAs(usageCarrierSchema, text);
	if (carrier === null) {
		return null;
	}
	const choice = carrier.choices?.[0];
	return {
		...carrier.usage,
		choiceGatewayCost:
			choice?.message?.provider_metadata.gateway ??
			choice?.delta?.provider_metadata.gateway ??
			null,
	};
}

/**
 * Reads the usage of an OpenAI SSE stream, chunk by chunk. A frame can
 * span two chunks, so the parser keeps the open frame until it ends.
 * The last usage wins; `usage()` is null when no frame carried one.
 */
export function createAppAiSseUsageParser(): {
	feed(chunk: string): void;
	usage(): AppAiAnswerUsage | null;
} {
	let buffer = "";
	let usage: AppAiAnswerUsage | null = null;
	return {
		feed(chunk: string): void {
			// SSE allows CRLF line ends; the frame split below needs LF.
			buffer = (buffer + chunk).replaceAll("\r\n", "\n");
			const frames = buffer.split("\n\n");
			// The last piece is incomplete until the next chunk.
			buffer = frames.pop() ?? "";
			for (const frame of frames) {
				const data = frame
					.split("\n")
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice("data:".length).trimStart())
					.join("\n");
				const found = data.length > 0 ? appAiUsageFromJson(data) : null;
				if (found !== null) {
					usage = found;
				}
			}
		},
		usage(): AppAiAnswerUsage | null {
			return usage;
		},
	};
}

// The longest upstream error message that the app developer gets.
const UPSTREAM_MESSAGE_MAX_CHARS = 500;

/**
 * The message of an upstream OpenAI error body, cut to 500 characters,
 * or null when the body has another shape.
 */
export function upstreamErrorMessage(text: string): string | null {
	return (
		parseJsonAs(upstreamErrorSchema, text)?.error.message.slice(
			0,
			UPSTREAM_MESSAGE_MAX_CHARS,
		) ?? null
	);
}

// The `schema` value of a JSON text, or null for another shape.
function parseJsonAs<Schema extends z.ZodType>(
	schema: Schema,
	text: string,
): z.infer<Schema> | null {
	try {
		const parsed = schema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		// Non-JSON text (an SSE `[DONE]`, an HTML error page) has no value.
		return null;
	}
}
