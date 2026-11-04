/**
 * Pure helpers of the app AI gateway: parse and clean the inbound body,
 * and read the token usage from an upstream answer (JSON or SSE stream).
 * `AppAiGatewayService` calls them. They call zod and the contracts only.
 */
import {
	APP_AI_DEFAULT_MODEL,
	APP_AI_MAX_OUTPUT_TOKENS,
	APP_AI_MODELS,
	type AppAiChatCompletionRequest,
	type AppAiModel,
	type AppAiUpstreamUsage,
	appAiChatCompletionRequestSchema,
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

// ESTIMATE: 5,000 tokens is above the bill of one image on each allowed
// model. The worst case is the gpt-5.4 family at detail low: 4,096 patches
// x 1.2 = 4,916 tokens. A remote image URL is only a few body bytes, so the
// byte count alone makes the hold too small.
const IMAGE_PART_MAX_TOKENS = 5_000;

// An upstream answer or SSE frame that carries usage. Other fields stay unread.
const usageCarrierSchema = z.object({ usage: appAiUpstreamUsageSchema });

// The OpenAI error body of an upstream refusal.
const upstreamErrorSchema = z.object({
	error: z.object({ message: z.string() }),
});

/**
 * Parses the raw body bytes of one gateway call. It drops every field
 * outside the allow list, sets the model, caps the output tokens, forces
 * the stream usage, and estimates the input tokens. It never throws.
 */
export function parseAppAiRequest(body: Buffer): AppAiRequestParse {
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
	const parsed = appAiChatCompletionRequestSchema.safeParse(json);
	if (!parsed.success) {
		if (parsed.error.issues.some((issue) => issue.path[0] === "model")) {
			return {
				ok: false,
				code: "model_not_allowed",
				message: `Use one of these models: ${APP_AI_MODELS.join(", ")}.`,
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
 * Maps the OpenAI usage to the metering usage. `prompt_tokens` includes
 * the cached tokens, so only the rest is billed at the full input rate.
 */
export function appAiMeteredUsage(
	usage: AppAiUpstreamUsage,
): MeteredTokenUsage {
	const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
	return {
		inputTokens: usage.prompt_tokens,
		inputTokenDetails: {
			cacheReadTokens: cachedTokens,
			noCacheTokens: Math.max(0, usage.prompt_tokens - cachedTokens),
		},
		outputTokens: usage.completion_tokens,
	};
}

/** The usage of a JSON answer body, or null when the body has none. */
export function appAiUsageFromJson(text: string): AppAiUpstreamUsage | null {
	return parseJsonAs(usageCarrierSchema, text)?.usage ?? null;
}

/**
 * Reads the usage of an OpenAI SSE stream, chunk by chunk. A frame can
 * span two chunks, so the parser keeps the open frame until it ends.
 * The last usage wins; `usage()` is null when no frame carried one.
 */
export function createAppAiSseUsageParser(): {
	feed(chunk: string): void;
	usage(): AppAiUpstreamUsage | null;
} {
	let buffer = "";
	let usage: AppAiUpstreamUsage | null = null;
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
		usage(): AppAiUpstreamUsage | null {
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
