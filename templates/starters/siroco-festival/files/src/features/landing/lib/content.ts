// The programme of Festival Siroco as typed lists: section links, headliner posters, days, passes, questions, and booking steps.
// The section components read these lists. Each text is a key of src/shared/i18n/messages.ts.
// Times are 24-hour local times as display text. Prices are whole euros.
import type { TranslationKey } from "~/shared/i18n";

/** A flat poster color. landing.css maps each one to a sheet class (`sf-cream`, `sf-cobalt`, and the others). */
export type Ground = "cream" | "cobalt" | "vermilion" | "mustard";

/** One link of the header and of the phone menu. `href` is an anchor id of the page. */
export type NavLink = { href: string; labelKey: TranslationKey };

/** The section links, in page order. Each anchor is the id of a section element. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#manifesto", labelKey: "nav.manifesto" },
	{ href: "#headliners", labelKey: "nav.headliners" },
	{ href: "#programme", labelKey: "nav.programme" },
	{ href: "#tickets", labelKey: "nav.tickets" },
	{ href: "#info", labelKey: "nav.info" },
	{ href: "#book", labelKey: "nav.book" },
];

/** One headliner poster of the paste-up. */
export type Headliner = {
	id: string;
	ground: Ground;
	/** Short day label, for example "Fri 20". */
	dayKey: TranslationKey;
	stageKey: TranslationKey;
	/** Stage time, 24-hour text. */
	time: string;
	nameKey: TranslationKey;
	/**
	 * Font size of the fitted name as a share of the poster width, for Anton caps.
	 * The fit hook corrects it when the theme has another display face.
	 */
	fit: number;
	/** Fit shares of each word of the name, for the phone poster that stacks one word per line. */
	stackFits: readonly number[];
	genreKey: TranslationKey;
	noteKeys: readonly [TranslationKey, TranslationKey];
};

/** The four posters, in paste order. Two neighbors never share a ground. */
export const HEADLINERS: readonly Headliner[] = [
	{
		id: "taxi",
		ground: "cobalt",
		dayKey: "programme.fridayShort",
		stageKey: "headliners.mainStage",
		time: "22:30",
		nameKey: "headliners.taxiName",
		fit: 0.187,
		stackFits: [0.6165, 0.2865],
		genreKey: "headliners.taxiGenre",
		noteKeys: ["headliners.taxiNote1", "headliners.taxiNote2"],
	},
	{
		id: "lubna",
		ground: "mustard",
		dayKey: "programme.saturdayShort",
		stageKey: "headliners.mainStage",
		time: "21:00",
		nameKey: "headliners.lubnaName",
		fit: 0.4196,
		stackFits: [0.4196],
		genreKey: "headliners.lubnaGenre",
		noteKeys: ["headliners.lubnaNote1", "headliners.lubnaNote2"],
	},
	{
		id: "moteur",
		ground: "cream",
		dayKey: "programme.saturdayShort",
		stageKey: "headliners.mistralStage",
		time: "23:45",
		nameKey: "headliners.moteurName",
		fit: 0.3041,
		stackFits: [0.3041],
		genreKey: "headliners.moteurGenre",
		noteKeys: ["headliners.moteurNote1", "headliners.moteurNote2"],
	},
	{
		id: "azur",
		ground: "vermilion",
		dayKey: "programme.sundayShort",
		stageKey: "headliners.mainStage",
		time: "21:30",
		nameKey: "headliners.azurName",
		fit: 0.249,
		stackFits: [0.5293, 0.5293],
		genreKey: "headliners.azurGenre",
		noteKeys: ["headliners.azurNote1", "headliners.azurNote2"],
	},
];

/** One set of the programme. */
export type ProgrammeAct = {
	/** Start time, 24-hour text. */
	time: string;
	nameKey: TranslationKey;
	stageKey: TranslationKey;
	/** True for the headliner of the night. The row sets it in the display face. */
	isHeadliner: boolean;
};

/** One night of the programme. */
export type ProgrammeDay = {
	id: string;
	dayKey: TranslationKey;
	hoursKey: TranslationKey;
	noteKey: TranslationKey;
	acts: readonly ProgrammeAct[];
};

