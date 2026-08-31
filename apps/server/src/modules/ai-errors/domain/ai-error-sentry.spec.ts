import type { AiErrorKind } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
	captureException: vi.fn(() => "event_123"),
	info: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("@wandit/observability/node", () => ({
	Sentry: {
		captureException: sentry.captureException,
		logger: { info: sentry.info, warn: sentry.warn },
	},
}));

import {
	aiCallFinished,
	captureAiError,
	toSentryCapture,
	WANDIT_CAPTURED,
} from "./ai-error-sentry";
import type { NormalizedAiError } from "./normalized-ai-error";

function normalized(
	kind: AiErrorKind,
	overrides: Partial<NormalizedAiError> = {},
): NormalizedAiError {
	return {
		gatewayGenerationId: "gen_gateway",
		kind,
		model: "anthropic/claude",
		moderationStage: null,
		openrouterGenerationId: null,
		provider: "anthropic",
		providerLabel: "Anthropic",
		providerMessage: null,
		raw: {
			cause: null,
			message: "failed",
			name: "Error",
			providerAttempts: null,
			responseBody: null,
		},
		refunded: true,
		requestId: "gen_gateway",
		retryable: false,
		sentryEventId: null,
		source: "provider:anthropic",
		statusCode: 500,
		terminal: true,
		userMessage: { key: `errors.ai.${kind}`, params: {} },
		...overrides,
	};
}

const captureContext = {
	chatId: "chat_1",
	functionId: "chat.agent",
	generationId: "attempt_1",
	projectId: "project_1",
	route: "vercel" as const,
	surface: "chat" as const,
	toolName: "generate_video",
	userId: "user_1",
};

describe("captureAiError", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each<AiErrorKind>([
		"internal",
		"unknown",
		"auth_config",
		"model_not_found",
	])("captures %s as an issue and marks the original error", (kind) => {
		const error = new Error("failure");

		expect(captureAiError(error, normalized(kind), captureContext)).toBe(
			"event_123",
		);
		expect(Reflect.get(error, WANDIT_CAPTURED)).toBe(true);
		expect(sentry.captureException).toHaveBeenCalledOnce();
		expect(sentry.warn).not.toHaveBeenCalled();
	});

	it.each<AiErrorKind>([
		"invalid_request",
		"rate_limited",
		"capacity",
		"provider_error",
		"content_moderated",
		"timeout",
		"network",
		"cancelled",
		"billing",
		"connector_unreachable",
		"connector_account",
		"connector_rejected",
	])("logs %s without creating an issue", (kind) => {
		const error = new Error("failure");

		expect(captureAiError(error, normalized(kind), captureContext)).toBeNull();
		expect(Reflect.get(error, WANDIT_CAPTURED)).toBe(true);
		expect(sentry.captureException).not.toHaveBeenCalled();
		expect(sentry.warn).toHaveBeenCalledWith(
			"ai.call.failed",
			expect.objectContaining({
				chatId: "chat_1",
				errorKind: kind,
				errorSource: "provider:anthropic",
				kind,
				source: "provider:anthropic",
			}),
		);
	});

	it("returns tagged, fingerprinted, redacted issue context", () => {
		const responseBody = `https://private.example/path owner@example.com Bearer secret-token ${"safe detail ".repeat(500)}\n    at node_modules/pkg/file.js`;
		const value = normalized("internal", {
			raw: {
				cause: {
					detail: "safe detail ".repeat(500),
					endpoint: "https://private.example/cause",
					token: "Bearer cause-secret",
				},
				message:
					"failed at https://private.example/message with Bearer message-secret",
				name: "Error",
				providerAttempts: [
					{
						error:
							"Provider failed at https://private.example owner@example.com Bearer secret-token",
						provider: "anthropic",
					},
				],
				responseBody,
			},
		});

		const capture = toSentryCapture(value, captureContext);
		expect(capture).toMatchObject({
			fingerprint: ["ai-error", "internal", "provider:anthropic", "anthropic"],
			level: "error",
			tags: {
				chatId: "chat_1",
				errorKind: "internal",
				errorSource: "provider:anthropic",
				functionId: "chat.agent",
				gatewayGenerationId: "gen_gateway",
				generationId: "attempt_1",
				model: "anthropic/claude",
				projectId: "project_1",
				provider: "anthropic",
				route: "vercel",
				statusCode: 500,
				surface: "chat",
				toolName: "generate_video",
				userId: "user_1",
			},
		});

		const redactedBody = capture.contexts.ai_error.responseBody as string;
		const attempts = capture.contexts.ai_error.providerAttempts as Array<{
			error: string;
		}>;
		const raw = capture.contexts.ai_error.raw as {
			cause: string;
			message: string;
			name: string;
		};
		expect(redactedBody.length).toBeLessThanOrEqual(4096);
		expect(redactedBody).not.toMatch(
			/private\.example|owner@example|secret-token/u,
		);
		expect(attempts[0]?.error).not.toMatch(
			/private\.example|owner@example|secret-token/u,
		);
		expect(raw).toMatchObject({ name: "Error" });
		expect(raw.cause.length).toBeLessThanOrEqual(4096);
		expect(raw.cause).not.toMatch(/private\.example|cause-secret/u);
		expect(raw.message).not.toMatch(/private\.example|message-secret/u);
	});

	it("adds a redacted capped stream cause to the failed-call log", () => {
		const error = {
			code: 502,
			message: "upstream failed",
			privateUrl: "https://private.example/input",
			secret: "Bearer stream-secret",
			shape: "stream field ".repeat(500),
		};
		const value = normalized("provider_error", {
			raw: {
				cause: error,
				message: "upstream failed",
				name: null,
				providerAttempts: null,
				responseBody: null,
			},
		});

		captureAiError(error, value, captureContext);

		expect(sentry.warn).toHaveBeenCalledWith(
			"ai.call.failed",
			expect.objectContaining({ rawCause: expect.any(String) }),
		);
		const attributes = sentry.warn.mock.calls[0]?.[1] as {
			rawCause: string;
		};
		expect(attributes.rawCause.length).toBeLessThanOrEqual(4096);
		expect(attributes.rawCause).not.toMatch(/private\.example|stream-secret/u);
	});

	it("writes the finished-call structured log", () => {
		aiCallFinished({
			durationMs: 125,
			finishReason: "stop",
			functionId: "chat.agent",
			model: "anthropic/claude",
			provider: "anthropic",
			rawFinishReason: null,
			tokens: 42,
		});

		expect(sentry.info).toHaveBeenCalledWith("ai.call.finished", {
			durationMs: 125,
			finishReason: "stop",
			functionId: "chat.agent",
			model: "anthropic/claude",
			provider: "anthropic",
			tokens: 42,
		});
	});
});
