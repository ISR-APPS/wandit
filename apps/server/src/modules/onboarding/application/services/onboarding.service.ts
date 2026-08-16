import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	type CompleteOnboardingBody,
	type CompleteOnboardingResponse,
	onboardingQuestionsVersion,
} from "@wandit/contracts";

import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import { OnboardingRepository } from "../../infrastructure/persistence/onboarding.repository";

@Injectable()
export class OnboardingService {
	private readonly logger = new Logger(OnboardingService.name);

	constructor(
		@Inject(OnboardingRepository)
		private readonly onboardingRepository: OnboardingRepository,
		@Inject(AnalyticsService)
		private readonly analytics: AnalyticsService,
	) {}

	async complete(
		userId: string,
		body: CompleteOnboardingBody,
	): Promise<CompleteOnboardingResponse> {
		const { ai_tools: rawAiTools, ...answersWithoutAiTools } = body.answers;
		const aiTools = rawAiTools?.trim();
		const answers: CompleteOnboardingBody["answers"] = {
			...answersWithoutAiTools,
			...(aiTools ? { ai_tools: aiTools } : {}),
			name: body.answers.name.trim(),
		};
		const completedAt = await this.onboardingRepository.complete({
			answers,
			name: answers.name,
			questionsVersion: onboardingQuestionsVersion,
			userId,
		});

		try {
			this.analytics.capture(userId, "onboarding_completed", {
				questionsVersion: onboardingQuestionsVersion,
				style: answers.style,
				accountType: answers.account_type,
				...(answers.solo_profile ? { soloProfile: answers.solo_profile } : {}),
				...(answers.role ? { role: answers.role } : {}),
				...(answers.company_size ? { companySize: answers.company_size } : {}),
				aiExperience: answers.ai_experience,
				aiToolsProvided: Boolean(answers.ai_tools),
			});
		} catch (error) {
			this.logger.warn(
				`Onboarding analytics capture failed for ${userId}`,
				error,
			);
		}

		return { completedAt: completedAt.toISOString() };
	}
}
