// The menu of SAUCE! as typed lists: burgers, combos, sauces, shakes, sides, and the layers of the Double.
// The section components read these lists. Each text is a key of src/shared/i18n/messages.ts.
// A price is a number in Algerian dinars. components/price.tsx formats it.
import type { TranslationKey } from "~/shared/i18n";

/** One line of a price list. */
export type MenuItem = {
	id: string;
	nameKey: TranslationKey;
	/** Price in Algerian dinars, tax included. */
	priceDa: number;
};

/** A menu line with one sentence of contents under its name. */
export type DetailedMenuItem = MenuItem & { detailKey: TranslationKey };

/** The ground color of a combo plate: ink, the hot accent, or mustard. */
export type PlateTone = "ink" | "hot" | "mustard";

/** The burger of the exploded view. ExplodedSection reads its price here, so the button and the menu board agree. */
export const DOUBLE_BURGER: DetailedMenuItem = {
	id: "double",
	nameKey: "menu.doubleName",
	detailKey: "menu.doubleDetail",
	priceDa: 1150,
};

/** The five burgers, in the order of the menu board. The hero reads its lead prices here. */
export const BURGERS: readonly DetailedMenuItem[] = [
	{
		id: "smash",
		nameKey: "menu.smashName",
		detailKey: "menu.smashDetail",
		priceDa: 850,
	},
	DOUBLE_BURGER,
	{
		id: "triple",
		nameKey: "menu.tripleName",
		detailKey: "menu.tripleDetail",
		priceDa: 1450,
	},
	{
		id: "crispy",
		nameKey: "menu.crispyName",
		detailKey: "menu.crispyDetail",
		priceDa: 950,
	},
	{
		id: "veg",
		nameKey: "menu.vegName",
		detailKey: "menu.vegDetail",
		priceDa: 800,
	},
];

/** The ids of the three burgers that the hero price line shows. */
export const LEAD_BURGER_IDS: readonly string[] = ["smash", "double", "crispy"];

/** The three combos. Each plate has its own ground color, so no two plates look the same. */
export const COMBOS: readonly (DetailedMenuItem & { plate: PlateTone })[] = [
	{
		id: "smash-combo",
		nameKey: "menu.comboSmashName",
		detailKey: "menu.comboSmashDetail",
		priceDa: 1250,
		plate: "ink",
	},
	{
		id: "double-combo",
		nameKey: "menu.comboDoubleName",
		detailKey: "menu.comboDoubleDetail",
		priceDa: 1700,
		plate: "hot",
	},
	{
		id: "share-combo",
		nameKey: "menu.comboShareName",
		detailKey: "menu.comboShareDetail",
		priceDa: 2900,
		plate: "mustard",
	},
];

/** One free sauce of the numbered list. */
export type Sauce = {
	id: string;
	nameKey: TranslationKey;
	detailKey: TranslationKey;
	/** A one-word warning on an ink tag, for example "Hot". Most sauces have none. */
	tagKey?: TranslationKey;
};

/** The four free sauces, in the order of the counter. */
export const SAUCES: readonly Sauce[] = [
	{ id: "house", nameKey: "sauces.houseName", detailKey: "sauces.houseDetail" },
	{
		id: "harissa-honey",
		nameKey: "sauces.harissaName",
		detailKey: "sauces.harissaDetail",
		tagKey: "sauces.hotTag",
	},
	{
		id: "garlic-lemon",
		nameKey: "sauces.garlicName",
		detailKey: "sauces.garlicDetail",
	},
	{
		id: "mustard-pickle",
		nameKey: "sauces.mustardName",
		detailKey: "sauces.mustardDetail",
	},
];

/** Price of the hot cheddar pot in dinars. It is the only sauce that is not free. */
export const CHEDDAR_POT_PRICE_DA = 100;

/** The five shakes of the price board. */
export const SHAKES: readonly MenuItem[] = [
	{ id: "vanilla-caramel", nameKey: "sides.shakeVanilla", priceDa: 550 },
	{ id: "strawberry", nameKey: "sides.shakeStrawberry", priceDa: 550 },
	{ id: "cookie-peanut", nameKey: "sides.shakeCookie", priceDa: 650 },
	{ id: "frozen-lemon", nameKey: "sides.shakeLemon", priceDa: 400 },
	{ id: "date-milk", nameKey: "sides.shakeDate", priceDa: 600 },
];

/** The four sides of the price board. */
export const SIDES: readonly MenuItem[] = [
	{ id: "house-fries", nameKey: "sides.sideFries", priceDa: 300 },
	{ id: "cheddar-fries", nameKey: "sides.sideCheddarFries", priceDa: 450 },
	{ id: "onion-rings", nameKey: "sides.sideOnionRings", priceDa: 400 },
	{ id: "coleslaw", nameKey: "sides.sideColeslaw", priceDa: 250 },
];

/** One horizontal slice of the photo of the Double. */
export type BurgerLayer = {
	id: string;
	labelKey: TranslationKey;
	/** Top edge of the slice, as a share of the photo height from 0 to 1. */
	top: number;
	/** Bottom edge of the slice, as a share of the photo height from 0 to 1. */
	bottom: number;
};

/**
 * The six layers of the Double, from the top bun to the bottom bun.
 * The cuts follow the real edges in public/images/double-burger.webp. A new photo needs new cuts.
 */
export const BURGER_LAYERS: readonly BurgerLayer[] = [
	{ id: "top-bun", labelKey: "exploded.layerBun", top: 0.15, bottom: 0.345 },
	{ id: "onion", labelKey: "exploded.layerOnion", top: 0.345, bottom: 0.412 },
	{
		id: "first-patty",
		labelKey: "exploded.layerFirstPatty",
		top: 0.412,
		bottom: 0.526,
	},
	{
		id: "pickles",
		labelKey: "exploded.layerPickles",
		top: 0.526,
		bottom: 0.56,
	},
	{
		id: "second-patty",
		labelKey: "exploded.layerSecondPatty",
		top: 0.56,
		bottom: 0.68,
	},
	{
		id: "bottom-bun",
		labelKey: "exploded.layerBottomBun",
		top: 0.68,
		bottom: 0.872,
	},
];

/** The section links of the header and of the phone menu. Each href is the id of a section element. */
export const NAV_LINKS: readonly { href: string; labelKey: TranslationKey }[] =
	[
		{ href: "#menu", labelKey: "site.navMenu" },
		{ href: "#exploded", labelKey: "site.navExploded" },
		{ href: "#drive", labelKey: "site.navDrive" },
		{ href: "#shakes", labelKey: "site.navShakes" },
		{ href: "#order", labelKey: "site.navFindUs" },
	];