/** The three nights. Each act appears once; the headliners match HEADLINERS. */
export const PROGRAMME: readonly ProgrammeDay[] = [
	{
		id: "friday",
		dayKey: "programme.fridayShort",
		hoursKey: "programme.fridayHours",
		noteKey: "programme.fridayNote",
		acts: [
			{
				time: "18:30",
				nameKey: "programme.bakhtaClub",
				stageKey: "programme.mistral",
				isHeadliner: false,
			},
			{
				time: "20:15",
				nameKey: "programme.nadirMouettes",
				stageKey: "programme.main",
				isHeadliner: false,
			},
			{
				time: "22:30",
				nameKey: "programme.taxiFantome",
				stageKey: "programme.main",
				isHeadliner: true,
			},
			{
				time: "00:00",
				nameKey: "programme.djSable",
				stageKey: "programme.mistral",
				isHeadliner: false,
			},
		],
	},
	{
		id: "saturday",
		dayKey: "programme.saturdayShort",
		hoursKey: "programme.saturdayHours",
		noteKey: "programme.saturdayNote",
		acts: [
			{
				time: "17:30",
				nameKey: "programme.santoRico",
				stageKey: "programme.mistral",
				isHeadliner: false,
			},
			{
				time: "19:15",
				nameKey: "programme.palmiersNoirs",
				stageKey: "programme.main",
				isHeadliner: false,
			},
			{
				time: "21:00",
				nameKey: "programme.lubna",
				stageKey: "programme.main",
				isHeadliner: true,
			},
			{
				time: "23:45",
				nameKey: "programme.moteur",
				stageKey: "programme.mistral",
				isHeadliner: true,
			},
		],
	},
	{
		id: "sunday",
		dayKey: "programme.sundayShort",
		hoursKey: "programme.sundayHours",
		noteKey: "programme.sundayNote",
		acts: [
			{
				time: "16:00",
				nameKey: "programme.choraleMole",
				stageKey: "programme.main",
				isHeadliner: false,
			},
			{
				time: "18:00",
				nameKey: "programme.ninaCorniche",
				stageKey: "programme.mistral",
				isHeadliner: false,
			},
			{
				time: "19:45",
				nameKey: "programme.calanquesSoniques",
				stageKey: "programme.main",
				isHeadliner: false,
			},
			{
				time: "21:30",
				nameKey: "programme.azurAzur",
				stageKey: "programme.main",
				isHeadliner: true,
			},
		],
	},
];

/** One pass of the price list. */
export type Pass = {
	id: string;
	nameKey: TranslationKey;
	/** Price in whole euros, all fees included. */
	priceEuros: number;
	lineKeys: readonly [TranslationKey, TranslationKey];
	actionKey: TranslationKey;
};

/** The three passes, cheapest first. The hero CTA quotes the first price. */
export const PASSES: readonly Pass[] = [
	{
		id: "day",
		nameKey: "tickets.dayName",
		priceEuros: 39,
		lineKeys: ["tickets.dayLine1", "tickets.dayLine2"],
		actionKey: "tickets.takePass",
	},
	{
		id: "weekend",
		nameKey: "tickets.weekendName",
		priceEuros: 89,
		lineKeys: ["tickets.weekendLine1", "tickets.weekendLine2"],
		actionKey: "tickets.takePass",
	},
	{
		id: "supporter",
		nameKey: "tickets.supporterName",
		priceEuros: 150,
		lineKeys: ["tickets.supporterLine1", "tickets.supporterLine2"],
		actionKey: "tickets.support",
	},
];

/** One question of the practical info. */
export type Question = {
	id: string;
	questionKey: TranslationKey;
	answerKey: TranslationKey;
};

/** The four questions, in the order a visitor asks them. */
export const QUESTIONS: readonly Question[] = [
	{
		id: "travel",
		questionKey: "info.travelQuestion",
		answerKey: "info.travelAnswer",
	},
	{
		id: "food",
		questionKey: "info.foodQuestion",
		answerKey: "info.foodAnswer",
	},
	{
		id: "sleep",
		questionKey: "info.sleepQuestion",
		answerKey: "info.sleepAnswer",
	},
	{
		id: "wind",
		questionKey: "info.windQuestion",
		answerKey: "info.windAnswer",
	},
];

/** One step of a booking. BookingSection numbers the steps in list order. */
export type BookingStep = {
	id: string;
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
};

/** The three steps of a booking by telephone or email. */
export const BOOKING_STEPS: readonly BookingStep[] = [
	{ id: "ask", titleKey: "booking.step1Title", bodyKey: "booking.step1Body" },
	{ id: "hold", titleKey: "booking.step2Title", bodyKey: "booking.step2Body" },
	{ id: "pay", titleKey: "booking.step3Title", bodyKey: "booking.step3Body" },
];
