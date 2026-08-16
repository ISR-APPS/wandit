import {
	completeOnboardingResponseSchema,
	onboardingRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

import type { CompleteOnboardingBody, CompleteOnboardingResponse } from "./dto";

export async function completeOnboarding(
	body: CompleteOnboardingBody,
): Promise<CompleteOnboardingResponse> {
	const data = await apiClient.post<unknown>(onboardingRoutes.complete, body);
	return completeOnboardingResponseSchema.parse(data);
}
