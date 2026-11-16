// The season matrix of the deep band: five destinations, twelve months, three states.
// SeasonsSection renders it as a real table. Texts live in the `seasons` group of messages.ts.
import type { TranslationKey } from "~/shared/i18n";

/** 2 is the ideal month, 1 a possible month, 0 a month out of season. The agency sells no departure on 0. */
export type SeasonState = 0 | 1 | 2;

/** One row of the matrix. */
export type SeasonRow = {
	/** Stable id. Also the React key. */
	id: string;
	labelKey: TranslationKey;
	/** Twelve states, January to December. */
	months: readonly SeasonState[];
};

/** One month head: the short name from 900px, and its own initial on a phone. */
export type MonthHead = {
	/** Short name, for example "Jan". Also the React key and the abbr title. */
	nameKey: TranslationKey;
	/** One letter. Each language sets it, because a cut name can give a wrong letter. */
	initialKey: TranslationKey;
};

/** The twelve month heads, January to December. */
export const MONTHS: readonly MonthHead[] = [
	{ nameKey: "seasons.months.jan", initialKey: "seasons.monthInitials.jan" },
	{ nameKey: "seasons.months.feb", initialKey: "seasons.monthInitials.feb" },
	{ nameKey: "seasons.months.mar", initialKey: "seasons.monthInitials.mar" },
	{ nameKey: "seasons.months.apr", initialKey: "seasons.monthInitials.apr" },
	{ nameKey: "seasons.months.may", initialKey: "seasons.monthInitials.may" },
	{ nameKey: "seasons.months.jun", initialKey: "seasons.monthInitials.jun" },
	{ nameKey: "seasons.months.jul", initialKey: "seasons.monthInitials.jul" },
	{ nameKey: "seasons.months.aug", initialKey: "seasons.monthInitials.aug" },
	{ nameKey: "seasons.months.sep", initialKey: "seasons.monthInitials.sep" },
	{ nameKey: "seasons.months.oct", initialKey: "seasons.monthInitials.oct" },
	{ nameKey: "seasons.months.nov", initialKey: "seasons.monthInitials.nov" },
	{ nameKey: "seasons.months.dec", initialKey: "seasons.monthInitials.dec" },
];

/** The text of each state, for the hidden cell text and the legend. */
export const STATE_KEYS: Record<SeasonState, TranslationKey> = {
	2: "seasons.ideal",
	1: "seasons.possible",
	0: "seasons.offSeason",
};

/** Five destinations. The South closes from May to September; the coast opens in April. */
export const SEASON_ROWS: readonly SeasonRow[] = [
	{
		id: "erg",
		labelKey: "seasons.rows.erg",
		months: [2, 2, 1, 1, 0, 0, 0, 0, 0, 1, 2, 2],
	},
	{
		id: "tassili",
		labelKey: "seasons.rows.tassili",
		months: [2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2],
	},
	{
		id: "coast",
		labelKey: "seasons.rows.coast",
		months: [0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 0, 0],
	},
	{
		id: "constantine",
		labelKey: "seasons.rows.constantine",
		months: [0, 0, 1, 2, 2, 1, 0, 0, 2, 2, 1, 0],
	},
	{
		id: "souf",
		labelKey: "seasons.rows.souf",
		months: [2, 2, 2, 1, 0, 0, 0, 0, 0, 1, 2, 2],
	},
];
