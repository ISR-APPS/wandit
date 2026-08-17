import {
	getApplicableOnboardingQuestions,
	onboardingQuestions,
} from "@wandit/contracts";
import type { TranslationKey } from "@wandit/internationalization";
import {
	Briefcase,
	Building,
	Building2,
	CircleSlash,
	Code2,
	Landmark,
	Laptop,
	type LucideIcon,
	Megaphone,
	MessagesSquare,
	Moon,
	PanelsTopLeft,
	PenTool,
	Rocket,
	Settings2,
	Shapes,
	ShoppingBag,
	Sparkles,
	Sun,
	UserRound,
	Users,
	UsersRound,
	Zap,
} from "lucide-react";

export type OnboardingQuestion = (typeof onboardingQuestions)[number];
export type OnboardingQuestionId = OnboardingQuestion["id"];
export type OnboardingAnswerState = Partial<
	Record<OnboardingQuestionId, string>
>;
export type OnboardingChoiceQuestion = Extract<
	OnboardingQuestion,
	{ type: "choice" }
>;
export type OnboardingTextQuestion = Extract<
	OnboardingQuestion,
	{ type: "text" }
>;
export type OnboardingPhoneQuestion = Extract<
	OnboardingQuestion,
	{ type: "phone" }
>;
export type OnboardingChoiceQuestionId = OnboardingChoiceQuestion["id"];
export type OnboardingChoiceOptionValue =
	OnboardingChoiceQuestion["options"][number];

export type OnboardingChoiceOptionViewConfig<
	TValue extends string = OnboardingChoiceOptionValue,
> = {
	value: TValue;
	labelKey: TranslationKey;
	icon: LucideIcon;
};

type OnboardingChoiceOptionViewConfigs<TOptions extends readonly string[]> = {
	readonly [TIndex in keyof TOptions]: OnboardingChoiceOptionViewConfig<
		Extract<TOptions[TIndex], string>
	>;
};

export type OnboardingChoiceQuestionViewConfigFor<
	TQuestion extends OnboardingChoiceQuestion,
> = {
	id: TQuestion["id"];
	type: "choice";
	titleKey: TranslationKey;
	variant: TQuestion["id"] extends "style" ? "style-preview" : "icon-card";
	grid: {
		baseColumns: 2;
		desktopColumns: TQuestion["options"]["length"] extends 2
			? 2
			: TQuestion["options"]["length"] extends 3
				? 3
				: 4;
	};
	options: OnboardingChoiceOptionViewConfigs<TQuestion["options"]>;
};

export type OnboardingTextQuestionViewConfigFor<
	TQuestion extends OnboardingTextQuestion,
> = {
	id: TQuestion["id"];
	type: "text";
	titleKey: TranslationKey;
	labelKey: TranslationKey;
	nextLabelKey: TranslationKey;
	placeholderKey?: TranslationKey;
	skipLabelKey?: TranslationKey;
};

export type OnboardingPhoneQuestionViewConfigFor<
	TQuestion extends OnboardingPhoneQuestion,
> = {
	id: TQuestion["id"];
	type: "phone";
	titleKey: TranslationKey;
	labelKey: TranslationKey;
	nextLabelKey: TranslationKey;
	countryLabelKey: TranslationKey;
	searchPlaceholderKey: TranslationKey;
	emptyLabelKey: TranslationKey;
	placeholderKey?: TranslationKey;
};

export type OnboardingQuestionViewConfigFor<
	TQuestion extends OnboardingQuestion,
> = TQuestion extends OnboardingChoiceQuestion
	? OnboardingChoiceQuestionViewConfigFor<TQuestion>
	: TQuestion extends OnboardingTextQuestion
		? OnboardingTextQuestionViewConfigFor<TQuestion>
		: TQuestion extends OnboardingPhoneQuestion
			? OnboardingPhoneQuestionViewConfigFor<TQuestion>
			: never;

