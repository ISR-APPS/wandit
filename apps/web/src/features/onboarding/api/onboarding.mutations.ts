import { useMutation } from "@tanstack/react-query";

import type { CompleteOnboardingBody } from "./dto";
import { completeOnboarding } from "./onboarding.services";

export function useCompleteOnboarding() {
	return useMutation({
		mutationFn: (body: CompleteOnboardingBody) => completeOnboarding(body),
	});
}
