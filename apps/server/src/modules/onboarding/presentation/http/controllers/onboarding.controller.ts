/**
 * HTTP routes under /api/v1/onboarding for the signed-in user.
 * Called by the web onboarding page. Parses each body with a zod schema from
 * packages/contracts and delegates to OnboardingService.
 */
import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CompleteOnboardingBody,
	type CompleteOnboardingResponse,
	completeOnboardingBodySchema,
	type OnboardingPhoneAvailabilityBody,
	type OnboardingPhoneAvailabilityResponse,
	onboardingPhoneAvailabilityBodySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { OnboardingService } from "../../../application/services/onboarding.service";

@Controller("v1/onboarding")
export class OnboardingController {
	constructor(
		@Inject(OnboardingService)
		private readonly onboardingService: OnboardingService,
	) {}

	@Post("complete")
	complete(
		@Body(new ZodValidationPipe(completeOnboardingBodySchema))
		body: CompleteOnboardingBody,
		@CurrentUser() user: AuthUser,
	): Promise<CompleteOnboardingResponse> {
		return this.onboardingService.complete(user.id, body);
	}

	// Security: the global AuthGuard requires a session here, like `complete`,
	// so nobody can probe phone numbers anonymously.
	@Post("phone-availability")
	// The pre-check creates nothing, so it answers 200 and not the POST default 201.
	@HttpCode(200)
	checkPhoneAvailability(
		@Body(new ZodValidationPipe(onboardingPhoneAvailabilityBodySchema))
		body: OnboardingPhoneAvailabilityBody,
		@CurrentUser() user: AuthUser,
	): Promise<OnboardingPhoneAvailabilityResponse> {
		return this.onboardingService.checkPhoneAvailability(user.id, body);
	}
}
