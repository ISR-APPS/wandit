// The fixed content lists of the Southpaw landing page: ids, numbers, and the keys of their texts.
// The section components read these lists and resolve each text with t().
// The texts themselves live in src/shared/i18n/messages.ts.
import type { TranslationKey } from "~/shared/i18n";

/** The id of a program on the fight card. It is also the key of its text group `card.<id>`. */
export type BoutId = "fundamentals" | "muayThai" | "sparring" | "youth";

/** The choice of the booking ticket: a program, or "unsure" when a coach picks the first class. */
export type BoutChoice = BoutId | "unsure";

/** One row of the fight card. */
export type Bout = {
	id: BoutId;
	/** The ghost number behind the row, "01" to "04". It shows from 1280px. */
	number: string;
	/** The main event gets the gold tier label. */
	isMainEvent: boolean;
};

/** The four programs in card order: main event first. */
export const BOUTS: readonly Bout[] = [
	{ id: "fundamentals", number: "01", isMainEvent: true },
	{ id: "muayThai", number: "02", isMainEvent: false },
	{ id: "sparring", number: "03", isMainEvent: false },
	{ id: "youth", number: "04", isMainEvent: false },
];

/** One article of the house code: its Roman numeral and its text keys. */
export type CodeArticle = {
	numeral: string;
	title: TranslationKey;
	body: TranslationKey;
};

/** The six articles of the house code, in wall order. */
export const CODE_ARTICLES: readonly CodeArticle[] = [
	{ numeral: "I.", title: "code.article1Title", body: "code.article1Body" },
	{ numeral: "II.", title: "code.article2Title", body: "code.article2Body" },
	{ numeral: "III.", title: "code.article3Title", body: "code.article3Body" },
	{ numeral: "IV.", title: "code.article4Title", body: "code.article4Body" },
	{ numeral: "V.", title: "code.article5Title", body: "code.article5Body" },
	{ numeral: "VI.", title: "code.article6Title", body: "code.article6Body" },
];

/** The id of a coach. It is also the key of the text group `corner.<id>`. */
export type CoachId = "okafor" | "vega" | "carter";

/** The three coaches in card order. The portrait drawing follows the id. */
export const COACH_IDS: readonly CoachId[] = ["okafor", "vega", "carter"];

/** The program family of a class. It picks the tag color and the tag text. */
export type ClassTag = "fund" | "muay" | "spar" | "youth" | "open";

/** The id of an open day. It is also the key of the text group `bill.<id>`. */
export type DayId =
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday";

/** One class of a day: its start time on a 24-hour clock and its program family. */
export type ClassSlot = {
	/** 1 to 4: the key of the class name is `bill.<day>.slot<index>`. */
	index: 1 | 2 | 3 | 4;
	time: string;
	tag: ClassTag;
};

/** One day of the weekly bill. */
export type BillDay = {
	id: DayId;
	/** Saturday opens at 08:00. The other days open at 06:00. */
	opensLate: boolean;
	slots: readonly ClassSlot[];
};

/** The six open days. Sunday is closed and has its own strip in the section. */
export const BILL_DAYS: readonly BillDay[] = [
	{
		id: "monday",
		opensLate: false,
		slots: [
			{ index: 1, time: "06:00", tag: "fund" },
			{ index: 2, time: "12:15", tag: "fund" },
			{ index: 3, time: "18:30", tag: "fund" },
			{ index: 4, time: "20:00", tag: "open" },
		],
	},
	{
		id: "tuesday",
		opensLate: false,
		slots: [
			{ index: 1, time: "06:00", tag: "open" },
			{ index: 2, time: "12:15", tag: "muay" },
			{ index: 3, time: "18:30", tag: "muay" },
			{ index: 4, time: "20:00", tag: "muay" },
		],
	},
	{
		id: "wednesday",
		opensLate: false,
		slots: [
			{ index: 1, time: "06:00", tag: "fund" },
			{ index: 2, time: "12:15", tag: "fund" },
			{ index: 3, time: "18:30", tag: "fund" },
			{ index: 4, time: "20:00", tag: "spar" },
		],
	},
	{
		id: "thursday",
		opensLate: false,
		slots: [
			{ index: 1, time: "06:00", tag: "open" },
			{ index: 2, time: "12:15", tag: "muay" },
			{ index: 3, time: "18:30", tag: "muay" },
			{ index: 4, time: "20:00", tag: "open" },
		],
	},
	{
		id: "friday",
		opensLate: false,
		slots: [
			{ index: 1, time: "06:00", tag: "fund" },
			{ index: 2, time: "18:00", tag: "spar" },
			{ index: 3, time: "19:00", tag: "spar" },
			{ index: 4, time: "21:00", tag: "spar" },
		],
	},
	{
		id: "saturday",
		opensLate: true,
		slots: [
			{ index: 1, time: "09:00", tag: "youth" },
			{ index: 2, time: "10:00", tag: "youth" },
			{ index: 3, time: "11:30", tag: "muay" },
			{ index: 4, time: "13:00", tag: "open" },
		],
	},
];

