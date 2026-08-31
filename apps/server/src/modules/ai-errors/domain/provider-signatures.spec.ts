import { describe, expect, it } from "vitest";

import {
	classifyHiggsfieldState,
	classifyKlingCode,
	classifyOpenRouterStatus,
	classifyProviderRejection,
	classifySeedanceType,
	HIGGSFIELD_NSFW_MESSAGE,
	hasCapacitySignal,
	hasProviderAccountSignal,
	hasProviderModerationSignal,
	isOpenAiImageModerationCode,
	isRawModerationFinishReason,
	readOpenRouterModerationMetadata,
	validationMessage,
} from "./provider-signatures";

describe("provider signatures", () => {
	it("classifies the documented OpenAI image moderation codes", () => {
		for (const code of [
			"moderation_blocked",
			"content_policy_violation",
			"invalid_prompt",
		]) {
			expect(isOpenAiImageModerationCode(code), code).toBe(true);
		}

		expect(isOpenAiImageModerationCode("invalid_request")).toBe(false);
	});

	it("maps the documented Kling and Seedance signals", () => {
		expect(classifyKlingCode(1301)).toBe("content_moderated");
		expect(classifyKlingCode("1302")).toBe("rate_limited");
		expect(classifyKlingCode("Kling rejected with code 1102")).toBe(
			"auth_config",
		);
		expect(classifyKlingCode(1501)).toBe("capacity");
		expect(classifyKlingCode(1502)).toBe("timeout");
		expect(classifySeedanceType("SensitiveContentDetected")).toBe(
			"content_moderated",
		);
		expect(
			classifySeedanceType("Provider said QuotaExceeded for this call"),
		).toBe("auth_config");
		expect(classifySeedanceType("STALE_REQUEST_EXPIRED")).toBe(
			"provider_error",
		);
	});

	it("keeps OpenRouter moderation metadata away from flagged_input", () => {
		const metadata = readOpenRouterModerationMetadata({
			flagged_input: "private customer prompt",
			provider_name: "Anthropic",
			reasons: ["sexual"],
		});

		expect(metadata).toEqual({
			providerName: "Anthropic",
			reasons: ["sexual"],
		});
		expect(classifyOpenRouterStatus(403, { hasModerationReasons: true })).toBe(
			"content_moderated",
		);
		expect(classifyOpenRouterStatus(403)).toBe("auth_config");
		expect(classifyOpenRouterStatus(502)).toBe("provider_error");
	});

	it("detects only the documented account/quota signals", () => {
		expect(
			hasProviderAccountSignal("anthropic", [
				"Your organization has reached its spend limit",
			]),
		).toBe(true);
		expect(
			hasProviderAccountSignal(
				"anthropic",
				["Your organization has reached its spend limit"],
				{ hasRetryAfter: true },
			),
		).toBe(false);
		expect(
			hasProviderAccountSignal("google", [
				"RESOURCE_EXHAUSTED",
				"Project quota limit reached",
			]),
		).toBe(true);
		expect(hasProviderAccountSignal("klingai", [1102])).toBe(true);
		expect(hasProviderAccountSignal("bytedance", ["QuotaExceeded"])).toBe(true);
	});

	it("detects moderation, capacity, and raw refusal markers", () => {
		expect(hasProviderModerationSignal("klingai", ["code 1301"])).toBe(true);
		expect(
			hasProviderModerationSignal("bytedance", ["SensitiveContentDetected"]),
		).toBe(true);
		expect(hasCapacitySignal(["server busy"])).toBe(true);
		expect(hasCapacitySignal(["RESOURCE_EXHAUSTED quota"])).toBe(false);
		expect(isRawModerationFinishReason("IMAGE_SAFETY")).toBe(true);
	});
});

describe("Higgsfield signatures", () => {
	it("keeps the existing validation and account classifications", () => {
		expect(
			classifyProviderRejection(
				'Validation error (422): {"error_type":"clipify_duration_unavailable","request_id":"req-secret"}',
			),
		).toEqual({
			kind: "validation",
			userMessage:
				"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.",
		});
		expect(classifyProviderRejection("Out of credits").kind).toBe("credits");
		expect(classifyProviderRejection("Requires plus plan").kind).toBe("plan");
	});

	it("bounds and humanizes unknown validation types", () => {
		expect(validationMessage("unsupported_video_source")).toBe(
			"Higgsfield rejected the request (unsupported video source).",
		);
	});

	it("classifies terminal states", () => {
		expect(classifyHiggsfieldState("nsfw")).toBe("content_moderated");
		expect(classifyHiggsfieldState("canceled")).toBe("cancelled");
		expect(classifyHiggsfieldState("failed")).toBe("connector_rejected");
		expect(classifyHiggsfieldState("completed")).toBeNull();
		expect(HIGGSFIELD_NSFW_MESSAGE).toBe(
			"Input or output was rejected by content moderation.",
		);
	});
});
