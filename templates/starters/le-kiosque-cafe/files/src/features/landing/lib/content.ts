// The lists of the Le Kiosque page: the rubric links, the briefs, the menu, the past editions, and the newsroom.
// The section components map over them. Every text is a message key; messages.ts holds the words.
// Prices are numbers in euros; components/price.tsx formats them.
import type { TranslationKey } from "~/shared/i18n";

/** One rubric of the paper: a section anchor and the page number that the jump lines cite. */
type Rubric = {
	/** Anchor of the section on the home page, for example "#roast". */
	href: string;
	labelKey: TranslationKey;
	/** The page of the paper. The jump lines ("Continued on p. 2") cite the same numbers. */
	page: number;
};

/** The rubric nav, in reading order. The masthead and the phone menu both list it. */
export const RUBRICS: readonly Rubric[] = [
	{ href: "#front-page", labelKey: "site.navFront", page: 1 },
	{ href: "#roast", labelKey: "site.navRoast", page: 2 },
	{ href: "#menu", labelKey: "site.navMenu", page: 3 },
	{ href: "#archives", labelKey: "site.navArchives", page: 4 },
	{ href: "#letters", labelKey: "site.navLetters", page: 5 },
];

/** One brief of the "In brief" rail of page 2. */
type Brief = {
	slugKey: TranslationKey;
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
};

/** The four briefs, top to bottom. */
export const BRIEFS: readonly Brief[] = [
	{
		slugKey: "roast.brief1Slug",
		titleKey: "roast.brief1Title",
		bodyKey: "roast.brief1Body",
	},
	{
		slugKey: "roast.brief2Slug",
		titleKey: "roast.brief2Title",
		bodyKey: "roast.brief2Body",
	},
	{
		slugKey: "roast.brief3Slug",
		titleKey: "roast.brief3Title",
		bodyKey: "roast.brief3Body",
	},
	{
		slugKey: "roast.brief4Slug",
		titleKey: "roast.brief4Title",
		bodyKey: "roast.brief4Body",
	},
];

/** One classified ad of the menu: a caps lead-in, one sentence, and a price. */
type MenuItem = {
	nameKey: TranslationKey;
	noteKey: TranslationKey;
	/** Price in euros, service included. */
	price: number;
};

/** One slugged category of the menu, with its ads. */
type MenuCategory = {
	titleKey: TranslationKey;
	items: readonly MenuItem[];
};

/** The menu of page 3. Espresso stays at €2, as the masthead and the imprint promise. */
export const MENU: readonly MenuCategory[] = [
	{
		titleKey: "menu.coffees",
		items: [
			{ nameKey: "menu.espressoName", noteKey: "menu.espressoNote", price: 2 },
			{
				nameKey: "menu.noisetteName",
				noteKey: "menu.noisetteNote",
				price: 2.6,
			},
			{
				nameKey: "menu.cappuccinoName",
				noteKey: "menu.cappuccinoNote",
				price: 4.2,
			},
			{
				nameKey: "menu.flatWhiteName",
				noteKey: "menu.flatWhiteNote",
				price: 4.5,
			},
		],
	},
	{
		titleKey: "menu.filters",
		items: [
			{ nameKey: "menu.pourOverName", noteKey: "menu.pourOverNote", price: 5 },
			{ nameKey: "menu.carafeName", noteKey: "menu.carafeNote", price: 8.5 },
			{ nameKey: "menu.batchName", noteKey: "menu.batchNote", price: 3 },
			{
				nameKey: "menu.mysteryName",
				noteKey: "menu.mysteryNote",
				price: 3.5,
			},
		],
	},
	{
		titleKey: "menu.sweets",
		items: [
			{ nameKey: "menu.toastName", noteKey: "menu.toastNote", price: 6.5 },
			{ nameKey: "menu.cookieName", noteKey: "menu.cookieNote", price: 3.2 },
			{ nameKey: "menu.flanName", noteKey: "menu.flanNote", price: 4 },
			{ nameKey: "menu.beansName", noteKey: "menu.beansNote", price: 9.8 },
		],
	},
];

/** One figure of the archives box: a Playfair numeral over a caps label. */
type PaperFigure = {
	value: number;
	labelKey: TranslationKey;
};

/** The figures box. 142 matches the edition number of the masthead. */
export const PAPER_FIGURES: readonly PaperFigure[] = [
	{ value: 142, labelKey: "archives.figureEditions" },
	{ value: 38, labelKey: "archives.figureLots" },
	{ value: 4, labelKey: "archives.figureFramed" },
];

/** One past front page of the archives strip. */
type PastEdition = {
	numberKey: TranslationKey;
	dateKey: TranslationKey;
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
};

/** The four framed front pages, oldest first. Each date names its true weekday. */
export const PAST_EDITIONS: readonly PastEdition[] = [
	{
		numberKey: "archives.edition1Number",
		dateKey: "archives.edition1Date",
		titleKey: "archives.edition1Title",
		bodyKey: "archives.edition1Body",
	},
	{
		numberKey: "archives.edition2Number",
		dateKey: "archives.edition2Date",
		titleKey: "archives.edition2Title",
		bodyKey: "archives.edition2Body",
	},
	{
		numberKey: "archives.edition3Number",
		dateKey: "archives.edition3Date",
		titleKey: "archives.edition3Title",
		bodyKey: "archives.edition3Body",
	},
	{
		numberKey: "archives.edition4Number",
		dateKey: "archives.edition4Date",
		titleKey: "archives.edition4Title",
		bodyKey: "archives.edition4Body",
	},
];

/** The drawn face of a newsroom portrait. components/portrait-plate.tsx draws each one. */
export type PortraitFace = "bun" | "cap" | "glasses";

/** One member of the newsroom. */
type Journalist = {
	face: PortraitFace;
	nameKey: TranslationKey;
	roleKey: TranslationKey;
	quoteKey: TranslationKey;
	/** The aria-label of the portrait plate. */
	plateKey: TranslationKey;
};

/** The newsroom, left to right. The middle card sits lower on a wide screen. */
export const NEWSROOM: readonly Journalist[] = [
	{
		face: "bun",
		nameKey: "newsroom.nadiaName",
		roleKey: "newsroom.nadiaRole",
		quoteKey: "newsroom.nadiaQuote",
		plateKey: "newsroom.nadiaPlate",
	},
	{
		face: "cap",
		nameKey: "newsroom.emileName",
		roleKey: "newsroom.emileRole",
		quoteKey: "newsroom.emileQuote",
		plateKey: "newsroom.emilePlate",
	},
	{
		face: "glasses",
		nameKey: "newsroom.sofiaName",
		roleKey: "newsroom.sofiaRole",
		quoteKey: "newsroom.sofiaQuote",
		plateKey: "newsroom.sofiaPlate",
	},
];

/** The subjects of the coupon. Each one opens a mail with that subject. */
export const LETTER_SUBJECTS: readonly TranslationKey[] = [
	"letters.subjectTable",
	"letters.subjectBeans",
	"letters.subjectLetter",
	"letters.subjectOther",
];
