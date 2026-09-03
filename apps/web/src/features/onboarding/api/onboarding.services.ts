import {
	completeOnboardingResponseSchema,
	onboardingRoutes,
} from "@wandit/contracts";

import { apiClient, isApiClientError } from "@/lib/api-client";

import type { CompleteOnboardingBody, CompleteOnboardingResponse } from "./dto";

export async function completeOnboarding(
	body: CompleteOnboardingBody,
): Promise<CompleteOnboardingResponse> {
	const data = await apiClient.post<unknown>(onboardingRoutes.complete, body);
	return completeOnboardingResponseSchema.parse(data);
}

type CompleteOnboardingRequest = (
	body: CompleteOnboardingBody,
) => Promise<CompleteOnboardingResponse>;

export async function completeOnboardingWithDeploySkewFallback(
	body: CompleteOnboardingBody,
	request: CompleteOnboardingRequest = completeOnboarding,
): Promise<CompleteOnboardingResponse> {
	try {
		return await request(body);
	} catch (error) {
		if (
			body.answers.phone_country === undefined ||
			!isApiClientError(error) ||
			error.statusCode !== 400 ||
			error.code !== "VALIDATION_ERROR"
		) {
			throw error;
		}

		const { phone_country: _phoneCountry, ...legacyAnswers } = body.answers;
		// Rolling deploy skew: a new web may briefly reach an old strict server
		// whose v3 answers schema rejects the new phone_country key.
		return request({ ...body, answers: legacyAnswers });
	}
}
