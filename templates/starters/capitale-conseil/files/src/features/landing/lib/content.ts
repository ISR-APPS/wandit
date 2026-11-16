// The fixed lists of the Capitale Conseil page: the movements, the practices, the figures, and the partners.
// The section components read these lists and resolve each text with t().
// The texts are in src/shared/i18n/messages.ts, in the group of each section.
import type { TranslationKey } from "~/shared/i18n";

/** One numbered movement of the page. The header, the index spine, the phone menu, and the footer list them. */
export type Movement = {
	/** The id of the section element, with its "#". */
	href: string;
	/** The two-digit numeral of the index spine. */
	numeral: string;
	label: TranslationKey;
};

/** The five movements in page order. A section with `data-movement` matches each one. */
export const MOVEMENTS: readonly Movement[] = [
	{ href: "#firm", numeral: "01", label: "site.navFirm" },
	{ href: "#practices", numeral: "02", label: "site.navPractices" },
	{ href: "#figures", numeral: "03", label: "site.navFigures" },
	{ href: "#references", numeral: "04", label: "site.navReferences" },
	{ href: "#contact", numeral: "05", label: "site.navContact" },
];

/** The anchor of the contact section. The hero and the phone menu link their meeting action to it. */
export const CONTACT_HREF = "#contact";

/** A figure of the hero row: a value, its unit, and a caps label. */
export type MiniFigure = {
	value: TranslationKey;
	unit: TranslationKey;
	label: TranslationKey;
};

/** The three figures that close the hero: the people, the places, and the fee rule. The deep band shows other figures. */
export const MINI_FIGURES: readonly MiniFigure[] = [
	{ value: "hero.fig1Value", unit: "hero.fig1Unit", label: "hero.fig1Label" },
	{ value: "hero.fig2Value", unit: "hero.fig2Unit", label: "hero.fig2Label" },
	{ value: "hero.fig3Value", unit: "hero.fig3Unit", label: "hero.fig3Label" },
];

/** The id of a practice. It is also the key of its text group `practices.<id>`. */
export type PracticeId = "strategy" | "capital" | "assets" | "governance";

/** One row of the practices ledger. */
export type Practice = {
	id: PracticeId;
	/** The chips of the meta column: one or two places, counts, or amounts. */
	tags: readonly TranslationKey[];
};

/** The four practices, in the order of the ledger. Their mandate counts add up to the 37 of the figures. */
export const PRACTICES: readonly Practice[] = [
	{
		id: "strategy",
		tags: ["practices.strategy.tag1", "practices.strategy.tag2"],
	},
	{ id: "capital", tags: ["practices.capital.tag1"] },
	{ id: "assets", tags: ["practices.assets.tag1"] },
	{ id: "governance", tags: ["practices.governance.tag1"] },
];

/** The id of a pull-figure of the deep band. It is also the key of its text group `figures.<id>`. */
export type PullFigureId = "assets" | "mandates" | "renewal";

/** One counted figure of the deep band. */
export type PullFigure = {
	id: PullFigureId;
	/** The final value. The row counts from 0 to it during the scroll. */
	value: number;
	/** Digits after the decimal point. */
	decimals: 0 | 1;
	/** The sign that follows the digits at full size, for example "%", or null for none. */
	suffix: TranslationKey | null;
	/** The unit that is set small after the value, or null for a plain count. */
	unit: TranslationKey | null;
	/** True for the one figure whose base rule turns copper when the count ends. */
	isCopper: boolean;
};

/** The three pull-figures. Copper marks the last one: it is one of the two copper uses of the page. */
export const PULL_FIGURES: readonly PullFigure[] = [
	{
		id: "assets",
		value: 4.2,
		decimals: 1,
		suffix: null,
		unit: "figures.assets.unit",
		isCopper: false,
	},
	{
		id: "mandates",
		value: 37,
		decimals: 0,
		suffix: null,
		unit: "figures.mandates.unit",
		isCopper: false,
	},
	{
		id: "renewal",
		value: 94,
		decimals: 0,
		suffix: "figures.renewal.suffix",
		unit: null,
		isCopper: true,
	},
];

/** The three beats of the case study. Each id is the key of `references.<id>Title` and `references.<id>Body`. */
export const CASE_BEATS = ["context", "engagement", "outcome"] as const;

/** The three meta cells of a mandate. Each id is the key of `<group>.<id>Label` and `<group>.<id>Value`. */
export const MANDATE_FACTS = ["duration", "team", "fees"] as const;

/** The three rows of the ledger beside the client quote. */
export const QUOTE_FACTS = ["mandate", "duration", "followUp"] as const;

/** The three principles of the firm. Each id is the key of `firm.<id>Title` and `firm.<id>Body`. */
export const PRINCIPLES = ["independence", "confidentiality", "fees"] as const;

/** The id of a partner. It is also the key of the text group `partners.<id>`. */
export type PartnerId = "kessal" | "meziane" | "belhadj" | "aitOuarab";

/** The four partners, by year of partnership. */
export const PARTNER_IDS: readonly PartnerId[] = [
	"kessal",
	"meziane",
	"belhadj",
	"aitOuarab",
];

/** The id of a subject of a first meeting. It is also the key of `contact.topics.<id>`. */
export type TopicId =
	| "sale"
	| "capital"
	| "allocation"
	| "governance"
	| "other";

/** The subjects that a visitor can pick. The pick becomes the subject line of the email. */
export const TOPIC_IDS: readonly TopicId[] = [
	"sale",
	"capital",
	"allocation",
	"governance",
	"other",
];
