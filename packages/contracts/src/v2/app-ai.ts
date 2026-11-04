/**
 * Contract of the app AI gateway: the OpenAI-compatible route that a V2
 * app calls from its Supabase Edge Function, the `enable_ai` host tool, and
 * the AI panel routes. The API, the builder host tools, and the web panel
 * import these schemas. The gateway bills each call to the project payer.
 */
import { z } from "zod";

import { isoDateTimeSchema } from "../v1/shared/primitives";
import { backendToolFailureSchema } from "./backend-tools";

/**
 * Name of the Edge Function secret that holds the per-project gateway key.
 * The `WANDIT_` prefix is reserved, so a user secret never takes it.
 */
export const APP_AI_KEY_SECRET_NAME = "WANDIT_AI_API_KEY";

/** Name of the Edge Function secret that holds the gateway base URL. */
export const APP_AI_URL_SECRET_NAME = "WANDIT_AI_GATEWAY_URL";

/**
 * Prefix of every gateway key. The publish secret scan and the Sentry
 * scrubber search for it, so a leaked key never ships or gets logged.
 */
export const APP_AI_KEY_PREFIX = "wnd_ai_";

/**
 * Full key: the prefix, the project id as 32 hex digits without dashes, a
 * `_`, and 32 random bytes as 43 base64url characters. The project id in
 * the key lets the gateway read one row instead of a search.
 */
export const APP_AI_KEY_PATTERN = /^wnd_ai_([0-9a-f]{32})_([A-Za-z0-9_-]{43})$/;

/**
 * Models an app may call, as Vercel AI Gateway ids. Each id must have a
 * row in `model_prices` or the seed file: the gateway fails closed on an
 * unpriced model. Text and image input only; no image output models.
 */
export const APP_AI_MODELS = [
	"google/gemini-3-flash",
	"google/gemini-3.1-flash-lite",
	"openai/gpt-5.4-mini",
	"openai/gpt-5.4-nano",
	"openai/gpt-5.4",
	"anthropic/claude-haiku-4.5",
] as const;

/** Runtime validator of an app model id. */
export const appAiModelSchema = z.enum(APP_AI_MODELS);

/** TypeScript app model id. */
export type AppAiModel = z.infer<typeof appAiModelSchema>;

/** The model a request without `model` gets: fast, cheap, and multimodal. */
export const APP_AI_DEFAULT_MODEL: AppAiModel = "google/gemini-3-flash";

/**
 * Highest output token count of one call. The gateway sends at most this
 * as `max_tokens`, so the cost of one call has a ceiling.
 */
export const APP_AI_MAX_OUTPUT_TOKENS = 8192;

// One part of a message content array: text or an image only. A file or
// audio part bills a cost that the reserve cannot estimate, so zod refuses
// it. `detail: "original"` is refused for the same reason.
const appAiContentPartSchema = z.discriminatedUnion("type", [
	z.looseObject({ type: z.literal("text"), text: z.string() }),
	z.looseObject({
		type: z.literal("image_url"),
		image_url: z.looseObject({
			url: z.string(),
			detail: z.enum(["auto", "low", "high"]).optional(),
		}),
	}),
]);

// One OpenAI chat message. The gateway reads the role and the content
// parts; other fields (tool calls, names) go to the upstream unchanged.
const appAiMessageSchema = z.looseObject({
	role: z.enum(["system", "developer", "user", "assistant", "tool"]),
	// Null on an assistant message that holds only tool calls.
	content: z.union([z.string(), z.array(appAiContentPartSchema)]).nullish(),
});

// One OpenAI function tool. The gateway forwards the definition unchanged.
const appAiToolSchema = z.looseObject({ type: z.literal("function") });

/**
 * Body of `POST /api/v2/ai/v1/chat/completions`. Only these fields reach
 * the upstream. z.object drops every other field, also the Vercel gateway
 * extensions `models`, `providerOptions`, and `service_tier`: they would
 * change the billed model or the price behind the allow list.
 */
