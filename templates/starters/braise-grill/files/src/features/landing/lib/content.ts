// The sample content of the Braise home page as typed lists: section links, menu slates, ledger, register, evening.
// The section components read these lists. Each text is a key of src/shared/i18n/messages.ts.
// A price is a number in Algerian dinars. components/price.tsx formats it.
import type { TranslationKey } from "~/shared/i18n";

/** One anchor link of the header and of the phone menu. `href` is the id of a section on the page. */
export type NavLink = {
	href: string;
	labelKey: TranslationKey;
	/** True when the desktop header shows the link. The source page keeps the header to three links. */
	isInHeader: boolean;
};

/**
 * The section links, in page order. The phone menu numbers them 01 to 05, like the section eyebrows.
 * Keep this order when you add or move a section, or the numbers stop agreeing.
 */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#hearth", labelKey: "site.navHearth", isInHeader: true },
	{ href: "#menu", labelKey: "site.navMenu", isInHeader: true },
	{ href: "#chef", labelKey: "site.navChef", isInHeader: false },
	{ href: "#room", labelKey: "site.navRoom", isInHeader: true },
	{ href: "#evening", labelKey: "site.navEvening", isInHeader: false },
];

/** One dish line of a slate. */
export type Dish = {
	nameKey: TranslationKey;
	/** Net price in Algerian dinars, service included. */
	priceDa: number;
};

/** One charcoal slate of the menu: a dish family, a short meta label, and four dishes. */
export type MenuSlateEntry = {
	id: string;
	titleKey: TranslationKey;
	metaKey: TranslationKey;
	dishes: readonly Dish[];
};

/** The four slates of the menu, in reading order. The smoke lights them in this order. */
export const MENU_SLATES: readonly MenuSlateEntry[] = [
	{
		id: "embers",
		titleKey: "menu.embersTitle",
		metaKey: "menu.embersMeta",
		dishes: [
			{ nameKey: "menu.embers1", priceDa: 900 },
			{ nameKey: "menu.embers2", priceDa: 750 },
			{ nameKey: "menu.embers3", priceDa: 1100 },
			{ nameKey: "menu.embers4", priceDa: 350 },
		],
	},
	{
		id: "grill",
		titleKey: "menu.grillTitle",
		metaKey: "menu.grillMeta",
		dishes: [
			{ nameKey: "menu.grill1", priceDa: 4800 },
			{ nameKey: "menu.grill2", priceDa: 9600 },
			{ nameKey: "menu.grill3", priceDa: 3900 },
			{ nameKey: "menu.grill4", priceDa: 3200 },
		],
	},
	{
		id: "sides",
		titleKey: "menu.sidesTitle",
		metaKey: "menu.sidesMeta",
		dishes: [
			{ nameKey: "menu.sides1", priceDa: 700 },
			{ nameKey: "menu.sides2", priceDa: 800 },
			{ nameKey: "menu.sides3", priceDa: 650 },
			{ nameKey: "menu.sides4", priceDa: 600 },
		],
	},
	{
		id: "sweet",
		titleKey: "menu.sweetTitle",
		metaKey: "menu.sweetMeta",
		dishes: [
			{ nameKey: "menu.sweet1", priceDa: 950 },
			{ nameKey: "menu.sweet2", priceDa: 850 },
			{ nameKey: "menu.sweet3", priceDa: 700 },
			{ nameKey: "menu.sweet4", priceDa: 300 },
		],
	},
];

/** Price of the five-course fire menu, per person, in Algerian dinars. */
export const FEAST_PRICE_DA = 5400;

/** One cell of the ledger under the hearth: a big figure, its unit, and one sentence. */
export type LedgerCell = {
	valueKey: TranslationKey;
	unitKey: TranslationKey;
	textKey: TranslationKey;
};

