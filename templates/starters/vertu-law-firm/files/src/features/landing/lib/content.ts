// The lists of the home page: the sections, the house rules, the practices, the people, the fees, and the matters.
// The section files map over them. Every text is a key of src/shared/i18n/messages.ts, so a list holds no copy.
import type { TranslationKey } from "~/shared/i18n";

/** One anchor of the page. `href` is the id of the section with its "#". */
export type SiteSection = { href: string; label: TranslationKey };

/** The anchor of the consultation section. Every call to action of the page points to it. */
export const CONSULTATION_HREF = "#consultation";

/** The five sections of the header tabs, in page order. The last one is the brass tab of the call to action. */
export const SECTIONS: readonly SiteSection[] = [
	{ href: "#firm", label: "site.navFirm" },
	{ href: "#practices", label: "site.navPractices" },
	{ href: "#team", label: "site.navTeam" },
	{ href: "#fees", label: "site.navFees" },
	{ href: CONSULTATION_HREF, label: "site.navConsultation" },
];

/** One house rule. `article` is its number in the unbroken Art. 1 to Art. 7 sequence of the page. */
export type HouseRule = {
	article: number;
	title: TranslationKey;
	body: TranslationKey;
};

/** Art. 1 to Art. 4. The hero repeats Art. 1 as its teaser, and the fee note links back to it. */
export const HOUSE_RULES: readonly HouseRule[] = [
	{ article: 1, title: "firm.rule1Title", body: "firm.rule1Body" },
	{ article: 2, title: "firm.rule2Title", body: "firm.rule2Body" },
	{ article: 3, title: "firm.rule3Title", body: "firm.rule3Body" },
	{ article: 4, title: "firm.rule4Title", body: "firm.rule4Body" },
];

/** The id of a practice area. It is also the text group `practices.<id>` and the panel anchor `#practice-<id>`. */
export type PracticeId =
	| "business"
	| "property"
	| "family"
	| "employment"
	| "criminal";

/** The five folders of the drawer, in the order of the hero rail. */
export const PRACTICE_IDS: readonly PracticeId[] = [
	"business",
	"property",
	"family",
	"employment",
	"criminal",
];

/** The four items of a practice panel. Each one is the key suffix in `practices.<id>`. */
export const PRACTICE_ITEMS = ["item1", "item2", "item3", "item4"] as const;

/** One partner on a door plate. */
export type Partner = {
	name: TranslationKey;
	role: TranslationKey;
	bio: TranslationKey;
};

/** The four partners, founder first. */
export const PARTNERS: readonly Partner[] = [
	{
		name: "team.partner1Name",
		role: "team.partner1Role",
		bio: "team.partner1Bio",
	},
	{
		name: "team.partner2Name",
		role: "team.partner2Role",
		bio: "team.partner2Bio",
	},
	{
		name: "team.partner3Name",
		role: "team.partner3Role",
		bio: "team.partner3Bio",
	},
	{
		name: "team.partner4Name",
		role: "team.partner4Role",
		bio: "team.partner4Bio",
	},
];

/** One row of the associate ledger. `languages` lists the languages of work. */
export type Associate = {
	name: TranslationKey;
	role: TranslationKey;
	languages: TranslationKey;
};

/** The six associates and staff of the ledger under the door plates. */
export const ASSOCIATES: readonly Associate[] = [
	{
		name: "team.associate1Name",
		role: "team.associate1Role",
		languages: "team.languagesArFr",
	},
	{
		name: "team.associate2Name",
		role: "team.associate2Role",
		languages: "team.languagesArFr",
	},
	{
		name: "team.associate3Name",
		role: "team.associate3Role",
		languages: "team.languagesArFrEn",
	},
	{
		name: "team.associate4Name",
		role: "team.associate4Role",
		languages: "team.languagesArFr",
	},
	{
		name: "team.associate5Name",
		role: "team.associate5Role",
		languages: "team.languagesArFr",
	},
	{
		name: "team.associate6Name",
		role: "team.associate6Role",
		languages: "team.languagesArFr",
	},
];

/** One line of the fee scale. `prefix` is a word before the amount ("from"); `unit` is the sans suffix after it. */
export type FeeLine = {
	name: TranslationKey;
	note: TranslationKey;
	amount: TranslationKey;
	unit: TranslationKey;
	prefix?: TranslationKey;
};

/** The published scale, in Algerian dinars before VAT. */
export const FEE_LINES: readonly FeeLine[] = [
	{
		name: "fees.consultationName",
		note: "fees.consultationNote",
		amount: "fees.consultationAmount",
		unit: "fees.currency",
	},
	{
		name: "fees.fixedName",
		note: "fees.fixedNote",
		amount: "fees.fixedAmount",
		unit: "fees.currency",
		prefix: "fees.fixedPrefix",
	},
	{
		name: "fees.partnerName",
		note: "fees.hourlyNote",
		amount: "fees.partnerAmount",
		unit: "fees.perHour",
	},
	{
		name: "fees.associateName",
		note: "fees.associateNote",
		amount: "fees.associateAmount",
		unit: "fees.perHour",
	},
	{
		name: "fees.successName",
		note: "fees.successNote",
		amount: "fees.successAmount",
		unit: "fees.percent",
	},
];

/** One step of the procedure rail. */
export type ProcedureStep = { title: TranslationKey; body: TranslationKey };

/** The four steps from the first meeting to the outcome. */
export const PROCEDURE_STEPS: readonly ProcedureStep[] = [
	{ title: "fees.step1Title", body: "fees.step1Body" },
	{ title: "fees.step2Title", body: "fees.step2Body" },
	{ title: "fees.step3Title", body: "fees.step3Body" },
	{ title: "fees.step4Title", body: "fees.step4Body" },
];

/** One figure of the references column. */
export type Fact = { value: TranslationKey; label: TranslationKey };

/** The three checkable figures beside the client quote. */
export const FACTS: readonly Fact[] = [
	{ value: "references.fact1Value", label: "references.fact1Label" },
	{ value: "references.fact2Value", label: "references.fact2Label" },
	{ value: "references.fact3Value", label: "references.fact3Label" },
];

/** The matters of the consultation request. The first five follow the practice areas. */
export const MATTERS: readonly TranslationKey[] = [
	"contact.matterBusiness",
	"contact.matterProperty",
	"contact.matterFamily",
	"contact.matterEmployment",
	"contact.matterCriminal",
	"contact.matterUnsure",
];

/** The answers to "Is the other party already represented?". */
export const OPPONENT_ANSWERS: readonly TranslationKey[] = [
	"contact.opponentNo",
	"contact.opponentLawyer",
	"contact.opponentPending",
];
