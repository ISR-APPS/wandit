// LLM provider selection: the one seam that decides whether TEXT-model
// traffic runs on the Vercel AI Gateway (default) or OpenRouter. AI_PROVIDER
// sets the default for every task; AI_PROVIDER_OVERRIDES routes individual
// tasks ("page_build=openrouter") the other way. Canonical model ids stay in
// the Vercel `creator/model` form everywhere (env vars, pricing table, usage
// events); OpenRouter's few divergent creator prefixes are translated only at
// this boundary.
//
// Media models (image/video/transcription) intentionally stay on the Vercel
// gateway regardless of AI_PROVIDER: OpenRouter's AI SDK provider has no
// transcription surface and the media call sites rely on gateway-specific
// behavior, so those paths keep importing @ai-sdk/gateway directly.
import { createGateway } from "@ai-sdk/gateway";
import type {
	LanguageModelV4,
	LanguageModelV4StreamPart,
	SharedV4ProviderMetadata,
} from "@ai-sdk/provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
	type LlmProviderOverrides,
	type LlmTask,
	parseLlmProviderOverrides,
} from "@wandit/env/llm-routing";
import { env } from "@wandit/env/server";
import { type JSONValue, type LanguageModel, wrapLanguageModel } from "ai";

import {
	type GatewayAttribution,
	type GatewayMeteringContext,
	withGatewayAttribution,
} from "../../metering/domain/gateway-metering";

export type LlmProviderKind = "openrouter" | "vercel";
export type { LlmTask } from "@wandit/env/llm-routing";

/** Efforts accepted by both the env knob and OpenRouter's unified reasoning. */
export type LlmReasoningEffort =
	| "high"
	| "low"
	| "medium"
	| "minimal"
	| "xhigh";

/** The AI_PROVIDER default, before any per-task override. */
export function activeLlmProvider(): LlmProviderKind {
	// Normalized here instead of trusting the zod default: test setups (and
	// SKIP_ENV_VALIDATION) can hand over an env object with no AI_PROVIDER at
	// all, and anything that is not explicitly "openrouter" must mean the
	// pre-port Vercel behavior.
	return env.AI_PROVIDER === "openrouter" ? "openrouter" : "vercel";
}

let overridesCache: {
	overrides: LlmProviderOverrides;
	raw: string | undefined;
} | null = null;

function llmProviderOverrides(): LlmProviderOverrides {
	const raw = env.AI_PROVIDER_OVERRIDES;

	if (!overridesCache || overridesCache.raw !== raw) {
		// The env schema rejects bad entries at boot; if validation was skipped
		// (tests), a bad entry stays out of the map and its task follows
		// AI_PROVIDER instead of routing somewhere unintended.
		overridesCache = {
			overrides: parseLlmProviderOverrides(raw).overrides,
			raw,
		};
	}

	return overridesCache.overrides;
}

/** The provider a specific task runs on: its override, else AI_PROVIDER. */
export function llmProviderForTask(task: LlmTask): LlmProviderKind {
	return llmProviderOverrides()[task] ?? activeLlmProvider();
}

/**
 * Key gate for TEXT-model features, per task. Media paths keep checking
 * AI_GATEWAY_API_KEY directly because they never leave the Vercel gateway.
 */
export function hasLlmProviderKey(task: LlmTask): boolean {
	return llmProviderForTask(task) === "openrouter"
		? Boolean(env.OPENROUTER_API_KEY)
		: Boolean(env.AI_GATEWAY_API_KEY);
}

/** For error messages and config assertions. */
export function llmProviderKeyName(
	task: LlmTask,
): "AI_GATEWAY_API_KEY" | "OPENROUTER_API_KEY" {
	return llmProviderForTask(task) === "openrouter"
		? "OPENROUTER_API_KEY"
		: "AI_GATEWAY_API_KEY";
}

/**
 * OpenRouter shares the `creator/model` slug convention but spells several
 * creators differently. Ids not covered here pass through unchanged — the
 * big catalogs (openai/, anthropic/, google/, deepseek/, moonshotai/) match.
 * The Vercel gateway's creator names are canonical; when routing a new model
 * family to OpenRouter, confirm its creator slug matches or add a pair here.
 */
const OPENROUTER_PREFIX_BY_CANONICAL: readonly (readonly [string, string])[] = [
	["alibaba/", "qwen/"],
	["meta/", "meta-llama/"],
	["mistral/", "mistralai/"],
	["stepfun/", "stepfun-ai/"],
	["xai/", "x-ai/"],
	["zai/", "z-ai/"],
];

export function toOpenRouterModelId(modelId: string): string {
	for (const [canonical, openrouter] of OPENROUTER_PREFIX_BY_CANONICAL) {
		if (modelId.startsWith(canonical)) {
			return `${openrouter}${modelId.slice(canonical.length)}`;
		}
	}

	return modelId;
}

