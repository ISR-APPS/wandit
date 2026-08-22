import { describe, expect, it, vi } from "vitest";

import { isGatewayUsagePending } from "../../metering/domain/metering";
import {
	createOpenRouterGenerationInfo,
	OPENROUTER_GENERATION_URL,
	type OpenRouterGenerationFetch,
} from "./openrouter-generation-info";

const GENERATION = {
	created_at: "2026-08-01T00:00:00.000Z",
	finish_reason: "stop",
	generation_time: 1200,
	id: "gen-abc123",
	is_byok: false,
	latency: 300,
	model: "x-ai/grok-4.5",
	native_tokens_cached: 7,
	native_tokens_completion: 40,
	native_tokens_prompt: 100,
	native_tokens_reasoning: 5,
	provider_name: "xai",
	streamed: true,
	total_cost: 0.0125,
	upstream_inference_cost: null,
	usage: 0.0125,
};

function fetchReturning(
	status: number,
	body: unknown,
): {
	calls: { init: { headers: Record<string, string> }; url: string }[];
	fetch: OpenRouterGenerationFetch;
} {
	const calls: { init: { headers: Record<string, string> }; url: string }[] =
		[];

	return {
		calls,
		fetch: vi.fn(async (url, init) => {
			calls.push({ init, url });

			return {
				json: async () => body,
				ok: status >= 200 && status < 300,
				status,
				statusText: status === 200 ? "OK" : "Error",
			};
		}),
	};
}

describe("createOpenRouterGenerationInfo", () => {
	it("maps the generation payload onto the gateway info contract", async () => {
		const { calls, fetch } = fetchReturning(200, { data: GENERATION });
		const client = createOpenRouterGenerationInfo({ apiKey: "sk-or-1", fetch });

		const info = await client.getGenerationInfo({
			id: "gen-abc123",
			source: "openrouter",
		});

		expect(calls[0]?.url).toBe(`${OPENROUTER_GENERATION_URL}?id=gen-abc123`);
		expect(calls[0]?.init.headers.Authorization).toBe("Bearer sk-or-1");
		expect(info).toEqual({
			billableWebSearchCalls: 0,
			cacheCreationTokens: 0,
			cachedTokens: 7,
			completionTokens: 40,
			createdAt: "2026-08-01T00:00:00.000Z",
			finishReason: "stop",
			generationTime: 1200,
			id: "gen-abc123",
			isByok: false,
			latency: 300,
			// Reverse-translated to the canonical Vercel-style slug.
			model: "xai/grok-4.5",
			promptTokens: 100,
			providerName: "xai",
			reasoningTokens: 5,
			streamed: true,
			totalCost: 0.0125,
			upstreamInferenceCost: 0,
			usage: 0.0125,
		});
	});

	it("treats 404 lookups as retryable pending usage", async () => {
		const { fetch } = fetchReturning(404, {});
		const client = createOpenRouterGenerationInfo({ apiKey: "sk-or-1", fetch });

		const error = await client
			.getGenerationInfo({ id: "gen-missing", source: "openrouter" })
			.then(
				() => null,
				(caught: unknown) => caught,
			);

		expect(error).toMatchObject({ statusCode: 404 });
		expect(isGatewayUsagePending(error)).toBe(true);
	});

	it("treats a generation without final cost as pending", async () => {
		const { fetch } = fetchReturning(200, {
			data: { ...GENERATION, total_cost: null },
		});
		const client = createOpenRouterGenerationInfo({ apiKey: "sk-or-1", fetch });

		const error = await client
			.getGenerationInfo({ id: "gen-abc123", source: "openrouter" })
			.then(
				() => null,
				(caught: unknown) => caught,
			);

		expect(isGatewayUsagePending(error)).toBe(true);
	});

	it("keeps contract-level failures non-retryable and 5xx retryable", async () => {
		const { fetch } = fetchReturning(500, {});
		const client = createOpenRouterGenerationInfo({ apiKey: "sk-or-1", fetch });

		const error = await client
			.getGenerationInfo({ id: "gen-abc123", source: "openrouter" })
			.then(
				() => null,
				(caught: unknown) => caught,
			);

		// A 5xx never proves the generation is unbillable — the sweep retries
		// under its bounded age budget instead of terminalizing.
		expect(error).toMatchObject({ statusCode: 500 });
		expect(isGatewayUsagePending(error)).toBe(true);

		const { fetch: unauthorized } = fetchReturning(401, {});
		const unauthorizedClient = createOpenRouterGenerationInfo({
			apiKey: "sk-or-1",
			fetch: unauthorized,
		});
		const contractError = await unauthorizedClient
			.getGenerationInfo({ id: "gen-abc123", source: "openrouter" })
			.then(
				() => null,
				(caught: unknown) => caught,
			);

		expect(contractError).toMatchObject({ statusCode: 401 });
		expect(isGatewayUsagePending(contractError)).toBe(false);
	});
});
