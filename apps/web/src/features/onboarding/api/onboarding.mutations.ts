import { useMutation } from "@tanstack/react-query";

import type { CompleteOnboardingBody } from "./dto";
import { completeOnboardingWithDeploySkewFallback } from "./onboarding.services";

export function useCompleteOnboarding() {
	return useMutation({
		mutationFn: (body: CompleteOnboardingBody) =>
			completeOnboardingWithDeploySkewFallback(body),
	});
}
