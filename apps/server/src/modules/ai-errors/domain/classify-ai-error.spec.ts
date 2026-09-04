import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import {
	GatewayError,
	GatewayInternalServerError,
	GatewayInvalidRequestError,
	GatewayModelNotFoundError,
	GatewayRateLimitError,
	GatewayResponseError,
} from "@ai-sdk/gateway";
import { HttpException } from "@nestjs/common";
import {
	AISDKError,
	APICallError,
	InvalidToolInputError,
	NoImageGeneratedError,
	NoObjectGeneratedError,
	NoSuchModelError,
	NoSuchProviderError,
	RetryError,
} from "ai";
import { describe, expect, it } from "vitest";
import { TaggedBuildError } from "../../pages/domain/build-failure";
import {
	classifyAiError,
	classifyFinish,
	classifyMcpResult,
	toClientAiError,
} from "./classify-ai-error";
import type { AiErrorContext } from "./normalized-ai-error";

const require = createRequire(import.meta.url);

function context(overrides: Partial<AiErrorContext> = {}): AiErrorContext {
	return { route: "vercel", surface: "chat", ...overrides };
}

function apiError(
	overrides: Partial<ConstructorParameters<typeof APICallError>[0]> = {},
): APICallError {
	return new APICallError({
		message: "Provider request failed",
		requestBodyValues: {},
		url: "https://api.openai.com/v1/responses",
		...overrides,
	});
}

function mcpError(name: "MCPClientError" | "MCPClientOAuthError"): AISDKError {
	const error = new AISDKError({ message: "Connector failed", name });
	Reflect.set(error, Symbol.for(`vercel.ai.error.AI_${name}`), true);
	return error;
}

class GatewayTimeoutFixture extends GatewayError {
	readonly name = "GatewayTimeoutError";
	readonly type = "timeout_error";

	constructor(statusCode = 408) {
		super({ message: "Gateway timed out", statusCode });
	}
}

class ProviderJobFailedError extends Error {
	constructor(
		message: string,
		readonly verdict = true,
	) {
		super(message);
	}
}

