import enAcademy from "../dictionaries/en/academy.json";
import enAffiliates from "../dictionaries/en/affiliates.json";
import enAuth from "../dictionaries/en/auth.json";
import enBilling from "../dictionaries/en/billing.json";
import enCommon from "../dictionaries/en/common.json";
import enCredits from "../dictionaries/en/credits.json";
import enErrors from "../dictionaries/en/errors.json";
import enLanding from "../dictionaries/en/landing.json";
import enLeads from "../dictionaries/en/leads.json";
import enLegal from "../dictionaries/en/legal.json";
import enNative from "../dictionaries/en/native.json";
import enOnboarding from "../dictionaries/en/onboarding.json";
import enProjects from "../dictionaries/en/projects.json";
import enSettings from "../dictionaries/en/settings.json";
import enWorkspace from "../dictionaries/en/workspace.json";
import enWorkspaces from "../dictionaries/en/workspaces.json";
import type { Locale } from "./config";

const en = {
	academy: enAcademy,
	affiliates: enAffiliates,
	common: enCommon,
	landing: enLanding,
	auth: enAuth,
	billing: enBilling,
	projects: enProjects,
	credits: enCredits,
	workspace: enWorkspace,
	workspaces: enWorkspaces,
	leads: enLeads,
	legal: enLegal,
	settings: enSettings,
	errors: enErrors,
	native: enNative,
	onboarding: enOnboarding,
} as const;

type WidenDictionary<T> = T extends string
	? string
	: T extends readonly (infer Item)[]
		? WidenDictionary<Item>[]
		: T extends Record<string, unknown>
			? { [Key in keyof T]: WidenDictionary<T[Key]> }
			: T;

export type Dictionary = WidenDictionary<typeof en>;

export const fallbackDictionary: Dictionary = en;

type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

type IsPluralObject<T> =
	T extends Record<string, string>
		? Exclude<keyof T, PluralCategory> extends never
			? true
			: false
		: false;

type DotPath<
	T,
	Prefix extends string = "",
	Depth extends readonly unknown[] = [],
	// Keep typed keys to five segments; 6-segment leaves must use useDictionary().
> = Depth["length"] extends 6
	? never
	: T extends string
		? Prefix
		: T extends readonly unknown[]
			? never
			: T extends Record<string, unknown>
				? IsPluralObject<T> extends true
					? Prefix
					: {
							[Key in Extract<keyof T, string>]: DotPath<
								T[Key],
								Prefix extends "" ? Key : `${Prefix}.${Key}`,
								[...Depth, unknown]
							>;
						}[Extract<keyof T, string>]
				: never;

export type TranslationKey = DotPath<Dictionary>;

function normalizeDictionary(dictionary: Dictionary): Dictionary {
	return dictionary;
}

async function loadEnglishDictionary(): Promise<Dictionary> {
	return fallbackDictionary;
}

async function loadFrenchDictionary(): Promise<Dictionary> {
	const [
		academy,
		affiliates,
		common,
		landing,
		auth,
		billing,
		projects,
		credits,
		workspace,
		workspaces,
		leads,
		legal,
		settings,
		errors,
		native,
		onboarding,
	] = await Promise.all([
		import("../dictionaries/fr/academy.json"),
		import("../dictionaries/fr/affiliates.json"),
		import("../dictionaries/fr/common.json"),
		import("../dictionaries/fr/landing.json"),
		import("../dictionaries/fr/auth.json"),
		import("../dictionaries/fr/billing.json"),
		import("../dictionaries/fr/projects.json"),
		import("../dictionaries/fr/credits.json"),
		import("../dictionaries/fr/workspace.json"),
		import("../dictionaries/fr/workspaces.json"),
		import("../dictionaries/fr/leads.json"),
		import("../dictionaries/fr/legal.json"),
		import("../dictionaries/fr/settings.json"),
		import("../dictionaries/fr/errors.json"),
		import("../dictionaries/fr/native.json"),
		import("../dictionaries/fr/onboarding.json"),
	]);

	return normalizeDictionary({
		academy: academy.default,
		affiliates: affiliates.default,
		common: common.default,
		landing: landing.default,
		auth: auth.default,
		billing: billing.default,
		projects: projects.default,
		credits: credits.default,
		workspace: workspace.default,
		workspaces: workspaces.default,
		leads: leads.default,
		legal: legal.default,
		settings: settings.default,
		errors: errors.default,
		native: native.default,
		onboarding: onboarding.default,
	});
}

async function loadArabicDictionary(): Promise<Dictionary> {
	const [
		academy,
		affiliates,
		common,
		landing,
		auth,
		billing,
		projects,
		credits,
		workspace,
		workspaces,
		leads,
		legal,
		settings,
		errors,
		native,
		onboarding,
	] = await Promise.all([
		import("../dictionaries/ar/academy.json"),
		import("../dictionaries/ar/affiliates.json"),
		import("../dictionaries/ar/common.json"),
		import("../dictionaries/ar/landing.json"),
		import("../dictionaries/ar/auth.json"),
		import("../dictionaries/ar/billing.json"),
		import("../dictionaries/ar/projects.json"),
		import("../dictionaries/ar/credits.json"),
		import("../dictionaries/ar/workspace.json"),
		import("../dictionaries/ar/workspaces.json"),
		import("../dictionaries/ar/leads.json"),
		import("../dictionaries/ar/legal.json"),
		import("../dictionaries/ar/settings.json"),
		import("../dictionaries/ar/errors.json"),
		import("../dictionaries/ar/native.json"),
		import("../dictionaries/ar/onboarding.json"),
	]);

	return normalizeDictionary({
		academy: academy.default,
		affiliates: affiliates.default,
		common: common.default,
		landing: landing.default,
		auth: auth.default,
		billing: billing.default,
		projects: projects.default,
		credits: credits.default,
		workspace: workspace.default,
		workspaces: workspaces.default,
		leads: leads.default,
		legal: legal.default,
		settings: settings.default,
		errors: errors.default,
		native: native.default,
		onboarding: onboarding.default,
	});
}

const dictionaryLoaders = {
	en: loadEnglishDictionary,
	fr: loadFrenchDictionary,
	ar: loadArabicDictionary,
} as const satisfies Record<Locale, () => Promise<Dictionary>>;

export function getDictionary(locale: Locale): Promise<Dictionary> {
	return dictionaryLoaders[locale]();
}
