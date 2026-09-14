import { describe, expect, it } from "vitest";

import {
	type LlmProxyEnv,
	normalizeInboundModelId,
	upstreamFor,
} from "./llm-upstream";

const env: LlmProxyEnv = {
	AI_GATEWAY_API_KEY: "gateway-key",
	ANTHROPIC_API_KEY: "anthropic-key",
	OPENROUTER_API_KEY: "openrouter-key",
};

describe("upstreamFor", () => {
	it("uses ANTHROPIC_API_KEY and x-api-key for an anthropic/ model", () => {
		const result = upstreamFor("anthropic/claude-sonnet-5", env);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.upstream.baseUrl).toBe("https://api.anthropic.com");
			expect(result.upstream.apiKey).toBe("anthropic-key");
			expect(result.upstream.authStyle).toBe("x-api-key");
			expect(result.upstream.provider).toBe("anthropic");
			// api.anthropic.com wants the bare model name.
			expect(result.upstream.upstreamModelId).toBe("claude-sonnet-5");
		}
	});

	it("treats a bare model id as Anthropic", () => {
		const result = upstreamFor("claude-sonnet-5", env);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.upstream.apiKey).toBe("anthropic-key");
			expect(result.upstream.authStyle).toBe("x-api-key");
			expect(result.upstream.upstreamModelId).toBe("claude-sonnet-5");
		}
	});

	it("uses AI_GATEWAY_API_KEY and Bearer when the upstream host is the Vercel gateway", () => {
		const gatewayEnv: LlmProxyEnv = {
			...env,
			V2_LLM_UPSTREAM_BASE_URL: "https://ai-gateway.vercel.sh",
		};

		const result = upstreamFor("anthropic/claude-sonnet-5", gatewayEnv);

		expect(result.ok).toBe(true);
		if (result.ok) {
			// The gateway key wins even for an anthropic/ model id.
			expect(result.upstream.apiKey).toBe("gateway-key");
			expect(result.upstream.authStyle).toBe("bearer");
			// The gateway keeps the prefixed id.
			expect(result.upstream.upstreamModelId).toBe("anthropic/claude-sonnet-5");
		}
	});

	it("uses OPENROUTER_API_KEY and Bearer for openrouter/ model ids", () => {
		const openRouterEnv: LlmProxyEnv = {
			...env,
			V2_LLM_UPSTREAM_BASE_URL: "https://openrouter.ai/api",
		};

		const result = upstreamFor("openrouter/qwen-x", openRouterEnv);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.upstream.apiKey).toBe("openrouter-key");
			expect(result.upstream.authStyle).toBe("bearer");
			expect(result.upstream.provider).toBe("openrouter");
		}
	});

	it("reports the missing env value when no key is set", () => {
		const result = upstreamFor("anthropic/claude-sonnet-5", {});

		expect(result).toEqual({
			ok: false,
			missingEnv: "ANTHROPIC_API_KEY",
		});
	});

	it("keeps the client's dated id for api.anthropic.com", () => {
		const result = upstreamFor(
			"anthropic/claude-haiku-4-5",
			env,
			"claude-haiku-4-5-20251001",
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.upstream.upstreamModelId).toBe("claude-haiku-4-5-20251001");
		}
	});

	it("sends the normalized id to a gateway even when the client sent a dated one", () => {
		const gatewayEnv: LlmProxyEnv = {
			...env,
			V2_LLM_UPSTREAM_BASE_URL: "https://ai-gateway.vercel.sh",
		};

		const result = upstreamFor(
			"anthropic/claude-haiku-4-5",
			gatewayEnv,
			"claude-haiku-4-5-20251001",
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.upstream.upstreamModelId).toBe(
				"anthropic/claude-haiku-4-5",
			);
		}
	});
});

describe("normalizeInboundModelId", () => {
	it.each([
		["claude-haiku-4-5-20251001", "anthropic/claude-haiku-4-5"],
		["claude-sonnet-5", "anthropic/claude-sonnet-5"],
		// A lone 8-digit tail is a release date, not a minor version.
		["claude-opus-5-20260401", "anthropic/claude-opus-5"],
		["claude-sonnet-4-5", "anthropic/claude-sonnet-4-5"],
		// Ids already in allow-list form pass through unchanged.
		["anthropic/claude-sonnet-5", "anthropic/claude-sonnet-5"],
		["gpt-5.2", "gpt-5.2"],
	])("maps %s to %s", (inbound, expected) => {
		expect(normalizeInboundModelId(inbound)).toBe(expected);
	});
});
