/**
 * Completes post-signup onboarding and enforces one account per phone number.
 * Called by OnboardingController. Normalizes the answers, then writes them
 * through OnboardingRepository and sends one analytics event.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	type CompleteOnboardingBody,
	type CompleteOnboardingResponse,
	type OnboardingPhoneAvailabilityBody,
	type OnboardingPhoneAvailabilityResponse,
	onboardingQuestionsVersion,
} from "@wandit/contracts";

import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import { PhoneAlreadyTakenError } from "../../domain/errors/phone-already-taken.error";
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

	/**
	 * Stores the answers and marks the user as onboarded.
	 * Throws PhoneAlreadyTakenError before any write when another user holds the phone.
	 */
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

		// Product rule: one account per phone number. A phone that another user's
		// row holds blocks this completion.
		// LIMIT: two users who submit the same phone in the same instant can both pass. Upgrade: a partial unique index on answers->>'phone' once the existing duplicate rows are merged.
		if (
			await this.onboardingRepository.isPhoneUsedByOtherUser(
				answers.phone,
				userId,
			)
		) {
			throw new PhoneAlreadyTakenError();
		}

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

	/**
	 * Tells the web app whether another account already holds this phone.
	 * The web app calls it when the user leaves the phone step. `complete`
	 * enforces the same rule, so this pre-check is a courtesy, not the guard.
	 */
	async checkPhoneAvailability(
		userId: string,
		body: OnboardingPhoneAvailabilityBody,
	): Promise<OnboardingPhoneAvailabilityResponse> {
		const taken = await this.onboardingRepository.isPhoneUsedByOtherUser(
			body.phone,
			userId,
		);

		return { available: !taken };
	}
}