export function fromOpenRouterModelId(modelId: string): string {
	for (const [canonical, openrouter] of OPENROUTER_PREFIX_BY_CANONICAL) {
		if (modelId.startsWith(openrouter)) {
			return `${canonical}${modelId.slice(openrouter.length)}`;
		}
	}

	return modelId;
}

export type LlmModelSettings = {
	/** Metering attribution: OpenRouter carries it as the `user` setting. */
	context: GatewayMeteringContext;
	/** Long-idle fetch override; only the chat API process pins one. */
	fetch?: typeof fetch;
	/**
	 * On OpenRouter this maps to the unified `reasoning.effort` request field.
	 * On the Vercel gateway reasoning stays a providerOptions concern (the
	 * vendor-scoped keys call sites already send), so it is ignored here.
	 */
	reasoningEffort?: LlmReasoningEffort;
	/**
	 * Vercel `gateway.order` routing preferences, translated to OpenRouter's
	 * `provider.order`. Slugs are best-effort: both registries use lowercase
	 * provider names for the routes we pin (novita, fireworks).
	 */
	routingOrder?: readonly string[];
	/** Which routing knob governs this call (AI_PROVIDER_OVERRIDES key). */
	task: LlmTask;
};

/**
 * Build the model for a TEXT call site. On Vercel this preserves the exact
 * pre-port behavior: a bare model string resolving through the AI SDK's
 * default gateway provider, or an explicit gateway instance when a custom
 * fetch must travel with it. On OpenRouter it returns a chat model wrapped so
 * its generation id lands where metering capture expects it.
 */
export function createLlmModel(
	modelId: string,
	settings: LlmModelSettings,
): LanguageModel {
	if (llmProviderForTask(settings.task) === "vercel") {
		return settings.fetch
			? createGateway({ fetch: settings.fetch })(modelId)
			: modelId;
	}

	const openrouter = createOpenRouter({
		apiKey: env.OPENROUTER_API_KEY,
		...(settings.fetch ? { fetch: settings.fetch } : {}),
	});

	const model = openrouter.chat(toOpenRouterModelId(modelId), {
		...(settings.reasoningEffort
			? { reasoning: { effort: settings.reasoningEffort } }
			: {}),
		...(settings.routingOrder && settings.routingOrder.length > 0
			? { provider: { order: [...settings.routingOrder] } }
			: {}),
		user: settings.context.userId,
	});

	return withOpenRouterGenerationId(model);
}

/**
 * Attribution wrapper for TEXT calls. Vercel keeps the mandatory `gateway`
 * attribution block byte-for-byte (tags + user). OpenRouter needs none of it
 * in providerOptions — attribution travels as the model's `user` setting and
 * the vendor-scoped keys the call sites pass are inert there — so the options
 * pass through untouched.
 */
export function withLlmAttribution<T extends Record<string, unknown>>(
	providerOptions: T,
	input: GatewayMeteringContext,
	task: LlmTask,
): T & { gateway?: Record<string, JSONValue> & GatewayAttribution } {
	return llmProviderForTask(task) === "vercel"
		? withGatewayAttribution(providerOptions, input)
		: providerOptions;
}

/**
 * Gateway routing pin for a model, to spread into `providerOptions.gateway`
 * (withGatewayAttribution keeps it next to the attribution block).
 *
 * The Vercel gateway serves `openai/*` models from OpenAI, Azure, AND Bedrock
 * and fails over between them. The fallbacks are slower, and when one stalls
 * the gateway waits out its whole routing budget before it errors — that is
 * how a chat turn took 13 minutes to fail on 2026-08-24. Pin OpenAI-made
 * models to OpenAI itself: a fast, honest error beats a slow fallback.
 *
 * `zai/*` (GLM) gets an order PREFERENCE, not a pin. Friendli first: through
 * gateway billing it rides Vercel's enterprise limits (no BYOK tier wall)
 * and measured the most consistent speed (199-226 tok/s, ~0.7s TTFT,
 * 2026-09-02/03). Baseten second: fast (158-240 tok/s) but BYOK-capped near
 * 500k TPM, far under the ~2.8M TPM evening peak, so it 429s as a primary.
 * Fireworks third (BYOK, ~100 tok/s) as the deep spare. `order` still lets
 * the gateway fall over to the remaining GLM providers when all three error,
 * unlike `only` — GLM capacity is tight everywhere (2026-09), so the deep
 * fallback stays open on purpose.
 *
 * Other creators keep the gateway's default routing, and OpenRouter ignores
 * the `gateway` key entirely, so the pin is safe to send on every path.
 */
export function gatewayRoutingForModel(
	modelId: string,
): Record<string, JSONValue> {
	if (modelId.startsWith("openai/")) {
		return { only: ["openai"] };
	}

	if (modelId.startsWith("zai/")) {
		return { order: ["friendli", "baseten", "fireworks"] };
	}

	return {};
}

