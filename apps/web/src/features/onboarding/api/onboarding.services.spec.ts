import type {
	CompleteOnboardingBody,
	CompleteOnboardingResponse,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";

import { completeOnboardingWithDeploySkewFallback } from "./onboarding.services";

const body = {
	answers: {
		account_type: "solo",
		ai_experience: "daily",
		ai_tools: "A chat assistant",
		name: "Ada",
		phone: "+12025550123",
		phone_country: "CA",
		role: "engineer",
		solo_profile: "freelancer",
		style: "dark",
	},
} satisfies CompleteOnboardingBody;

const response = {
	completedAt: "2026-08-31T10:00:00.000Z",
} satisfies CompleteOnboardingResponse;

function apiError(statusCode: number, code: string): ApiClientError {
	return new ApiClientError({
		code,
		message: "refused",
		path: "/api/v1/onboarding/complete",
		requestId: "req_1",
		statusCode,
		timestamp: "2026-08-31T10:00:00.000Z",
	});
}

describe("completeOnboardingWithDeploySkewFallback", () => {
	it("keeps the normal single request when the new payload succeeds", async () => {
		const request = vi.fn().mockResolvedValue(response);

		await expect(
			completeOnboardingWithDeploySkewFallback(body, request),
		).resolves.toEqual(response);
		expect(request).toHaveBeenCalledOnce();
		expect(request).toHaveBeenCalledWith(body);
	});

	it("retries one validation rejection without phone_country", async () => {
		const request = vi
			.fn()
			.mockRejectedValueOnce(apiError(400, "VALIDATION_ERROR"))
			.mockResolvedValueOnce(response);

		await expect(
			completeOnboardingWithDeploySkewFallback(body, request),
		).resolves.toEqual(response);
		expect(request).toHaveBeenCalledTimes(2);
		expect(request).toHaveBeenNthCalledWith(1, body);
		expect(request).toHaveBeenNthCalledWith(2, {
			answers: {
				account_type: "solo",
				ai_experience: "daily",
				ai_tools: "A chat assistant",
				name: "Ada",
				phone: "+12025550123",
				role: "engineer",
				solo_profile: "freelancer",
				style: "dark",
			},
		});
	});

	it.each([
		["a non-validation failure", apiError(500, "INTERNAL_ERROR")],
		["another 400 rejection", apiError(400, "AUTH_FAILURE")],
		["a non-API failure", new Error("offline")],
	])("does not retry %s", async (_description, error) => {
		const request = vi.fn().mockRejectedValue(error);

		await expect(
			completeOnboardingWithDeploySkewFallback(body, request),
		).rejects.toBe(error);
		expect(request).toHaveBeenCalledOnce();
	});

	it("does not retry a legacy payload that already omits phone_country", async () => {
		const { phone_country: _phoneCountry, ...legacyAnswers } = body.answers;
		const legacyBody = { answers: legacyAnswers };
		const error = apiError(400, "VALIDATION_ERROR");
		const request = vi.fn().mockRejectedValue(error);

		await expect(
			completeOnboardingWithDeploySkewFallback(legacyBody, request),
		).rejects.toBe(error);
		expect(request).toHaveBeenCalledOnce();
	});
});
