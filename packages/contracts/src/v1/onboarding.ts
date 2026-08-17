import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

export const onboardingQuestionsVersion = "v3";

// Practical E.164: leading +, no leading zero, 8-15 digits total. Same shape
// as the leads capture and domains registrant checks — the dial code travels
// inside the answer string, so no separate country field is stored.
export const onboardingPhonePattern = /^\+[1-9][0-9]{7,14}$/;

export const onboardingStyles = ["light", "dark"] as const;
export const onboardingStyleSchema = z.enum(onboardingStyles);
export type OnboardingStyle = z.infer<typeof onboardingStyleSchema>;

export const onboardingAccountTypes = ["solo", "organization"] as const;
export const onboardingAccountTypeSchema = z.enum(onboardingAccountTypes);
export type OnboardingAccountType = z.infer<typeof onboardingAccountTypeSchema>;

export const onboardingSoloProfiles = [
	"ecommerce_seller",
	"agency",
	"freelancer",
	"other",
] as const;
export const onboardingSoloProfileSchema = z.enum(onboardingSoloProfiles);
export type OnboardingSoloProfile = z.infer<typeof onboardingSoloProfileSchema>;

export const onboardingRoles = [
	"founder",
	"product",
	"designer",
	"engineer",
	"consultant",
	"marketing_sales",
	"operations",
	"other",
] as const;
export const onboardingRoleSchema = z.enum(onboardingRoles);
export type OnboardingRole = z.infer<typeof onboardingRoleSchema>;

export const onboardingCompanySizes = [
	"2_10",
	"11_50",
	"51_200",
	"200_plus",
] as const;
export const onboardingCompanySizeSchema = z.enum(onboardingCompanySizes);
export type OnboardingCompanySize = z.infer<typeof onboardingCompanySizeSchema>;

export const onboardingAiExperiences = ["never", "sometimes", "daily"] as const;
export const onboardingAiExperienceSchema = z.enum(onboardingAiExperiences);
export type OnboardingAiExperience = z.infer<
	typeof onboardingAiExperienceSchema
>;

type OnboardingQuestionDefinition =
	| {
			id: string;
			type: "choice";
			options: readonly [string, ...string[]];
			optional?: never;
			when?: { questionId: string; in: readonly string[] };
	  }
	| {
			id: string;
			type: "text";
			maxLength: number;
			options?: never;
			optional?: boolean;
			when?: { questionId: string; in: readonly string[] };
	  }
	| {
			id: string;
			type: "phone";
			maxLength: number;
			options?: never;
			optional?: never;
			when?: { questionId: string; in: readonly string[] };
	  };

export const onboardingQuestions = [
	{ id: "style", type: "choice", options: onboardingStyles },
	{ id: "name", type: "text", maxLength: 100 },
	{ id: "phone", type: "phone", maxLength: 16 },
	{
		id: "account_type",
		type: "choice",
		options: onboardingAccountTypes,
	},
	{
		id: "solo_profile",
		type: "choice",
		options: onboardingSoloProfiles,
		when: { questionId: "account_type", in: ["solo"] },
	},
	{
		id: "role",
		type: "choice",
		options: onboardingRoles,
		when: { questionId: "account_type", in: ["solo"] },
	},
	{
		id: "company_size",
		type: "choice",
		options: onboardingCompanySizes,
		when: { questionId: "account_type", in: ["organization"] },
	},
	{
		id: "ai_experience",
		type: "choice",
		options: onboardingAiExperiences,
	},
	{
		id: "ai_tools",
		type: "text",
		maxLength: 200,
		optional: true,
		when: { questionId: "ai_experience", in: ["sometimes", "daily"] },
	},
] as const satisfies readonly OnboardingQuestionDefinition[];

export type OnboardingQuestionId = (typeof onboardingQuestions)[number]["id"];

type OnboardingQuestionCondition = {
	questionId: OnboardingQuestionId;
	in: readonly string[];
};

type OnboardingQuestionShape =
	| {
			id: OnboardingQuestionId;
			type: "choice";
			options: readonly [string, ...string[]];
			optional?: never;
			when?: OnboardingQuestionCondition;
	  }
	| {
			id: OnboardingQuestionId;
			type: "text";
			maxLength: number;
			options?: never;
			optional?: boolean;
			when?: OnboardingQuestionCondition;
	  }
	| {
			id: OnboardingQuestionId;
			type: "phone";
			maxLength: number;
			options?: never;
			optional?: never;
			when?: OnboardingQuestionCondition;
	  };

