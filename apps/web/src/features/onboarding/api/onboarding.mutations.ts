/**
 * TanStack Query mutations of the onboarding feature.
 * Called by pages/onboarding-page.tsx. Wraps the functions of
 * api/onboarding.services.ts so the page gets `isPending` and `mutateAsync`.
 */
import { useMutation } from "@tanstack/react-query";

import type {
	CompleteOnboardingBody,
	OnboardingPhoneAvailabilityBody,
} from "./dto";
import {
	checkOnboardingPhoneAvailability,
	completeOnboardingWithDeploySkewFallback,
} from "./onboarding.services";

export function useCompleteOnboarding() {
	return useMutation({
		mutationFn: (body: CompleteOnboardingBody) =>
			completeOnboardingWithDeploySkewFallback(body),
	});
}

/** Pre-check of the phone step. A rejected request is not a "taken" answer; the page treats it as free. */
export function useCheckOnboardingPhone() {
	return useMutation({
		mutationFn: (body: OnboardingPhoneAvailabilityBody) =>
			checkOnboardingPhoneAvailability(body),
	});
}
