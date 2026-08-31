import type { AiErrorKind } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { AiErrorHttpException } from "./ai-error-exception";
import type { NormalizedAiError } from "./normalized-ai-error";

function normalized(kind: AiErrorKind): NormalizedAiError {
	return {
		gatewayGenerationId: null,
		kind,
		model: null,
		moderationStage: null,
		openrouterGenerationId: null,
		provider: null,
		providerLabel: null,
		providerMessage: null,
		raw: {
			cause: null,
			message: "fixture",
			name: "Error",
			providerAttempts: null,
			responseBody: null,
		},
		refunded: null,
		requestId: null,
		retryable: false,
		sentryEventId: null,
		source: "unknown",
		statusCode: null,
		terminal: true,
		userMessage: { key: `errors.ai.${kind}`, params: {} },
	};
}

describe("AiErrorHttpException", () => {
	it.each<[AiErrorKind, number]>([
		["rate_limited", 503],
		["capacity", 503],
		["timeout", 504],
		["content_moderated", 422],
		["invalid_request", 400],
		["auth_config", 500],
		["model_not_found", 500],
		["internal", 500],
		["unknown", 500],
	])("maps %s to HTTP %i", (kind, status) => {
		const value = normalized(kind);
		const error = new AiErrorHttpException(value);

		expect(error.getStatus()).toBe(status);
		expect(error.normalized).toBe(value);
		expect(error.getResponse()).toMatchObject({
			code: `AI_${kind.toUpperCase()}`,
			details: { kind },
		});
	});
});