export type OnboardingQuestion = (typeof onboardingQuestions)[number] &
	OnboardingQuestionShape;

export function isOnboardingQuestionApplicable(
	question: OnboardingQuestion,
	answers: Partial<Record<string, string>>,
): boolean {
	if (!question.when) return true;

	const controllingAnswer = answers[question.when.questionId];
	return (
		controllingAnswer !== undefined &&
		question.when.in.includes(controllingAnswer)
	);
}

export function getApplicableOnboardingQuestions(
	answers: Partial<Record<string, string>>,
): OnboardingQuestion[] {
	return onboardingQuestions.filter((question) =>
		isOnboardingQuestionApplicable(question, answers),
	);
}

type OnboardingAnswerFor<TQuestion extends OnboardingQuestion> =
	TQuestion extends { type: "choice" } ? TQuestion["options"][number] : string;

type OnboardingAnswerSchemaFor<TQuestion extends OnboardingQuestion> =
	TQuestion extends { when: OnboardingQuestionCondition } | { optional: true }
		? z.ZodOptional<z.ZodType<OnboardingAnswerFor<TQuestion>>>
		: z.ZodType<OnboardingAnswerFor<TQuestion>>;

type OnboardingAnswerShape = {
	[TQuestion in OnboardingQuestion as TQuestion["id"]]: OnboardingAnswerSchemaFor<TQuestion>;
};

function createOnboardingAnswerSchema(question: OnboardingQuestion): z.ZodType {
	const schema =
		question.type === "choice"
			? z.enum(question.options)
			: question.type === "phone"
				? z
						.string()
						.trim()
						.regex(onboardingPhonePattern)
						.max(question.maxLength)
				: z
						.string()
						.trim()
						.min(question.optional ? 0 : 1)
						.max(question.maxLength);

	return question.when || question.optional ? schema.optional() : schema;
}

const completeOnboardingAnswerShape = Object.fromEntries(
	onboardingQuestions.map((question) => [
		question.id,
		createOnboardingAnswerSchema(question),
	]),
) as unknown as OnboardingAnswerShape;

function normalizeEmptyOptionalTextAnswers(value: unknown): unknown {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return value;
	}

	const answers = value as Record<string, unknown>;
	let normalizedAnswers: Record<string, unknown> | undefined;

	for (const question of onboardingQuestions) {
		if (
			question.type !== "text" ||
			!("optional" in question && question.optional)
		) {
			continue;
		}

		const answer = (normalizedAnswers ?? answers)[question.id];
		if (typeof answer !== "string") continue;

		normalizedAnswers ??= { ...answers };
		const trimmedAnswer = answer.trim();
		if (trimmedAnswer.length > 0) {
			normalizedAnswers[question.id] = trimmedAnswer;
		} else {
			delete normalizedAnswers[question.id];
		}
	}

	return normalizedAnswers ?? value;
}

const completeOnboardingAnswersSchema = z.preprocess(
	normalizeEmptyOptionalTextAnswers,
	z
		.object(completeOnboardingAnswerShape)
		.strict()
		.superRefine((answers, context) => {
			const answersByQuestion: Partial<Record<string, string>> = answers;

			for (const question of onboardingQuestions) {
				const answer = answersByQuestion[question.id];
				const hasAnswer = answer !== undefined && answer.length > 0;
				const isApplicable = isOnboardingQuestionApplicable(
					question,
					answersByQuestion,
				);
				const isOptional = "optional" in question && question.optional === true;

				if (isApplicable && !isOptional && !hasAnswer) {
					context.addIssue({
						code: "custom",
						message: "An answer is required for this question",
						path: [question.id],
					});
				}

				if (!isApplicable && hasAnswer) {
					context.addIssue({
						code: "custom",
						message: "An answer was provided for an inapplicable question",
						path: [question.id],
					});
				}
			}
		}),
);

export const completeOnboardingBodySchema = z
	.object({
		answers: completeOnboardingAnswersSchema,
	})
	.strict();

export type CompleteOnboardingBody = z.infer<
	typeof completeOnboardingBodySchema
>;

export const completeOnboardingResponseSchema = z.object({
	completedAt: isoDateTimeSchema,
});

export type CompleteOnboardingResponse = z.infer<
	typeof completeOnboardingResponseSchema
>;

export const onboardingRoutes = {
	complete: "/api/v1/onboarding/complete",
} as const;