describe("classifyAiError worked examples", () => {
	it("classifies a retried gateway 429 and keeps the generation id", () => {
		const lastError = new GatewayRateLimitError({ generationId: "gen_rate" });
		const error = new RetryError({
			errors: [new GatewayRateLimitError(), lastError],
			message: "Failed after retries",
			reason: "maxRetriesExceeded",
		});

		expect(classifyAiError(error, context())).toMatchObject({
			gatewayGenerationId: "gen_rate",
			kind: "rate_limited",
			provider: null,
			requestId: "gen_rate",
			retryable: true,
			source: "gateway",
		});
	});

	it("classifies an Anthropic 529 before the gateway class", () => {
		const error = new GatewayInternalServerError({
			generationId: "gen_capacity",
			statusCode: 529,
		});
		const providerMetadata = {
			gateway: {
				routing: {
					modelAttempts: [
						{
							providerAttempts: [
								{
									error: "Overloaded",
									provider: "anthropic",
									statusCode: 529,
									success: false,
								},
								{ provider: "bedrock", statusCode: 503 },
							],
						},
					],
				},
			},
		};

		expect(classifyAiError(error, context({ providerMetadata }))).toMatchObject(
			{
				kind: "capacity",
				provider: "anthropic",
				providerLabel: "Anthropic",
				retryable: true,
				source: "provider:anthropic",
			},
		);
	});

	it("classifies a gateway error part after the first token", () => {
		const error = { message: "upstream failed", type: "error" };

		expect(classifyAiError(error, context())).toMatchObject({
			kind: "provider_error",
			raw: { cause: error },
			source: "gateway",
		});
	});

	it("classifies a dropped gateway socket from the wrapped cause", () => {
		const cause = new TypeError("fetch failed");
		const error = new GatewayResponseError({
			cause,
			message: "Invalid error response format: Gateway request failed",
			response: {},
			statusCode: 500,
		});

		expect(classifyAiError(error, context())).toMatchObject({
			kind: "network",
			retryable: true,
			source: "gateway",
		});
	});

	it("classifies both gateway authentication wrapper shapes", () => {
		const development = new Error("Gateway auth failed");
		development.name = "GatewayAuthenticationError";
		const production = new AISDKError({
			message: "Unauthenticated. Configure AI_GATEWAY_API_KEY to continue.",
			name: "GatewayError",
		});

		for (const error of [development, production]) {
			expect(classifyAiError(error, context())).toMatchObject({
				kind: "auth_config",
				retryable: false,
				source: "gateway",
			});
		}
	});

	it("classifies an OpenRouter stream-start refusal without forwarding flagged_input", () => {
		const error = apiError({
			data: {
				error: {
					code: 403,
					message: "Policy refusal",
					metadata: {
						flagged_input: "the private prompt",
						provider_name: "Anthropic",
						reasons: ["sexual", "unknown-secret-category"],
					},
				},
			},
			responseBody: "contains the private prompt",
			statusCode: 403,
			url: "https://openrouter.ai/api/v1/chat/completions",
		});

		const classified = classifyAiError(error, context({ route: "openrouter" }));
		expect(classified).toMatchObject({
			kind: "content_moderated",
			moderationStage: "input",
			provider: "anthropic",
			providerLabel: "Anthropic",
			providerMessage: "sexual content",
			source: "openrouter",
		});
		expect(classified?.providerMessage).not.toContain("private prompt");
	});

	it("classifies an OpenRouter mid-stream 502 object", () => {
		const error = {
			code: 502,
			message: "upstream failed",
			metadata: {
				error_type: "provider_error",
				provider_code: "500",
			},
		};

		expect(
			classifyAiError(error, context({ route: "openrouter" })),
		).toMatchObject({
			kind: "provider_error",
			source: "openrouter",
			statusCode: 502,
		});
	});

	it("classifies an OpenAI image moderation cause through the gateway", () => {
		const cause = apiError({
			data: {
				error: {
					code: "moderation_blocked",
					moderation_details: {
						categories: ["violence"],
						moderation_stage: "input",
					},
				},
			},
			statusCode: 400,
		});
		const error = new GatewayInvalidRequestError({
			cause,
			generationId: "gen_image",
		});

		expect(
			classifyAiError(
				error,
				context({
					model: "openai/gpt-image-2",
					refunded: true,
					surface: "image",
				}),
			),
		).toMatchObject({
			kind: "content_moderated",
			moderationStage: "input",
			provider: "openai",
			providerMessage: "violence",
			refunded: true,
			retryable: false,
			source: "provider:openai",
		});
	});

	it("classifies a Gemini image result with no image file", () => {
		expect(
			classifyFinish(
				context({
					finishReason: "other",
					model: "google/gemini-3-pro-image",
					outputFiles: [],
					rawFinishReason: "IMAGE_SAFETY",
					surface: "image",
				}),
			),
		).toMatchObject({
			kind: "content_moderated",
			moderationStage: "output",
			provider: "google",
			providerMessage: null,
			userMessage: { key: "errors.ai.content_moderated_output" },
		});
	});

	it("does not apply unrelated provider-looking text as a signature", () => {
		const numericLookingOpenAiCause = apiError({
			data: {
				error: {
					code: 1001,
					message: "OpenAI rejected reference 1001",
				},
			},
			statusCode: 400,
		});
		const capacityLookingOpenAiCause = apiError({
			data: {
				error: {
					message: "ServerOverloaded",
					type: "ServerOverloaded",
				},
			},
			statusCode: 400,
		});

		for (const cause of [
			numericLookingOpenAiCause,
			capacityLookingOpenAiCause,
		]) {
			expect(
				classifyAiError(
					new GatewayInvalidRequestError({ cause }),
					context({ model: "openai/gpt-image-2", surface: "image" }),
				),
			).toMatchObject({
				kind: "invalid_request",
				provider: "openai",
				retryable: false,
			});
		}
	});

	it("classifies a Higgsfield submit validation result", () => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});
		const validation = {
			content: [
				{
					text: 'validation error (422): {"error_type":"clipify_duration_unavailable","request_id":"req_private"}',
					type: "text",
				},
			],
			isError: true,
		};
		expect(classifyMcpResult(validation, connectorContext)).toMatchObject({
			kind: "connector_rejected",
			providerMessage:
				"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.",
			requestId: "req_private",
			retryable: false,
		});
	});

	it("classifies a Higgsfield out-of-credits result", () => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});
		expect(
			classifyMcpResult(
				{ content: [{ text: "Out of credits", type: "text" }], isError: true },
				connectorContext,
			),
		).toMatchObject({
			kind: "connector_account",
			providerMessage: "Your Higgsfield workspace is out of credits.",
			retryable: false,
		});
	});

	it("classifies a Higgsfield nsfw state", () => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});
		expect(
			classifyMcpResult({ state: "nsfw" }, connectorContext),
		).toMatchObject({
			kind: "content_moderated",
			moderationStage: null,
			providerMessage: "Input or output was rejected by content moderation.",
			retryable: false,
		});
	});

	it("classifies a Higgsfield failed state without text", () => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});
		expect(
			classifyMcpResult({ state: "failed" }, connectorContext),
		).toMatchObject({
			kind: "connector_rejected",
			providerMessage: null,
			retryable: true,
		});
	});

	it("classifies a Higgsfield failed state with a JSON status blob", () => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});
		const jsonFailure = {
			content: [
				{
					text: JSON.stringify({
						image_url: "https://private.example/image.png",
						prompt: "private prompt",
						request_id: "req_private",
						state: "failed",
					}),
					type: "text",
				},
			],
			isError: true,
		};
		expect(classifyMcpResult(jsonFailure, connectorContext)).toMatchObject({
			kind: "connector_rejected",
			providerMessage: null,
		});
	});

	it.each([
		"please moderate the lighting",
		"show a cancelled subscription banner",
		"explain the plan question",
		"say timed out waiting for the provider",
	])("does not classify prompt text from a JSON status blob: %s", (prompt) => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});
		const result = {
			content: [
				{
					text: JSON.stringify({ prompt, state: "failed" }),
					type: "text",
				},
			],
			isError: true,
		};

		expect(classifyMcpResult(result, connectorContext)).toMatchObject({
			kind: "connector_rejected",
			providerMessage: null,
			retryable: true,
		});
	});

	it("uses an allowlisted JSON error field as connector evidence", () => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});
		const result = {
			content: [
				{
					text: JSON.stringify({
						prompt: "a harmless prompt",
						state: "failed",
						task_status_msg: "moderation rejected this output",
					}),
					type: "text",
				},
			],
		};

		expect(classifyMcpResult(result, connectorContext)).toMatchObject({
			kind: "content_moderated",
			providerMessage: "Input or output was rejected by content moderation.",
		});
	});

	it("classifies a Higgsfield follow deadline as a non-retryable timeout", () => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});
		expect(
			classifyMcpResult(
				"Timed out waiting for the provider to finish generating",
				{ ...connectorContext, refunded: false },
			),
		).toMatchObject({
			kind: "timeout",
			refunded: false,
			retryable: false,
			userMessage: { key: "errors.ai.timeout_connector" },
		});
	});

	it("classifies both MCP client runtime names as non-terminal notices", () => {
		for (const name of ["MCPClientError", "MCPClientOAuthError"] as const) {
			expect(
				classifyAiError(
					mcpError(name),
					context({
						connectorSlug: "higgsfield",
						route: "mcp",
						surface: "connector",
					}),
				),
			).toMatchObject({
				kind: "connector_unreachable",
				provider: "higgsfield",
				retryable: true,
				source: "higgsfield",
				terminal: false,
			});
		}
	});

	it("classifies our unmarked TypeError as internal", () => {
		expect(
			classifyAiError(
				new TypeError("Cannot read properties of undefined"),
				context({ route: "none", surface: "tool" }),
			),
		).toMatchObject({
			kind: "internal",
			retryable: true,
			source: "ours",
		});
	});
});