/** The three cells of the hearth ledger. */
export const LEDGER_CELLS: readonly LedgerCell[] = [
	{
		valueKey: "hearth.heatValue",
		unitKey: "hearth.heatUnit",
		textKey: "hearth.heatText",
	},
	{
		valueKey: "hearth.woodsValue",
		unitKey: "hearth.woodsUnit",
		textKey: "hearth.woodsText",
	},
	{
		valueKey: "hearth.coversValue",
		unitKey: "hearth.coversUnit",
		textKey: "hearth.coversText",
	},
];

/** One labelled fact: a small caps label on the start side and its value on the end side. */
export type Fact = { labelKey: TranslationKey; valueKey: TranslationKey };

/** The two sittings of the tonight slate in the hero. The "Tonight" cell before them has its own ember dot. */
export const TONIGHT_SITTINGS: readonly Fact[] = [
	{ labelKey: "hero.firstLabel", valueKey: "hero.firstValue" },
	{ labelKey: "hero.lastLabel", valueKey: "hero.lastValue" },
];

/** The facts list of the chef section. */
export const CHEF_FACTS: readonly Fact[] = [
	{ labelKey: "chef.hearthLabel", valueKey: "chef.hearthValue" },
	{ labelKey: "chef.roomLabel", valueKey: "chef.roomValue" },
	{ labelKey: "chef.butcheryLabel", valueKey: "chef.butcheryValue" },
	{ labelKey: "chef.suppliersLabel", valueKey: "chef.suppliersValue" },
];

/** One row of the ageing register: the cut, where it comes from, its days in the cellar, and its weight. */
export type RegisterRow = {
	cutKey: TranslationKey;
	originKey: TranslationKey;
	ageingKey: TranslationKey;
	weightKey: TranslationKey;
};

/** The four rows of the ageing register in the room section. */
export const REGISTER_ROWS: readonly RegisterRow[] = [
	{
		cutKey: "room.row1Cut",
		originKey: "room.row1Origin",
		ageingKey: "room.row1Ageing",
		weightKey: "room.row1Weight",
	},
	{
		cutKey: "room.row2Cut",
		originKey: "room.row2Origin",
		ageingKey: "room.row2Ageing",
		weightKey: "room.row2Weight",
	},
	{
		cutKey: "room.row3Cut",
		originKey: "room.row3Origin",
		ageingKey: "room.row3Ageing",
		weightKey: "room.row3Weight",
	},
	{
		cutKey: "room.row4Cut",
		originKey: "room.row4Origin",
		ageingKey: "room.row4Ageing",
		weightKey: "room.row4Weight",
	},
];

/** One moment of the evening: a time numeral, a title, and one short paragraph. */
export type EveningMoment = {
	id: string;
	timeKey: TranslationKey;
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
};

/** The three moments of the evening. Each one sits lower than the one before it on a wide screen. */
export const EVENING_MOMENTS: readonly EveningMoment[] = [
	{
		id: "light",
		timeKey: "evening.lightTime",
		titleKey: "evening.lightTitle",
		bodyKey: "evening.lightBody",
	},
	{
		id: "first",
		timeKey: "evening.firstTime",
		titleKey: "evening.firstTitle",
		bodyKey: "evening.firstBody",
	},
	{
		id: "last",
		timeKey: "evening.lastTime",
		titleKey: "evening.lastTitle",
		bodyKey: "evening.lastBody",
	},
];

/** The coordinates of the booking section. The phone number is on the booking slate, so it is not here. */
export const BOOKING_COORDINATES: readonly Fact[] = [
	{ labelKey: "booking.addressLabel", valueKey: "booking.addressValue" },
	{ labelKey: "booking.groupsLabel", valueKey: "booking.groupsValue" },
	{ labelKey: "booking.valetLabel", valueKey: "booking.valetValue" },
];

/** The rows of the booking slate, with a dotted leader between the label and the value. */
export const BOOKING_ROWS: readonly Fact[] = [
	{ labelKey: "booking.rowFirst", valueKey: "booking.rowFirstValue" },
	{ labelKey: "booking.rowLast", valueKey: "booking.rowLastValue" },
	{ labelKey: "booking.rowFriday", valueKey: "booking.rowFridayValue" },
	{ labelKey: "booking.rowParty", valueKey: "booking.rowPartyValue" },
];