export type OnboardingQuestionViewConfigMap = {
	readonly [TQuestion in OnboardingQuestion as TQuestion["id"]]: OnboardingQuestionViewConfigFor<TQuestion>;
};

export const onboardingQuestionViewConfig = {
	style: {
		id: "style",
		type: "choice",
		titleKey: "onboarding.steps.style.title",
		variant: "style-preview",
		grid: { baseColumns: 2, desktopColumns: 2 },
		options: [
			{
				value: "light",
				labelKey: "onboarding.steps.style.options.light",
				icon: Sun,
			},
			{
				value: "dark",
				labelKey: "onboarding.steps.style.options.dark",
				icon: Moon,
			},
		],
	},
	name: {
		id: "name",
		type: "text",
		titleKey: "onboarding.steps.name.title",
		labelKey: "onboarding.steps.name.label",
		nextLabelKey: "onboarding.steps.name.next",
	},
	phone: {
		id: "phone",
		type: "phone",
		titleKey: "onboarding.steps.phone.title",
		labelKey: "onboarding.steps.phone.label",
		nextLabelKey: "onboarding.steps.phone.next",
		countryLabelKey: "onboarding.steps.phone.country",
		searchPlaceholderKey: "onboarding.steps.phone.searchPlaceholder",
		emptyLabelKey: "onboarding.steps.phone.noResults",
		placeholderKey: "onboarding.steps.phone.placeholder",
	},
	account_type: {
		id: "account_type",
		type: "choice",
		titleKey: "onboarding.steps.accountType.title",
		variant: "icon-card",
		grid: { baseColumns: 2, desktopColumns: 2 },
		options: [
			{
				value: "solo",
				labelKey: "onboarding.steps.accountType.options.solo",
				icon: UserRound,
			},
			{
				value: "organization",
				labelKey: "onboarding.steps.accountType.options.organization",
				icon: Users,
			},
		],
	},
	solo_profile: {
		id: "solo_profile",
		type: "choice",
		titleKey: "onboarding.steps.soloProfile.title",
		variant: "icon-card",
		grid: { baseColumns: 2, desktopColumns: 4 },
		options: [
			{
				value: "ecommerce_seller",
				labelKey: "onboarding.steps.soloProfile.options.ecommerce_seller",
				icon: ShoppingBag,
			},
			{
				value: "agency",
				labelKey: "onboarding.steps.soloProfile.options.agency",
				icon: Briefcase,
			},
			{
				value: "freelancer",
				labelKey: "onboarding.steps.soloProfile.options.freelancer",
				icon: Laptop,
			},
			{
				value: "other",
				labelKey: "onboarding.steps.soloProfile.options.other",
				icon: Shapes,
			},
		],
	},
	role: {
		id: "role",
		type: "choice",
		titleKey: "onboarding.steps.role.title",
		variant: "icon-card",
		grid: { baseColumns: 2, desktopColumns: 4 },
		options: [
			{
				value: "founder",
				labelKey: "onboarding.steps.role.options.founder",
				icon: Rocket,
			},
			{
				value: "product",
				labelKey: "onboarding.steps.role.options.product",
				icon: PanelsTopLeft,
			},
			{
				value: "designer",
				labelKey: "onboarding.steps.role.options.designer",
				icon: PenTool,
			},
			{
				value: "engineer",
				labelKey: "onboarding.steps.role.options.engineer",
				icon: Code2,
			},
			{
				value: "consultant",
				labelKey: "onboarding.steps.role.options.consultant",
				icon: MessagesSquare,
			},
			{
				value: "marketing_sales",
				labelKey: "onboarding.steps.role.options.marketing_sales",
				icon: Megaphone,
			},
			{
				value: "operations",
				labelKey: "onboarding.steps.role.options.operations",
				icon: Settings2,
			},
			{
				value: "other",
				labelKey: "onboarding.steps.role.options.other",
				icon: Shapes,
			},
		],
	},
	company_size: {
		id: "company_size",
		type: "choice",
		titleKey: "onboarding.steps.companySize.title",
		variant: "icon-card",
		grid: { baseColumns: 2, desktopColumns: 4 },
		options: [
			{
				value: "2_10",
				labelKey: "onboarding.steps.companySize.options.2_10",
				icon: UsersRound,
			},
			{
				value: "11_50",
				labelKey: "onboarding.steps.companySize.options.11_50",
				icon: Building,
			},
			{
				value: "51_200",
				labelKey: "onboarding.steps.companySize.options.51_200",
				icon: Building2,
			},
			{
				value: "200_plus",
				labelKey: "onboarding.steps.companySize.options.200_plus",
				icon: Landmark,
			},
		],
	},
	ai_experience: {
		id: "ai_experience",
		type: "choice",
		titleKey: "onboarding.steps.aiExperience.title",
		variant: "icon-card",
		grid: { baseColumns: 2, desktopColumns: 3 },
		options: [
			{
				value: "never",
				labelKey: "onboarding.steps.aiExperience.options.never",
				icon: CircleSlash,
			},
			{
				value: "sometimes",
				labelKey: "onboarding.steps.aiExperience.options.sometimes",
				icon: Sparkles,
			},
			{
				value: "daily",
				labelKey: "onboarding.steps.aiExperience.options.daily",
				icon: Zap,
			},
		],
	},
	ai_tools: {
		id: "ai_tools",
		type: "text",
		titleKey: "onboarding.steps.aiTools.title",
		labelKey: "onboarding.steps.aiTools.label",
		placeholderKey: "onboarding.steps.aiTools.placeholder",
		nextLabelKey: "onboarding.steps.aiTools.next",
		skipLabelKey: "onboarding.steps.aiTools.skip",
	},
} as const satisfies OnboardingQuestionViewConfigMap;

