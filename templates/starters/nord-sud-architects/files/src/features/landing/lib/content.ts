// The lists of the Atelier Nord-Sud page: the sections, the plan phases, the missions, the method, and the figures.
// The section components map over them. Each text is a key of the messages.ts dictionary.
// To add a mission or a figure, add one entry here and its texts in messages.ts.
import type { TranslationKey } from "~/shared/i18n";

/** A link of the header, the phone menu, and the footer. */
export type SectionLink = {
	/** The anchor of the section on the page, for example "#plan". */
	href: string;
	/** The folio tab of the section, as on a drawing set: "PL·02". */
	folio: TranslationKey;
	label: TranslationKey;
};

/** The sections that the navigation lists, in page order. The hero is PL·01. */
export const SECTION_LINKS: readonly SectionLink[] = [
	{ href: "#plan", folio: "plan.folio", label: "nav.plan" },
	{ href: "#sheets", folio: "sheets.folio", label: "nav.sheets" },
	{ href: "#missions", folio: "missions.folio", label: "nav.missions" },
	{ href: "#method", folio: "method.folio", label: "nav.method" },
	{ href: "#contact", folio: "contact.folio", label: "nav.contact" },
];

/** The anchor of every "Open a study" action. */
export const CONTACT_HREF = "#contact";

/** The six phases of the plotter, in drawing order. The last one is the red pencil. */
export const PLAN_PHASES: readonly TranslationKey[] = [
	"plan.phaseWalls",
	"plan.phaseOpenings",
	"plan.phaseFurniture",
	"plan.phaseDimensions",
	"plan.phaseSchedule",
	"plan.phaseVisa",
];

/**
 * The plot progress where each phase starts, then 1. The windows of landing.css use the same boundaries:
 * walls 0, windows 0.18, furniture 0.32, dimensions 0.5, room labels 0.66, red pencil 0.82.
 */
export const PLAN_PHASE_STARTS = [0, 0.18, 0.32, 0.5, 0.66, 0.82, 1] as const;

/** One row of the schedule of missions. */
export type Mission = {
	/** The row number, two digits. */
	number: string;
	/** The drawn symbol of the row: a set square, a door swing, a detail circle, or a level mark. */
	symbol: "set-square" | "door-swing" | "detail-circle" | "level-mark";
	name: TranslationKey;
	body: TranslationKey;
	fee: TranslationKey;
	/** The red pencil note under the fee. Only one row of the page has it. */
	feeNote?: TranslationKey;
};

/** The four missions of the studio, in the order of a project. */
export const MISSIONS: readonly Mission[] = [
	{
		number: "01",
		symbol: "set-square",
		name: "missions.sketchName",
		body: "missions.sketchBody",
		fee: "missions.sketchFee",
	},
	{
		number: "02",
		symbol: "door-swing",
		name: "missions.permitName",
		body: "missions.permitBody",
		fee: "missions.permitFee",
		feeNote: "missions.permitNote",
	},
	{
		number: "03",
		symbol: "detail-circle",
		name: "missions.drawingsName",
		body: "missions.drawingsBody",
		fee: "missions.drawingsFee",
	},
	{
		number: "04",
		symbol: "level-mark",
		name: "missions.siteName",
		body: "missions.siteBody",
		fee: "missions.siteFee",
	},
];

/** One phase of the method. `span` is the short value above the dimension chain. */
export type MethodPhase = {
	tag: TranslationKey;
	name: TranslationKey;
	body: TranslationKey;
	span: TranslationKey;
	/** The long duration under the phase on a phone, where the chain does not show. */
	duration: TranslationKey;
};

/** The five phases. The first four add up to 19 weeks, the total under the chain. */
export const METHOD_PHASES: readonly MethodPhase[] = [
	{
		tag: "method.sketchTag",
		name: "method.sketchName",
		body: "method.sketchBody",
		span: "method.sketchSpan",
		duration: "method.sketchDuration",
	},
	{
		tag: "method.designTag",
		name: "method.designName",
		body: "method.designBody",
		span: "method.designSpan",
		duration: "method.designDuration",
	},
	{
		tag: "method.permitTag",
		name: "method.permitName",
		body: "method.permitBody",
		span: "method.permitSpan",
		duration: "method.permitDuration",
	},
	{
		tag: "method.drawingsTag",
		name: "method.drawingsName",
		body: "method.drawingsBody",
		span: "method.drawingsSpan",
		duration: "method.drawingsDuration",
	},
	{
		tag: "method.siteTag",
		name: "method.siteName",
		body: "method.siteBody",
		span: "method.siteSpan",
		duration: "method.siteDuration",
	},
];

/** One counted figure of the studio, with the text of the bracket above it. */
export type StudioFigure = {
	value: number;
	bracket: TranslationKey;
	label: TranslationKey;
};

/** The four figures of the studio survey. */
export const STUDIO_FIGURES: readonly StudioFigure[] = [
	{
		value: 86,
		bracket: "figures.deliveredBracket",
		label: "figures.deliveredLabel",
	},
	{
		value: 31,
		bracket: "figures.permitsBracket",
		label: "figures.permitsLabel",
	},
	{ value: 14, bracket: "figures.sitesBracket", label: "figures.sitesLabel" },
	{
		value: 4,
		bracket: "figures.wilayasBracket",
		label: "figures.wilayasLabel",
	},
];

/** The project types of the study request. The first one is the default choice. */
export const PROJECT_TYPES: readonly TranslationKey[] = [
	"contact.typeVilla",
	"contact.typeBuilding",
	"contact.typeRestoration",
	"contact.typeExtension",
	"contact.typeShop",
];

/** The plot locations of the study request, in the order of the list. */
export const PLOT_PLACES: readonly TranslationKey[] = [
	"contact.placeCentre",
	"contact.placeElBiar",
	"contact.placeHydra",
	"contact.placeBologhine",
	"contact.placeDelyIbrahim",
	"contact.placeOutside",
];