describe("classifyAiError detection order", () => {
	it("detects a timeout by gateway type, name, or 408 without importing a timeout class", () => {
		for (const error of [
			new GatewayTimeoutFixture(500),
			new GatewayInternalServerError({ statusCode: 408 }),
			new GatewayInternalServerError({ statusCode: 504 }),
		]) {
			expect(classifyAiError(error, context())).toMatchObject({
				kind: "timeout",
			});
		}
	});

	it("detects a TimeoutError cause before GatewayResponseError.response_error", () => {
		const error = new GatewayResponseError({
			cause: new DOMException("timed out", "TimeoutError"),
			statusCode: 500,
		});

		expect(classifyAiError(error, context())).toMatchObject({
			kind: "timeout",
			source: "gateway",
		});
	});

	it("distinguishes a 429 spend cap from an ordinary 429", () => {
		const accountCause = apiError({
			data: { error: { message: "Organization spend limit reached" } },
			statusCode: 429,
			url: "https://api.anthropic.com/v1/messages",
		});
		const accountError = new GatewayRateLimitError({ cause: accountCause });
		const plainError = new GatewayRateLimitError();

		expect(
			classifyAiError(accountError, context({ model: "anthropic/claude" })),
		).toMatchObject({ kind: "auth_config", retryable: false });
		expect(
			classifyAiError(plainError, context({ model: "anthropic/claude" })),
		).toMatchObject({ kind: "rate_limited", retryable: true });
	});

	it("checks gateway types before capacity text or stale routing attempts", () => {
		const capacityCause = apiError({
			data: { error: { message: "Capacity is temporarily unavailable" } },
			statusCode: 400,
		});
		const staleProviderMetadata = {
			gateway: {
				routing: {
					providerAttempts: [
						{
							provider: "anthropic",
							statusCode: 503,
							success: false,
						},
						{
							provider: "bedrock",
							statusCode: 200,
							success: true,
						},
					],
				},
			},
		};

		expect(
			classifyAiError(
				new GatewayInvalidRequestError({ cause: capacityCause }),
				context({
					model: "anthropic/claude",
					providerMetadata: staleProviderMetadata,
				}),
			),
		).toMatchObject({ kind: "invalid_request", retryable: false });
		expect(
			classifyAiError(
				new GatewayModelNotFoundError(),
				context({ providerMetadata: staleProviderMetadata }),
			),
		).toMatchObject({ kind: "model_not_found", retryable: false });
	});

	it("uses only failed routing attempts recorded after the last success", () => {
		const metadata = (providerAttempts: unknown[]) => ({
			gateway: { routing: { providerAttempts } },
		});
		const failedBeforeSuccess = metadata([
			{ statusCode: 503, success: false },
			{ statusCode: 200, success: true },
		]);
		const failedAfterSuccess = metadata([
			{ statusCode: 200, success: true },
			{ statusCode: 503, success: false },
		]);

		expect(
			classifyAiError(
				new GatewayInternalServerError({ statusCode: 500 }),
				context({ providerMetadata: failedBeforeSuccess }),
			),
		).toMatchObject({ kind: "provider_error" });
		expect(
			classifyAiError(
				new GatewayInternalServerError({ statusCode: 500 }),
				context({ providerMetadata: failedAfterSuccess }),
			),
		).toMatchObject({ kind: "capacity" });
	});

	it("checks NoSuchProviderError before its NoSuchModelError parent", () => {
		const provider = new NoSuchProviderError({
			availableProviders: ["openai"],
			modelId: "missing/model",
			modelType: "languageModel",
			providerId: "missing",
		});
		const model = new NoSuchModelError({
			modelId: "openai/missing",
			modelType: "languageModel",
		});

		expect(classifyAiError(provider, context())).toMatchObject({
			kind: "auth_config",
		});
		expect(classifyAiError(model, context())).toMatchObject({
			kind: "model_not_found",
		});
	});

	it("reads timeout, lease-loss, and user-cancel reasons from abortSignal", () => {
		const timeout = AbortSignal.abort(
			new DOMException("budget", "TimeoutError"),
		);
		const lease = AbortSignal.abort(
			new Error("AI chat execution lease was lost"),
		);
		const cancelled = AbortSignal.abort(
			new DOMException("closed", "AbortError"),
		);

		expect(
			classifyAiError(new Error("wrapped"), context({ abortSignal: timeout })),
		).toMatchObject({ kind: "timeout", source: "ours" });
		expect(
			classifyAiError(new Error("wrapped"), context({ abortSignal: lease })),
		).toMatchObject({ kind: "internal", source: "ours" });
		expect(
			classifyAiError(
				new Error("wrapped"),
				context({ abortSignal: cancelled }),
			),
		).toMatchObject({ kind: "cancelled", source: "ours" });
	});

	it("returns null for tool-call warning classes", () => {
		const warning = new InvalidToolInputError({
			cause: new Error("bad input"),
			toolInput: "{}",
			toolName: "generate_video",
		});
		expect(classifyAiError(warning, context())).toBeNull();
	});

	it("classifies billing HttpExceptions before provider-shaped status codes", () => {
		const insufficient = new HttpException(
			{ code: "INSUFFICIENT_CREDITS" },
			402,
		);
		const memberLimit = new HttpException(
			{ code: "MEMBER_CREDIT_LIMIT_REACHED" },
			403,
		);

		expect(classifyAiError(insufficient, context())).toMatchObject({
			kind: "billing",
			source: "ours",
			statusCode: 402,
		});
		expect(classifyAiError(memberLimit, context())).toMatchObject({
			kind: "billing",
			source: "ours",
			statusCode: 403,
		});
	});

	it("finds a provider error nested below a TaggedBuildError", () => {
		const wrapper = new Error("phase wrapper", {
			cause: new GatewayRateLimitError(),
		});
		const error = new TaggedBuildError(
			"Storage phase failed",
			"storage_failure",
			wrapper,
		);

		expect(
			classifyAiError(error, context({ surface: "page_build" })),
		).toMatchObject({ kind: "rate_limited", source: "gateway" });
	});

	it("classifies connector task errors by verdict and provider text", () => {
		const connectorContext = context({
			connectorSlug: "higgsfield",
			refunded: true,
			route: "mcp",
			surface: "connector",
		});

		expect(
			classifyAiError(
				new ProviderJobFailedError(
					"Higgsfield asked which plan to use between unlimited allowance and paid credits.",
				),
				connectorContext,
			),
		).toMatchObject({ kind: "connector_account", retryable: false });
		expect(
			classifyAiError(
				new ProviderJobFailedError('The provider job ended as "canceled"'),
				connectorContext,
			),
		).toMatchObject({ kind: "cancelled", retryable: false });
		expect(
			classifyAiError(
				new ProviderJobFailedError("The provider reported a job error", false),
				{ ...connectorContext, refunded: false },
			),
		).toMatchObject({
			kind: "timeout",
			retryable: false,
			userMessage: { key: "errors.ai.timeout_connector" },
		});
	});

	it("uses GatewayError.isInstance across a duplicated installed module", async () => {
		const entry = require.resolve("@ai-sdk/gateway");
		const foreign = (await import(
			`${pathToFileURL(entry).href}?ai-error-copy=1`
		)) as typeof import("@ai-sdk/gateway");
		const error = new foreign.GatewayRateLimitError();

		expect(error instanceof GatewayRateLimitError).toBe(false);
		expect(GatewayError.isInstance(error)).toBe(true);
		expect(classifyAiError(error, context())).toMatchObject({
			kind: "rate_limited",
		});
	});

	it("recurses through NoImageGeneratedError and handles NoObjectGeneratedError", () => {
		const image = new NoImageGeneratedError({
			cause: apiError({ statusCode: 503 }),
		});
		const object = new NoObjectGeneratedError({
			finishReason: "content-filter",
			response: { id: "res", modelId: "model", timestamp: new Date() },
			usage: {
				inputTokenDetails: {
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					noCacheTokens: 0,
				},
				inputTokens: 0,
				outputTokenDetails: { reasoningTokens: 0, textTokens: 0 },
				outputTokens: 0,
				totalTokens: 0,
			},
		});

		expect(classifyAiError(image, context({ surface: "image" }))).toMatchObject(
			{
				kind: "capacity",
			},
		);
		expect(classifyAiError(object, context())).toMatchObject({
			kind: "content_moderated",
		});
	});
});

