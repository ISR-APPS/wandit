import {
	getCurrentDictionary,
	getCurrentLocale,
	type TranslationKey,
	translate,
} from "@/lib/i18n";

export const SIGNUP_GRANT = 100;

export const CREDIT_COSTS = {
	generation: 10,
	chatMessage: 1,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

/** priceTag("generation") → "Generate — 10 credits" (in the active locale). */
export function priceTag(action: CreditAction): string {
	const count = CREDIT_COSTS[action];
	const dictionary = getCurrentDictionary();
	const locale = getCurrentLocale();
	const label = translate(
		dictionary,
		`credits.actions.${action}` as TranslationKey,
		undefined,
		locale,
	);
	return translate(
		dictionary,
		"credits.priceTag",
		{ action: label, count },
		locale,
	);
}
