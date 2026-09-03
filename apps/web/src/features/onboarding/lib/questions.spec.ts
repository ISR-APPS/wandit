import {
	getApplicableOnboardingQuestions,
	onboardingQuestions,
} from "@wandit/contracts";
import {
	fallbackDictionary,
	type TranslationKey,
	translate,
} from "@wandit/internationalization";
import { describe, expect, it } from "vitest";

import {
	getOnboardingQuestionViewConfig,
	onboardingQuestionViewConfigs,
	removeInapplicableOnboardingAnswers,
} from "./questions";

function expectDictionaryLabel(key: TranslationKey) {
	expect(translate(fallbackDictionary, key)).not.toBe(key);
}

function applicableQuestionIds(answers: Partial<Record<string, string>>) {
	return getApplicableOnboardingQuestions(answers).map(({ id }) => id);
}

describe("onboarding question view config", () => {
	it("covers every contract question and choice option", () => {
		expect(onboardingQuestionViewConfigs.map(({ id }) => id)).toEqual(
			onboardingQuestions.map(({ id }) => id),
		);

		for (const question of onboardingQuestions) {
			const config = getOnboardingQuestionViewConfig(question.id);

			expect(config.id).toBe(question.id);
			expect(config.type).toBe(question.type);
			expectDictionaryLabel(config.titleKey);

			if (question.type === "choice" && config.type === "choice") {
				expect(config.options.map(({ value }) => value)).toEqual(
					question.options,
				);

				for (const option of config.options) {
					expectDictionaryLabel(option.labelKey);
					expect(option.icon).toBeDefined();
				}
			} else if (question.type === "text" && config.type === "text") {
				expectDictionaryLabel(config.labelKey);
				expectDictionaryLabel(config.nextLabelKey);
				if (config.placeholderKey) {
					expectDictionaryLabel(config.placeholderKey);
				}
				if (config.skipLabelKey) {
					expectDictionaryLabel(config.skipLabelKey);
				}
			} else if (question.type === "phone" && config.type === "phone") {
				expectDictionaryLabel(config.labelKey);
				expectDictionaryLabel(config.nextLabelKey);
				expectDictionaryLabel(config.countryLabelKey);
				expectDictionaryLabel(config.searchPlaceholderKey);
				expectDictionaryLabel(config.emptyLabelKey);
				if (config.placeholderKey) {
					expectDictionaryLabel(config.placeholderKey);
				}
			}
		}
	});

	it("exposes renderer metadata for each step variant", () => {
		const style = getOnboardingQuestionViewConfig("style");
		const name = getOnboardingQuestionViewConfig("name");
		const phone = getOnboardingQuestionViewConfig("phone");
		const accountType = getOnboardingQuestionViewConfig("account_type");
		const soloProfile = getOnboardingQuestionViewConfig("solo_profile");
		const role = getOnboardingQuestionViewConfig("role");
		const companySize = getOnboardingQuestionViewConfig("company_size");
		const aiExperience = getOnboardingQuestionViewConfig("ai_experience");
		const aiTools = getOnboardingQuestionViewConfig("ai_tools");

		expect(style.variant).toBe("style-preview");
		expect(style.grid.desktopColumns).toBe(2);
		expect(name.labelKey).toBe("onboarding.steps.name.label");
		expect(name.nextLabelKey).toBe("onboarding.steps.name.next");
		expect(phone.labelKey).toBe("onboarding.steps.phone.label");
		expect(phone.countryLabelKey).toBe("onboarding.steps.phone.country");
		expect(phone.placeholderKey).toBe("onboarding.steps.phone.placeholder");
		expect(accountType.grid.desktopColumns).toBe(2);
		expect(soloProfile.grid.desktopColumns).toBe(4);
		expect(role.grid.desktopColumns).toBe(4);
		expect(companySize.grid.desktopColumns).toBe(4);
		expect(aiExperience.grid.desktopColumns).toBe(3);
		expect(aiTools.placeholderKey).toBe("onboarding.steps.aiTools.placeholder");
		expect(aiTools.skipLabelKey).toBe("onboarding.steps.aiTools.skip");
	});
});

describe("applicable onboarding questions", () => {
	it("selects the solo branch in contract order", () => {
		expect(
			applicableQuestionIds({
				account_type: "solo",
				ai_experience: "daily",
			}),
		).toEqual([
			"style",
			"name",
			"phone",
			"account_type",
			"solo_profile",
			"role",
			"ai_experience",
			"ai_tools",
		]);
	});

	it("selects the organization branch in contract order", () => {
		expect(
			applicableQuestionIds({
				account_type: "organization",
				ai_experience: "sometimes",
			}),
		).toEqual([
			"style",
			"name",
			"phone",
			"account_type",
			"company_size",
			"ai_experience",
			"ai_tools",
		]);
	});

	it("omits AI tools when the user has never used AI", () => {
		expect(
			applicableQuestionIds({
				account_type: "organization",
				ai_experience: "never",
			}),
		).toEqual([
			"style",
			"name",
			"phone",
			"account_type",
			"company_size",
			"ai_experience",
		]);
	});
});

describe("inapplicable onboarding answer cleanup", () => {
	it("removes answers from an abandoned solo branch", () => {
		expect(
			removeInapplicableOnboardingAnswers({
				account_type: "organization",
				ai_experience: "sometimes",
				ai_tools: "A chat assistant",
				company_size: "11_50",
				role: "engineer",
				solo_profile: "freelancer",
			}),
		).toEqual({
			account_type: "organization",
			ai_experience: "sometimes",
			ai_tools: "A chat assistant",
			company_size: "11_50",
		});
	});

	it("removes organization and AI-tool answers after both branches change", () => {
		expect(
			removeInapplicableOnboardingAnswers({
				account_type: "solo",
				ai_experience: "never",
				ai_tools: "A website builder",
				company_size: "51_200",
				role: "founder",
				solo_profile: "ecommerce_seller",
			}),
		).toEqual({
			account_type: "solo",
			ai_experience: "never",
			role: "founder",
			solo_profile: "ecommerce_seller",
		});
	});
});