describe("classifyFinish", () => {
	it("uses output text to choose the content-filter stage", () => {
		expect(
			classifyFinish(
				context({ finishReason: "content-filter", outputText: "" }),
			),
		).toMatchObject({ moderationStage: "input" });
		expect(
			classifyFinish(
				context({
					finishReason: "content-filter",
					outputText: "partial answer",
				}),
			),
		).toMatchObject({ moderationStage: "output" });
	});

	it("maps a missing image to moderation only for the raw safety set", () => {
		expect(
			classifyFinish(
				context({
					finishReason: "other",
					outputFiles: [],
					rawFinishReason: "PROHIBITED_CONTENT",
					surface: "image",
				}),
			),
		).toMatchObject({ kind: "content_moderated" });
		expect(
			classifyFinish(
				context({
					finishReason: "other",
					outputFiles: [],
					rawFinishReason: "unknown",
					surface: "image",
				}),
			),
		).toMatchObject({ kind: "provider_error" });
	});

	it("leaves a length finish alone", () => {
		expect(classifyFinish(context({ finishReason: "length" }))).toBeNull();
	});
});

describe("classifyMcpResult", () => {
	it("maps all explicit terminal connector states", () => {
		const ctx = context({
			connectorSlug: "higgsfield",
			refunded: false,
			route: "mcp",
			surface: "connector",
		});

		expect(classifyMcpResult({ state: "canceled" }, ctx)).toMatchObject({
			kind: "cancelled",
		});
		expect(
			classifyMcpResult({ cannotFollow: true, state: "processing" }, ctx),
		).toMatchObject({ kind: "timeout", retryable: false });
		expect(
			classifyMcpResult({ consecutiveStatusErrors: 12 }, ctx),
		).toMatchObject({ kind: "timeout", retryable: false });
		expect(
			classifyMcpResult({ deadline: true, state: "processing" }, ctx),
		).toMatchObject({ kind: "timeout", retryable: false });
	});

	it("only retries unknown failures after an explicit refund", () => {
		const result = {
			content: [{ text: "Provider failed", type: "text" }],
			isError: true,
		};
		const ctx = context({
			connectorSlug: "higgsfield",
			route: "mcp",
			surface: "connector",
		});

		expect(
			classifyMcpResult(result, { ...ctx, refunded: false }),
		).toMatchObject({
			retryable: false,
		});
		expect(classifyMcpResult(result, { ...ctx, refunded: true })).toMatchObject(
			{
				retryable: true,
			},
		);
	});
});

describe("toClientAiError", () => {
	it("omits the model and forwards provider text only for forward-policy kinds", () => {
		const providerFailure = classifyAiError(
			new GatewayInternalServerError(),
			context({ model: "anthropic/claude" }),
		);
		expect(providerFailure).not.toBeNull();
		if (!providerFailure) return;
		providerFailure.providerMessage = "must not escape";

		const client = toClientAiError(providerFailure, "tool_1");
		expect(client).toMatchObject({
			providerMessage: null,
			toolCallId: "tool_1",
		});
		expect(client).not.toHaveProperty("model");
	});
});
