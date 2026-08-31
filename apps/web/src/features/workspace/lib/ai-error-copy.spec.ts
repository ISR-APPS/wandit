import type { AiErrorData } from "@wandit/contracts";
import {
	fallbackDictionary,
	type TranslationKey,
	type TranslationParams,
	translate,
} from "@wandit/internationalization";
import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import { chatErrorPresentation } from "./ai-error-copy";

const t = (key: TranslationKey, params?: TranslationParams) =>
	translate(fallbackDictionary, key, params, "en");

function failure(overrides: Partial<AiErrorData> = {}): AiErrorData {
	return {
		kind: "provider_error",
		source: "gateway",
		providerLabel: "Anthropic",
		retryable: true,
		terminal: true,
		refunded: null,
		moderationStage: null,
		providerMessage: null,
		requestId: null,
		...overrides,
	};
}

function apiError(code: string) {
	return new ApiClientError({
		code,
		details: null,
		message: "raw transport text must stay hidden",
		path: "/api/v1/chats/chat-id/ai-stream",
		requestId: "request-id",
		statusCode: 409,
		timestamp: "2026-08-30T00:00:00.000Z",
	});
}

describe("chatErrorPresentation", () => {
	it("uses the provider fallback without rendering null", () => {
		const copy = chatErrorPresentation(
			null,
			failure({ kind: "rate_limited", providerLabel: null }),
			t,
		);

		expect(copy).toMatchObject({
			kicker: "Provider issue",
			body: "The AI provider is busy. Please wait a moment and try again.",
			attribution: null,
			retryable: true,
			showRetry: true,
			showBanner: true,
		});
		expect(`${copy.kicker} ${copy.body}`).not.toContain("null");
	});

	it("selects output-stage moderation copy and attribution", () => {
		const copy = chatErrorPresentation(
			null,
			failure({
				kind: "content_moderated",
				source: "openrouter",
				providerLabel: "Google",
				retryable: false,
				moderationStage: "output",
				providerMessage: "faces",
			}),
			t,
		);

		expect(copy.body).toBe(
			"The content filter of Google stopped this generation. Change the prompt and try again.",
		);
		expect(copy.attribution).toBe(
			"The content filter of Google stopped this generation. Reason given: faces",
		);
		expect(copy.showRetry).toBe(false);
	});

	it("uses the budget sentence for our timeout", () => {
		const copy = chatErrorPresentation(
			null,
			failure({
				kind: "timeout",
				source: "ours",
				providerLabel: null,
			}),
			t,
		);

		expect(copy.body).toBe(
			"This took longer than we allow, so we stopped it. Please try again.",
		);
		expect(copy.attribution).toBeNull();
	});

	it("uses the connector refund sentence for Higgsfield", () => {
		const copy = chatErrorPresentation(
			null,
			failure({
				kind: "connector_rejected",
				source: "higgsfield",
				providerLabel: "Higgsfield",
				providerMessage: null,
				refunded: true,
			}),
			t,
		);

		expect(copy.body).toBe("Higgsfield failed without giving a reason.");
		expect(copy.attribution).toBe(
			"Higgsfield failed without giving a reason. Your Wandit credits were returned. Check your Higgsfield balance.",
		);
	});

	it.each([
		[
			"AI_CHAT_OPERATION_REPLAYED",
			"This request already ran. Send a new message to continue.",
		],
		[
			"AI_CHAT_TURN_ACTIVE",
			"A generation is already running. Wait for it to finish before sending another message.",
		],
	] as const)("keeps the %s 409 sentence", (code, expected) => {
		const copy = chatErrorPresentation(apiError(code), null, t);

		expect(copy.body).toBe(expected);
		expect(copy.body).not.toContain("raw transport text");
		expect(copy.showRetry).toBe(false);
	});
});
