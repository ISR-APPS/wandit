import {
	type CompleteOnboardingBody,
	completeOnboardingBodySchema,
	getApplicableOnboardingQuestions,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { OnboardingRepository } from "../../infrastructure/persistence/onboarding.repository";
import { OnboardingService } from "./onboarding.service";

const completedAt = new Date("2026-08-16T10:00:00.000Z");
const soloBody: CompleteOnboardingBody = {
	answers: {
		account_type: "solo",
		ai_experience: "daily",
		ai_tools: "  A chat assistant  ",
		name: "  Ada Lovelace  ",
		role: "engineer",
		solo_profile: "freelancer",
		style: "dark",
	},
};

const organizationBody: CompleteOnboardingBody = {
	answers: {
		account_type: "organization",
		ai_experience: "sometimes",
		ai_tools: "   ",
		company_size: "11_50",
		name: "  Grace Hopper  ",
		style: "light",
	},
};

function setup() {
	const onboardingRepository = {
		complete: vi.fn().mockResolvedValue(completedAt),
	};
	const analytics = { capture: vi.fn() };
	const service = new OnboardingService(
		onboardingRepository as unknown as OnboardingRepository,
		analytics as unknown as AnalyticsService,
	);

	return { analytics, onboardingRepository, service };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("OnboardingService", () => {
	it("keeps the effective completion time and records normalized solo answers", async () => {
		const { analytics, onboardingRepository, service } = setup();

		const first = await service.complete("user_1", soloBody);
		const repeated = await service.complete("user_1", soloBody);

		expect(first).toEqual({ completedAt: completedAt.toISOString() });
		expect(repeated).toEqual(first);
		expect(onboardingRepository.complete).toHaveBeenCalledTimes(2);
		expect(onboardingRepository.complete).toHaveBeenNthCalledWith(1, {
			answers: {
				account_type: "solo",
				ai_experience: "daily",
				ai_tools: "A chat assistant",
				name: "Ada Lovelace",
				role: "engineer",
				solo_profile: "freelancer",
				style: "dark",
			},
			name: "Ada Lovelace",
			questionsVersion: "v2",
			userId: "user_1",
		});
		expect(analytics.capture).toHaveBeenCalledTimes(2);
		expect(analytics.capture).toHaveBeenNthCalledWith(
			1,
			"user_1",
			"onboarding_completed",
			{
				accountType: "solo",
				aiExperience: "daily",
				aiToolsProvided: true,
				questionsVersion: "v2",
				role: "engineer",
				soloProfile: "freelancer",
				style: "dark",
			},
		);
	});

	it("drops an empty optional answer and records organization analytics", async () => {
		const { analytics, onboardingRepository, service } = setup();

		await expect(service.complete("user_2", organizationBody)).resolves.toEqual(
			{ completedAt: completedAt.toISOString() },
		);

		expect(onboardingRepository.complete).toHaveBeenCalledWith({
			answers: {
				account_type: "organization",
				ai_experience: "sometimes",
				company_size: "11_50",
				name: "Grace Hopper",
				style: "light",
			},
			name: "Grace Hopper",
			questionsVersion: "v2",
			userId: "user_2",
		});
		expect(analytics.capture).toHaveBeenCalledWith(
			"user_2",
			"onboarding_completed",
			{
				accountType: "organization",
				aiExperience: "sometimes",
				aiToolsProvided: false,
				companySize: "11_50",
				questionsVersion: "v2",
				style: "light",
			},
		);
	});

	it("still succeeds when analytics capture throws", async () => {
		const { analytics, service } = setup();
		analytics.capture.mockImplementation(() => {
			throw new Error("analytics unavailable");
		});

		await expect(service.complete("user_1", soloBody)).resolves.toEqual({
			completedAt: completedAt.toISOString(),
		});
	});
});

describe("completeOnboardingBodySchema", () => {
	it("accepts each branch and removes an empty optional answer", () => {
		expect(completeOnboardingBodySchema.safeParse(soloBody).success).toBe(true);
		expect(completeOnboardingBodySchema.parse(organizationBody)).toEqual({
			answers: {
				account_type: "organization",
				ai_experience: "sometimes",
				company_size: "11_50",
				name: "Grace Hopper",
				style: "light",
			},
		});
	});

	it("requires every applicable non-optional answer from the config", () => {
		for (const body of [soloBody, organizationBody]) {
			const validBody = completeOnboardingBodySchema.parse(body);
			const requiredQuestions = getApplicableOnboardingQuestions(
				validBody.answers,
			).filter(
				(question) => !("optional" in question && question.optional === true),
			);

			for (const question of requiredQuestions) {
				const incompleteAnswers: Record<string, unknown> = {
					...validBody.answers,
				};
				delete incompleteAnswers[question.id];

				const result = completeOnboardingBodySchema.safeParse({
					answers: incompleteAnswers,
				});
				expect(result.success, question.id).toBe(false);
				if (!result.success) {
					expect(
						result.error.issues.some(
							(issue) => issue.path.at(-1) === question.id,
						),
						question.id,
					).toBe(true);
				}
			}
		}
	});

	it("rejects answers leaked from abandoned branches", () => {
		expect(
			completeOnboardingBodySchema.safeParse({
				answers: {
					...soloBody.answers,
					company_size: "11_50",
				},
			}).success,
		).toBe(false);

		expect(
			completeOnboardingBodySchema.safeParse({
				answers: {
					account_type: "organization",
					ai_experience: "never",
					ai_tools: "A chat assistant",
					company_size: "2_10",
					name: "Grace Hopper",
					style: "light",
				},
			}).success,
		).toBe(false);
	});

	it("rejects unknown answer and top-level keys", () => {
		expect(
			completeOnboardingBodySchema.safeParse({
				answers: { ...soloBody.answers, attribution: "search" },
			}).success,
		).toBe(false);
		expect(
			completeOnboardingBodySchema.safeParse({
				...soloBody,
				unexpected: true,
			}).success,
		).toBe(false);
	});
});
