import { completeOnboardingBodySchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const soloAnswers = {
	account_type: "solo",
	ai_experience: "daily",
	ai_tools: "A chat assistant",
	name: "Ada Lovelace",
	phone: "+12025550123",
	role: "engineer",
	solo_profile: "freelancer",
	style: "dark",
} as const;

describe("onboarding phone country contract", () => {
	it("keeps phone_country optional for existing v3 clients", () => {
		expect(
			completeOnboardingBodySchema.safeParse({ answers: soloAnswers }).success,
		).toBe(true);
	});

	it("accepts a shared-dial picker ISO that matches the phone", () => {
		const result = completeOnboardingBodySchema.parse({
			answers: { ...soloAnswers, phone_country: "CA" },
		});

		expect(result.answers.phone_country).toBe("CA");
	});

	it("rejects picker metadata whose dial does not match the phone", () => {
		expect(
			completeOnboardingBodySchema.safeParse({
				answers: {
					...soloAnswers,
					phone: "+213661223344",
					phone_country: "FR",
				},
			}).success,
		).toBe(false);
	});

	it.each(["ca", "XX", "USA"])("rejects invalid picker ISO %s", (iso) => {
		expect(
			completeOnboardingBodySchema.safeParse({
				answers: { ...soloAnswers, phone_country: iso },
			}).success,
		).toBe(false);
	});

	it("remains strict for unrelated answer keys", () => {
		expect(
			completeOnboardingBodySchema.safeParse({
				answers: { ...soloAnswers, signup_country: "CA" },
			}).success,
		).toBe(false);
	});
});