export const appAiChatCompletionRequestSchema = z.object({
	model: appAiModelSchema.optional(),
	// 500 messages: far above a real chat; it limits the work per request.
	messages: z.array(appAiMessageSchema).min(1).max(500),
	stream: z.boolean().optional(),
	max_tokens: z.int().positive().optional(),
	max_completion_tokens: z.int().positive().optional(),
	temperature: z.number().min(0).max(2).optional(),
	top_p: z.number().min(0).max(1).optional(),
	stop: z.union([z.string(), z.array(z.string()).max(4)]).optional(),
	presence_penalty: z.number().min(-2).max(2).optional(),
	frequency_penalty: z.number().min(-2).max(2).optional(),
	seed: z.int().optional(),
	response_format: z
		.looseObject({ type: z.enum(["text", "json_object", "json_schema"]) })
		.optional(),
	// 128 tools: the OpenAI limit.
	tools: z.array(appAiToolSchema).max(128).optional(),
	tool_choice: z
		.union([
			z.enum(["none", "auto", "required"]),
			z.looseObject({ type: z.literal("function") }),
		])
		.optional(),
	parallel_tool_calls: z.boolean().optional(),
	reasoning_effort: z.enum(["minimal", "low", "medium", "high"]).optional(),
	// An id of the app's end user, for abuse reports of the provider.
	user: z.string().max(256).optional(),
});

/** Parsed gateway request body. */
export type AppAiChatCompletionRequest = z.infer<
	typeof appAiChatCompletionRequestSchema
>;

/**
 * The `usage` object of an upstream answer, in the JSON body or in the
 * last stream chunk. `prompt_tokens` includes the cached tokens.
 */
export const appAiUpstreamUsageSchema = z.object({
	prompt_tokens: z.int().nonnegative(),
	completion_tokens: z.int().nonnegative(),
	prompt_tokens_details: z
		.object({ cached_tokens: z.int().nonnegative().nullish() })
		.nullish(),
});

/** Parsed upstream usage. */
export type AppAiUpstreamUsage = z.infer<typeof appAiUpstreamUsageSchema>;

/**
 * Error codes of the gateway, in the OpenAI error body
 * `{ error: { message, type, code } }`, so an OpenAI client can read them.
 */
export const appAiErrorCodes = [
	"invalid_api_key",
	"invalid_request",
	"model_not_allowed",
	"project_suspended",
	"insufficient_credits",
	"rate_limited",
	"upstream_error",
	"gateway_unavailable",
] as const;

/** TypeScript gateway error code. */
export type AppAiErrorCode = (typeof appAiErrorCodes)[number];

/** Input of the `enable_ai` host tool: the tool takes no field. */
export const enableAiToolInputSchema = z.object({});

/** Parsed `enable_ai` input. */
export type EnableAiToolInput = z.infer<typeof enableAiToolInputSchema>;

/**
 * Output of `enable_ai`. `enabled` names the two Edge Function secrets and
 * the models. It never carries the key.
 */
export const enableAiToolOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("enabled"),
		keySecretName: z.literal(APP_AI_KEY_SECRET_NAME),
		urlSecretName: z.literal(APP_AI_URL_SECRET_NAME),
		defaultModel: appAiModelSchema,
		models: z.array(appAiModelSchema),
	}),
	...backendToolFailureSchema.options,
]);

/** Parsed `enable_ai` output. */
export type EnableAiToolOutput = z.infer<typeof enableAiToolOutputSchema>;

/**
 * Body of `GET /api/v2/projects/:id/ai` and of the key writes. The panel
 * shows it; it never carries the key.
 */
export const appAiStatusSchema = z.object({
	// True while the project holds a gateway key.
	enabled: z.boolean(),
	// Time of the last key write (create or rotate); null when disabled.
	keyUpdatedAt: isoDateTimeSchema.nullable(),
	// Credits the gateway charged since the UTC month start, in centi-credits.
	monthCredits: z.int().nonnegative(),
	// Billed gateway calls since the UTC month start.
	monthRequests: z.int().nonnegative(),
	defaultModel: appAiModelSchema,
	models: z.array(appAiModelSchema),
});

/** Parsed AI panel status. */
export type AppAiStatus = z.infer<typeof appAiStatusSchema>;
