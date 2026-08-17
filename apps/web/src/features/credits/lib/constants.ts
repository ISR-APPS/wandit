import { CREDIT_COSTS as CONTRACT_CREDIT_COSTS } from "@wandit/contracts";

import {
	getCurrentDictionary,
	getCurrentLocale,
	type TranslationKey,
	translate,
} from "@/lib/i18n";
import { formatCreditAmount } from "./format-credits";

// Decimal display credits straight from the contracts price card (video 20,
// page 10). chatMessage is an anchor only — chat settles fractional cost.
export const CREDIT_COSTS = {
	generation: CONTRACT_CREDIT_COSTS.landingPageGeneration,
	chatMessage: CONTRACT_CREDIT_COSTS.chatMessage,
	videoGeneration: CONTRACT_CREDIT_COSTS.videoGeneration,
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
		{
			action: label,
			count,
			countDisplay: formatCreditAmount(count, locale),
		},
		locale,
	);
}