/**
 * OpenRouter surfaces its generation id ("gen-…") as the HTTP response id,
 * not inside providerMetadata — but metering capture reads ONLY
 * providerMetadata (step.providerMetadata in onStepEnd). This middleware
 * copies the response id to providerMetadata.openrouter.generationId, the
 * shape capturedGenerationRef() understands, for both call styles.
 *
 * Known gap on the non-streaming path: when OpenRouter answers 200 with an
 * error body, the provider's doGenerate throws an APICallError that keeps
 * only the error object — the response id is discarded before wrapGenerate
 * could see it, so a FAILED one-shot call leaves no id to tag and its cost
 * evidence is lost (the customer-facing refund behavior is unaffected).
 * Streaming calls do not have this gap: the id arrives as the first stream
 * part and is tagged onto every error below.
 */
function withOpenRouterGenerationId(model: LanguageModelV4): LanguageModel {
	return wrapLanguageModel({
		middleware: {
			specificationVersion: "v4",
			wrapGenerate: async ({ doGenerate }) => {
				const result = await doGenerate();

				return {
					...result,
					providerMetadata: withGenerationIdMetadata(
						result.providerMetadata,
						result.response?.id,
					),
				};
			},
			wrapStream: async ({ doStream, params }) => {
				const { stream, ...rest } = await doStream();

				return {
					...rest,
					stream: streamWithGenerationId(stream, params.abortSignal),
				};
			},
		},
		model,
	});
}

/**
 * The generation id arrives in the FIRST stream part (response metadata),
 * but metering reads it from the LAST (the finish part) — and a stream that
 * dies mid-flight never emits one. Remember the id the moment it appears,
 * stamp it on the finish part, and tag it onto every error so a failed
 * stream still leaves a billable generation ref behind
 * (llmGenerationCaptureFromError reads the tag).
 */
function streamWithGenerationId(
	stream: ReadableStream<LanguageModelV4StreamPart>,
	abortSignal?: AbortSignal,
): ReadableStream<LanguageModelV4StreamPart> {
	const reader = stream.getReader();
	let generationId: string | undefined;
	const tagAbortReason = () => {
		tagOpenRouterGenerationId(abortSignal?.reason, generationId);
	};
	const removeAbortListener = () => {
		abortSignal?.removeEventListener("abort", tagAbortReason);
	};
	abortSignal?.addEventListener("abort", tagAbortReason, { once: true });

	return new ReadableStream<LanguageModelV4StreamPart>({
		cancel(reason) {
			tagAbortReason();
			tagOpenRouterGenerationId(reason, generationId);
			removeAbortListener();
			return reader.cancel(reason);
		},
		async pull(controller) {
			let read: Awaited<ReturnType<typeof reader.read>>;

			try {
				read = await reader.read();
			} catch (error) {
				// Transport-level failure (socket death, abort): the tagged error
				// propagates to the AI SDK's error path with the id attached.
				tagAbortReason();
				removeAbortListener();
				throw tagOpenRouterGenerationId(error, generationId);
			}

			if (read.done) {
				removeAbortListener();
				controller.close();
				return;
			}

			const part = read.value;

			if (part.type === "response-metadata" && part.id) {
				generationId = part.id;
				if (abortSignal?.aborted) {
					tagAbortReason();
				}
			}

			// Provider-emitted error parts flow to onError callbacks; tag the
			// error object in place so capture-from-error can find the id.
			if (part.type === "error") {
				tagOpenRouterGenerationId(part.error, generationId);
			}

			controller.enqueue(
				part.type === "finish"
					? {
							...part,
							providerMetadata: withGenerationIdMetadata(
								part.providerMetadata,
								generationId,
							),
						}
					: part,
			);
		},
	});
}

/**
 * Attach the id under a distinct key (not `generationId`) so error capture
 * can never mistake an OpenRouter generation for a Vercel one — the two
 * reconcile against different cost APIs.
 */
function tagOpenRouterGenerationId(
	error: unknown,
	generationId: string | undefined,
): unknown {
	if (
		generationId &&
		typeof error === "object" &&
		error !== null &&
		!("openrouterGenerationId" in error)
	) {
		try {
			Object.defineProperty(error, "openrouterGenerationId", {
				configurable: true,
				enumerable: true,
				value: generationId,
			});
		} catch {
			// A frozen error keeps its shape; losing the tag only means the
			// pre-fix behavior (customer refunded) for this one generation.
		}
	}

	return error;
}

function withGenerationIdMetadata(
	providerMetadata: SharedV4ProviderMetadata | undefined,
	generationId: string | undefined,
): SharedV4ProviderMetadata | undefined {
	if (!generationId) {
		return providerMetadata;
	}

	return {
		...providerMetadata,
		openrouter: {
			...providerMetadata?.openrouter,
			generationId,
		},
	};
}
