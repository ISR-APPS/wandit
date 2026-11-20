/**
 * Translated text of the trophies feature. The summary card, the trophies page, and the toaster call it.
 * It reads the `trophies` dictionary, and the spend badge names of the `credits` dictionary for Fuel.
 */
import type {
	SpendBadgeId,
	TrophyDefinition,
	TrophyId,
} from "@wandit/contracts";
import { formatNumber } from "@wandit/internationalization";

import { useDictionary, useTranslation } from "@/lib/i18n";

// TROPHIES builds the id of each Fuel trophy as `spend_${badge.id}`.
const FUEL_ID_PREFIX = "spend_";

type FuelTrophyId = Extract<TrophyId, `spend_${string}`>;

function isFuelTrophyId(id: TrophyId): id is FuelTrophyId {
	return id.startsWith(FUEL_ID_PREFIX);
}

/** Text of one trophy. */
export type TrophyText = {
	name: string;
	/** What the user does to unlock it, with the target in the locale digits. */
	rule: string;
	/** Riddle of a hidden trophy. Null for a trophy that is not hidden. */
	riddle: string | null;
};

/** Returns a function that gives the name, the rule, and the riddle of a trophy in the active locale. */
export function useTrophyText() {
	const { locale, t } = useTranslation();
	const dictionary = useDictionary();
	const riddles: Partial<Record<TrophyId, string>> =
		dictionary.trophies.riddles;

	return (definition: TrophyDefinition): TrophyText => {
		const target = formatNumber(definition.target, locale);
		const riddle = riddles[definition.id] ?? null;
		const { id } = definition;
		if (isFuelTrophyId(id)) {
			// The Fuel trophies keep the names of the spend badges, so the two never drift apart.
			// SAFETY: TROPHIES makes each Fuel id from `spend_` and one SPEND_BADGES id.
			const badgeId = id.slice(FUEL_ID_PREFIX.length) as SpendBadgeId;
			return {
				name: dictionary.credits.spendBadges.items[badgeId].name,
				rule: t("trophies.fuelRule", {
					credits: t("credits.creditUnit", {
						count: definition.target,
						countDisplay: target,
					}),
				}),
				riddle,
			};
		}
		return {
			name: t(`trophies.items.${id}.name`),
			rule: t(`trophies.items.${id}.rule`, { target }),
			riddle,
		};
	};
}
