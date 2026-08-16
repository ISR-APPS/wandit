import { Body, Controller, Inject, Post } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CompleteOnboardingBody,
	type CompleteOnboardingResponse,
	completeOnboardingBodySchema,
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
}
