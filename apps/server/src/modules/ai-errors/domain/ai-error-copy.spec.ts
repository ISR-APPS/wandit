import type { AiErrorKind } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { renderAiErrorSentence } from "./ai-error-copy";
import type { NormalizedAiError } from "./normalized-ai-error";

function normalized(
	kind: AiErrorKind,
	overrides: Partial<NormalizedAiError> = {},
): NormalizedAiError {
	return {
		gatewayGenerationId: null,
		kind,
		model: null,
		moderationStage: null,
		openrouterGenerationId: null,
		provider: "anthropic",
		providerLabel: "Anthropic",
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
		source: "provider:anthropic",
		statusCode: null,
		terminal: true,
		userMessage: { key: `errors.ai.${kind}`, params: {} },
		...overrides,
	};
}

describe("renderAiErrorSentence", () => {
	it.each<[AiErrorKind, string]>([
		["internal", "Something went wrong on our side. Please try again."],
		[
			"auth_config",
			"The AI service is not available right now. Our team is notified.",
		],
		[
			"invalid_request",
			"Anthropic did not accept this request. Try a shorter prompt or a different file.",
		],
		[
			"model_not_found",
			"The AI model is not available right now. Our team is notified.",
		],
		["rate_limited", "Anthropic is busy. Please wait a moment and try again."],
		[
			"capacity",
			"Anthropic is over capacity right now. Please try again in a minute.",
		],
		["provider_error", "Anthropic returned an error. Please try again."],
		[
			"content_moderated",
			"Anthropic declined this request because of its content rules. Change the prompt and try again.",
		],
		["timeout", "Anthropic took too long to answer. Please try again."],
		["network", "We cannot reach Anthropic. Please try again."],
		["cancelled", "This generation was stopped."],
		["billing", "Not enough credits for this action."],
		[
			"connector_unreachable",
			"Anthropic is not reachable. Check the connection in Settings and try again.",
		],
		["connector_account", "Update your Anthropic account, then try again."],
		["connector_rejected", "Anthropic failed without giving a reason."],
		["unknown", "Something went wrong. Please try again."],
	])("renders %s", (kind, expected) => {
		expect(renderAiErrorSentence(normalized(kind))).toBe(expected);
	});

	it("renders the content-moderated output-stage variant", () => {
		expect(
			renderAiErrorSentence(
				normalized("content_moderated", { moderationStage: "output" }),
			),
		).toBe(
			"The content filter of Anthropic stopped this generation. Change the prompt and try again.",
		);
	});

	it("renders the budget and connector timeout variants", () => {
		expect(
			renderAiErrorSentence(
				normalized("timeout", {
					userMessage: { key: "errors.ai.timeout_budget", params: {} },
				}),
			),
		).toBe(
			"This took longer than we allow, so we stopped it. Please try again.",
		);
		expect(
			renderAiErrorSentence(
				normalized("timeout", {
					providerLabel: "Higgsfield",
					userMessage: { key: "errors.ai.timeout_connector", params: {} },
				}),
			),
		).toBe(
			"Higgsfield accepted the job but did not report a result in time. Check Higgsfield before you try again.",
		);
	});

	it("uses fixed connector text and the provider fallback", () => {
		expect(
			renderAiErrorSentence(
				normalized("connector_account", {
					providerLabel: "Higgsfield",
					providerMessage: "Your Higgsfield workspace is out of credits.",
				}),
			),
		).toBe(
			"Your Higgsfield workspace is out of credits. Update your Higgsfield account, then try again.",
		);
		expect(
			renderAiErrorSentence(
				normalized("rate_limited", {
					provider: null,
					providerLabel: null,
				}),
			),
		).toBe("The AI provider is busy. Please wait a moment and try again.");
	});

	it("renders the current workspace member billing sentence", () => {
		expect(
			renderAiErrorSentence(normalized("billing", { statusCode: 403 })),
		).toBe(
			"You have reached your monthly credit limit in this workspace. Ask a workspace owner to raise it.",
		);
	});
});