const typedOnboardingQuestionViewConfig: OnboardingQuestionViewConfigMap =
	onboardingQuestionViewConfig;

export type OnboardingQuestionViewConfig =
	OnboardingQuestionViewConfigMap[OnboardingQuestionId];
export type OnboardingChoiceQuestionViewConfig = Extract<
	OnboardingQuestionViewConfig,
	{ type: "choice" }
>;
export type OnboardingTextQuestionViewConfig = Extract<
	OnboardingQuestionViewConfig,
	{ type: "text" }
>;
export type OnboardingPhoneQuestionViewConfig = Extract<
	OnboardingQuestionViewConfig,
	{ type: "phone" }
>;

export function getOnboardingQuestionViewConfig<
	TId extends OnboardingQuestionId,
>(id: TId): OnboardingQuestionViewConfigMap[TId] {
	return typedOnboardingQuestionViewConfig[id];
}

export const onboardingQuestionViewConfigs: readonly OnboardingQuestionViewConfig[] =
	onboardingQuestions.map(({ id }) => getOnboardingQuestionViewConfig(id));

export function isOnboardingChoiceQuestionViewConfig(
	config: OnboardingQuestionViewConfig,
): config is OnboardingChoiceQuestionViewConfig {
	return config.type === "choice";
}

export function isOnboardingTextQuestionViewConfig(
	config: OnboardingQuestionViewConfig,
): config is OnboardingTextQuestionViewConfig {
	return config.type === "text";
}

export function isOnboardingPhoneQuestionViewConfig(
	config: OnboardingQuestionViewConfig,
): config is OnboardingPhoneQuestionViewConfig {
	return config.type === "phone";
}

export function removeInapplicableOnboardingAnswers(
	answers: OnboardingAnswerState,
): OnboardingAnswerState {
	const nextAnswers = { ...answers };

	while (true) {
		const applicableIds = new Set(
			getApplicableOnboardingQuestions(nextAnswers).map(({ id }) => id),
		);
		const staleQuestion = onboardingQuestions.find(
			({ id }) => nextAnswers[id] !== undefined && !applicableIds.has(id),
		);

		if (!staleQuestion) return nextAnswers;
		delete nextAnswers[staleQuestion.id];
	}
}
