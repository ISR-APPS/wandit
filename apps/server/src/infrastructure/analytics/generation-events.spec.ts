import { describe, expect, it, vi } from "vitest";

import {
	captureGenerationCompleted,
	captureGenerationFailed,
	machineFailureReason,
} from "./generation-events";

describe("generation analytics events", () => {
	it("captures a completed generation with its stable generation id", () => {
		const analytics = { capture: vi.fn() };

		captureGenerationCompleted(
			analytics,
			"user_1",
			"image",
			"project_1",
			"generation_1",
		);

		expect(analytics.capture).toHaveBeenCalledWith(
			"user_1",
			"generation_completed",
			{
				generationId: "generation_1",
				kind: "image",
				projectId: "project_1",
			},
		);
	});

	it("captures a failed generation with a machine reason", () => {
		const analytics = { capture: vi.fn() };

		captureGenerationFailed(
			analytics,
			"user_1",
			"page",
			"project_1",
			"generation_1",
			"api_call_error_429",
		);

		expect(analytics.capture).toHaveBeenCalledWith(
			"user_1",
			"generation_failed",
			{
				generationId: "generation_1",
				kind: "page",
				projectId: "project_1",
				reason: "api_call_error_429",
			},
		);
	});

	it("supports user-scoped connector generations without a project", () => {
		const analytics = { capture: vi.fn() };

		captureGenerationCompleted(
			analytics,
			"user_1",
			"connector",
			null,
			"generation_1",
		);

		expect(analytics.capture).toHaveBeenCalledWith(
			"user_1",
			"generation_completed",
			{
				generationId: "generation_1",
				kind: "connector",
				projectId: null,
			},
		);
	});

	it("does not derive a failure reason from provider response text", () => {
		const error = Object.assign(new Error("raw provider response"), {
			name: "APICallError",
			status: 429,
		});

		expect(machineFailureReason(error)).toBe("api_call_error_429");
		expect(machineFailureReason("raw provider response")).toBe("unknown_error");
	});
});
