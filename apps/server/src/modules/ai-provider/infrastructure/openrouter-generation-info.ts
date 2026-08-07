// OpenRouter's per-generation accounting API, shaped to the same contract as
// the Vercel gateway's getGenerationInfo so MeteringService.reconcile can
// consume either. OpenRouter answers 404 while a generation is still being
// metered — exactly the semantics isGatewayUsagePending() already models — so
// pending lookups throw with statusCode 404 and reconciliation retries.
import type { GatewayGenerationInfo } from "@ai-sdk/gateway";
import { z } from "zod";

import type { MeteringGateway } from "../../metering/domain/metering";
import { fromOpenRouterModelId } from "../domain/llm-provider";

export const OPENROUTER_GENERATION_URL =
	"https://openrouter.ai/api/v1/generation";

const GENERATION_LOOKUP_TIMEOUT_MS = 30_000;

const generationSchema = z
	.object({
		cache_discount: z.number().nullish(),
		created_at: z.string().nullish(),
		finish_reason: z.string().nullish(),
		generation_time: z.number().nullish(),
		id: z.string().min(1),
		is_byok: z.boolean().nullish(),
		latency: z.number().nullish(),
		model: z.string().min(1),
		native_tokens_cached: z.number().nullish(),
		native_tokens_completion: z.number().nullish(),
		native_tokens_prompt: z.number().nullish(),
		native_tokens_reasoning: z.number().nullish(),
		num_search_results: z.number().nullish(),
		provider_name: z.string().nullish(),
		streamed: z.boolean().nullish(),
		total_cost: z.number().nullish(),
		upstream_inference_cost: z.number().nullish(),
		usage: z.number().nullish(),
	})
	.passthrough();

const generationResponseSchema = z
	.object({ data: generationSchema })
	.passthrough();

export type OpenRouterGenerationFetch = (
	url: string,
	init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{
	json: () => Promise<unknown>;
	ok: boolean;
	status: number;
	statusText: string;
}>;

export type OpenRouterGenerationInfoOptions = {
	apiKey: string;
	fetch?: OpenRouterGenerationFetch;
	url?: string;
};

/**
 * A MeteringGateway that resolves OpenRouter generation ids. The returned
 * info reverse-translates the model id back to the canonical Vercel-style
 * slug so usage events keep one id space regardless of provider.
 */
export function createOpenRouterGenerationInfo(
	options: OpenRouterGenerationInfoOptions,
): MeteringGateway {
	const fetchGeneration = options.fetch ?? defaultFetchGeneration;
	const baseUrl = options.url ?? OPENROUTER_GENERATION_URL;

	return {
		async getGenerationInfo({ id }): Promise<GatewayGenerationInfo> {
			const response = await fetchGeneration(
				`${baseUrl}?id=${encodeURIComponent(id)}`,
				{
					headers: {
						Accept: "application/json",
						Authorization: `Bearer ${options.apiKey}`,
					},
					signal: AbortSignal.timeout(GENERATION_LOOKUP_TIMEOUT_MS),
				},
			);

			if (!response.ok) {
				throw Object.assign(
					new Error(
						`OpenRouter generation ${id} lookup failed (${response.status} ${response.statusText})`,
					),
					{ statusCode: response.status },
				);
			}

			const payload = generationResponseSchema.parse(await response.json());
			const generation = payload.data;

			// A generation can briefly exist without final accounting. Surface it
			// as the retryable pending shape instead of reconciling a zero cost.
			if (generation.total_cost == null) {
				throw Object.assign(
					new Error(`OpenRouter usage event not found yet for ${id}`),
					{ statusCode: 404 },
				);
			}

			const totalCost = generation.total_cost;

			return {
				billableWebSearchCalls: generation.num_search_results ?? 0,
				cacheCreationTokens: 0,
				cachedTokens: generation.native_tokens_cached ?? 0,
				completionTokens: generation.native_tokens_completion ?? 0,
				createdAt: generation.created_at ?? new Date(0).toISOString(),
				finishReason: generation.finish_reason ?? "unknown",
				generationTime: generation.generation_time ?? 0,
				id: generation.id,
				isByok: generation.is_byok ?? false,
				latency: generation.latency ?? 0,
				model: fromOpenRouterModelId(generation.model),
				promptTokens: generation.native_tokens_prompt ?? 0,
				providerName: generation.provider_name ?? "openrouter",
				reasoningTokens: generation.native_tokens_reasoning ?? 0,
				streamed: generation.streamed ?? false,
				totalCost,
				upstreamInferenceCost: generation.upstream_inference_cost ?? 0,
				usage: generation.usage ?? totalCost,
			};
		},
	};
}

async function defaultFetchGeneration(
	url: string,
	init: { headers: Record<string, string>; signal: AbortSignal },
): ReturnType<OpenRouterGenerationFetch> {
	return fetch(url, init);
}