/** The tag families in legend order, each with its long legend text. class-tag-chip.tsx holds the short tag text. */
export const CLASS_TAGS: readonly { tag: ClassTag; legend: TranslationKey }[] =
	[
		{ tag: "fund", legend: "bill.legendFund" },
		{ tag: "muay", legend: "bill.legendMuay" },
		{ tag: "spar", legend: "bill.legendSpar" },
		{ tag: "youth", legend: "bill.legendYouth" },
		{ tag: "open", legend: "bill.legendOpen" },
	];

/** One phase of the twelve-week on-ramp: three weeks each. */
export type DistancePhase = {
	range: TranslationKey;
	title: TranslationKey;
	body: TranslationKey;
};

/** The four phases in week order. The last one is the gold phase. */
export const DISTANCE_PHASES: readonly DistancePhase[] = [
	{
		range: "distance.phase1Range",
		title: "distance.phase1Title",
		body: "distance.phase1Body",
	},
	{
		range: "distance.phase2Range",
		title: "distance.phase2Title",
		body: "distance.phase2Body",
	},
	{
		range: "distance.phase3Range",
		title: "distance.phase3Title",
		body: "distance.phase3Body",
	},
	{
		range: "distance.phase4Range",
		title: "distance.phase4Title",
		body: "distance.phase4Body",
	},
];

/** One figure of the distance section. It shows as prefix + value + suffix. */
export type DistanceStat = {
	/** A sign before the number: "−" for a drop, "×" for a factor, or "". */
	prefix: string;
	/** The whole number that the count-up ends on. */
	value: number;
	/** "%" for a share, or "". */
	suffix: string;
	label: TranslationKey;
	/** The last figure is gold: the twelve bells of the full program. */
	isGold: boolean;
};

/** The four results of the on-ramp, in strip order. */
export const DISTANCE_STATS: readonly DistanceStat[] = [
	{
		prefix: "−",
		value: 9,
		suffix: "",
		label: "distance.stat1Label",
		isGold: false,
	},
	{
		prefix: "×",
		value: 4,
		suffix: "",
		label: "distance.stat2Label",
		isGold: false,
	},
	{
		prefix: "−",
		value: 100,
		suffix: "%",
		label: "distance.stat3Label",
		isGold: false,
	},
	{
		prefix: "",
		value: 12,
		suffix: "",
		label: "distance.stat4Label",
		isGold: true,
	},
];

/** The id of a membership. It is also the key of the text group `belts.<id>`. */
export type BeltId = "contender" | "mainEventer" | "champion";

/** One membership card. */
export type Belt = {
	id: BeltId;
	/** The benefit lines of the card. Champion has five, the others four. */
	perks: readonly TranslationKey[];
	/** The filled button marks the plans that the club pushes. Contender gets the outline button. */
	isFilledAction: boolean;
};

/** The three memberships, from the lowest price to the champion belt. */
export const BELTS: readonly Belt[] = [
	{
		id: "contender",
		perks: [
			"belts.contender.perk1",
			"belts.contender.perk2",
			"belts.contender.perk3",
			"belts.contender.perk4",
		],
		isFilledAction: false,
	},
	{
		id: "mainEventer",
		perks: [
			"belts.mainEventer.perk1",
			"belts.mainEventer.perk2",
			"belts.mainEventer.perk3",
			"belts.mainEventer.perk4",
		],
		isFilledAction: true,
	},
	{
		id: "champion",
		perks: [
			"belts.champion.perk1",
			"belts.champion.perk2",
			"belts.champion.perk3",
			"belts.champion.perk4",
			"belts.champion.perk5",
		],
		isFilledAction: true,
	},
];

/** The anchor links of the header, the mobile menu, and the footer, in page order. */
export const NAV_LINKS: readonly { href: string; label: TranslationKey }[] = [
	{ href: "#code", label: "site.navCode" },
	{ href: "#card", label: "site.navCard" },
	{ href: "#corner", label: "site.navCorner" },
	{ href: "#schedule", label: "site.navBill" },
	{ href: "#belts", label: "site.navBelts" },
];

/** The phrases of the ticker under the poster, in loop order. */
export const TICKER_ITEMS: readonly TranslationKey[] = [
	"ticker.item1",
	"ticker.item2",
	"ticker.item3",
	"ticker.item4",
	"ticker.item5",
	"ticker.item6",
];

/** Sample contact links of the club. Both are fictional: area code 555 and exchange 010 are not in use, and .example is a reserved domain. */
export const CONTACT = {
	phoneHref: "tel:+15550100162",
	emailAddress: "hello@southpawbc.example",
} as const;
