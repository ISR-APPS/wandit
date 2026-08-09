import { describe, expect, it } from "vitest";

import {
	gatewayGenerationCaptureFromError,
	gatewayGenerationIdFromError,
	llmGenerationCaptureFromError,
	openrouterGenerationIdFromError,
	withGatewayAttribution,
} from "./gateway-metering";

describe("withGatewayAttribution", () => {
	it("tags the user and retains gateway routing plus provider options", () => {
		expect(
			withGatewayAttribution(
				{
					anthropic: { toolStreaming: false },
					gateway: { order: ["anthropic"] },
				},
				{ operation: "page_build", userId: "user_123" },
			),
		).toEqual({
			anthropic: { toolStreaming: false },
			gateway: {
				order: ["anthropic"],
				tags: ["op:page_build", "ws:personal"],
				user: "user_123",
			},
		});
	});
});

describe("gateway error generation metadata", () => {
	it("narrows a top-level gateway generation id into capture metadata", () => {
		const error = Object.assign(new Error("gateway failed"), {
			generationId: " generation_123 ",
		});

		expect(gatewayGenerationIdFromError(error)).toBe("generation_123");
		expect(gatewayGenerationCaptureFromError(error)).toEqual({
			providerMetadata: {
				gateway: { generationId: "generation_123" },
			},
		});
	});

	it("finds gateway evidence retained by retry and cause wrappers", () => {
		const retryError = {
			cause: { generationId: "generation_cause" },
			errors: [
				{ generationId: "generation_first" },
				{ generationId: "generation_last" },
			],
			lastError: { generationId: "generation_latest" },
		};

		expect(gatewayGenerationIdFromError(retryError)).toBe("generation_latest");
	});

	it("rejects invalid ids and terminates on cyclic error causes", () => {
		const cyclic: Record<string, unknown> = { generationId: "   " };
		cyclic.cause = cyclic;

		expect(gatewayGenerationIdFromError(cyclic)).toBeNull();
		expect(gatewayGenerationIdFromError({ generationId: 123 })).toBeNull();
		expect(gatewayGenerationCaptureFromError("gateway failed")).toBeNull();
	});
});

describe("LLM error generation metadata (provider-aware)", () => {
	it("reads the OpenRouter tag, including through retry wrappers", () => {
		const error = Object.assign(new Error("stream died"), {
			openrouterGenerationId: "gen-or-1",
		});

		expect(openrouterGenerationIdFromError(error)).toBe("gen-or-1");
		expect(
			openrouterGenerationIdFromError({
				cause: { openrouterGenerationId: "gen-or-cause" },
			}),
		).toBe("gen-or-cause");
	});

	it("never confuses the two id namespaces", () => {
		const vercelError = { generationId: "gen_vercel" };
		const openrouterError = { openrouterGenerationId: "gen-or-1" };

		expect(openrouterGenerationIdFromError(vercelError)).toBeNull();
		expect(gatewayGenerationIdFromError(openrouterError)).toBeNull();
	});

	it("captures each provider's error in its own metadata shape", () => {
		expect(llmGenerationCaptureFromError({ generationId: "gen_v" })).toEqual({
			providerMetadata: { gateway: { generationId: "gen_v" } },
		});
		expect(
			llmGenerationCaptureFromError({ openrouterGenerationId: "gen-or-1" }),
		).toEqual({
			providerMetadata: { openrouter: { generationId: "gen-or-1" } },
		});
		expect(llmGenerationCaptureFromError(new Error("no ids"))).toBeNull();
	});
});
