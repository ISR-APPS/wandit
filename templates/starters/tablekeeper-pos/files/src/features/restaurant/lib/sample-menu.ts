// The menu of the restaurant: 34 dishes and drinks in 5 categories. It stands in for a `menu_items` table.
// menuQueryOptions returns these rows with the availability at `now`. The order sample module picks its lines from them.
// Prices are whole cents and include VAT, as on a printed menu in Europe. Two dishes sell out during the day.

/** The menu categories, in the order of a meal. The tabs and the ticket follow this order. */
export const MENU_CATEGORIES = [
	"starters",
	"mains",
	"sides",
	"desserts",
	"drinks",
] as const;

/** One category. Its label is the message key `menuCategories.<category>`. */
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

/** Where a line is made: the kitchen pass or the bar. The kitchen ticket groups the lines by station. */
export type Station = "kitchen" | "bar";

/** The allergens that the menu declares. Each label is the message key `allergens.<allergen>`. */
export const ALLERGENS = [
	"gluten",
	"dairy",
	"egg",
	"fish",
	"shellfish",
	"nuts",
	"sulphites",
] as const;

/** One allergen code. */
export type Allergen = (typeof ALLERGENS)[number];

/** One dish or drink of the menu. */
export type MenuItem = {
	/** Stable id, for example "m1". Order lines point to it. */
	id: string;
	name: string;
	/** One short line under the name on the menu. */
	description: string;
	category: MenuCategory;
	station: Station;
	/** Price of one portion in cents, VAT included. 2800 is 28.00. */
	priceCents: number;
	/** VAT share inside the price: 0.1 for food and soft drinks, 0.2 for alcohol. */
	vatRate: number;
	/** False when the kitchen has run out of it for the rest of the day. The order screen then disables it. */
	isAvailable: boolean;
	allergens: Allergen[];
};

/** The currency of every amount. A later step moves it to a settings table. */
export const RESTAURANT_CURRENCY = "EUR";

// Food and soft drinks take the reduced rate. Alcohol takes the standard rate.
const FOOD_VAT = 0.1;
const ALCOHOL_VAT = 0.2;

const MENU_ITEMS: MenuItem[] = [
	{
		id: "s1",
		name: "Burrata, roasted peaches",
		description: "Basil oil, toasted hazelnuts",
		category: "starters",
		station: "kitchen",
		priceCents: 1200,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy", "nuts"],
	},
	{
		id: "s2",
		name: "Onion soup",
		description: "Slow-cooked onions, gruyère crouton",
		category: "starters",
		station: "kitchen",
		priceCents: 950,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["gluten", "dairy"],
	},
	{
		id: "s3",
		name: "Beef tartare",
		description: "Hand-cut, capers, cured egg yolk",
		category: "starters",
		station: "kitchen",
		priceCents: 1400,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["egg"],
	},
	{
		id: "s4",
		name: "Grilled octopus",
		description: "Smoked paprika, crushed potatoes",
		category: "starters",
		station: "kitchen",
		priceCents: 1550,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["shellfish"],
	},
	{
		id: "s5",
		name: "Tomato salad",
		description: "Heirloom tomatoes, sherry vinegar, shallot",
		category: "starters",
		station: "kitchen",
		priceCents: 1000,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["sulphites"],
	},
	{
		id: "s6",
		name: "Duck rillettes",
		description: "Cornichons, grilled sourdough",
		category: "starters",
		station: "kitchen",
		priceCents: 1100,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["gluten"],
	},
	{
		id: "m1",
		name: "Steak frites",
		description: "Flat iron steak, béarnaise, fries",
		category: "mains",
		station: "kitchen",
		priceCents: 2800,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["egg", "dairy"],
	},
	{
		id: "m2",
		name: "Roast chicken",
		description: "Half chicken, tarragon jus",
		category: "mains",
		station: "kitchen",
		priceCents: 2200,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy"],
	},
	{
		id: "m3",
		name: "Sea bream",
		description: "Fennel, citrus butter",
		category: "mains",
		station: "kitchen",
		priceCents: 2600,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["fish", "dairy"],
	},
	{
		id: "m4",
		name: "Mushroom risotto",
		description: "Wild mushrooms, aged parmesan",
		category: "mains",
		station: "kitchen",
		priceCents: 1950,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy", "sulphites"],
	},
	{
		id: "m5",
		name: "Lamb shoulder",
		description: "Seven hours, white beans, rosemary",
		category: "mains",
		station: "kitchen",
		priceCents: 2700,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["sulphites"],
	},
	{
		id: "m6",
		name: "Bistro burger",
		description: "Aged cheddar, pickles, fries",
		category: "mains",
		station: "kitchen",
		priceCents: 1850,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["gluten", "dairy", "egg"],
	},
	{
		id: "m7",
		name: "Mussels",
		description: "White wine, garlic, parsley, fries",
		category: "mains",
		station: "kitchen",
		priceCents: 2100,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["shellfish", "sulphites"],
	},
	{
		id: "m8",
		name: "Cod fillet",
		description: "Brown butter, capers, lemon",
		category: "mains",
		station: "kitchen",
		priceCents: 2450,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["fish", "dairy"],
	},
	{
		id: "d1",
		name: "Fries",
		description: "Sea salt",
		category: "sides",
		station: "kitchen",
		priceCents: 500,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: [],
	},
	{
		id: "d2",
		name: "Green salad",
		description: "Mustard dressing",
		category: "sides",
		station: "kitchen",
		priceCents: 500,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: [],
	},
	{
		id: "d3",
		name: "Potato gratin",
		description: "Cream, nutmeg",
		category: "sides",
		station: "kitchen",
		priceCents: 650,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy"],
	},
	{
		id: "d4",
		name: "Seasonal greens",
		description: "Garlic butter",
		category: "sides",
		station: "kitchen",
		priceCents: 600,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy"],
	},
	{
		id: "e1",
		name: "Crème brûlée",
		description: "Vanilla bean",
		category: "desserts",
		station: "kitchen",
		priceCents: 850,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy", "egg"],
	},
	{
		id: "e2",
		name: "Chocolate fondant",
		description: "Salted caramel ice cream",
		category: "desserts",
		station: "kitchen",
		priceCents: 900,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy", "egg", "gluten"],
	},
	{
		id: "e3",
		name: "Tarte tatin",
		description: "Crème fraîche",
		category: "desserts",
		station: "kitchen",
		priceCents: 900,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy", "gluten"],
	},
	{
		id: "e4",
		name: "Lemon posset",
		description: "Shortbread",
		category: "desserts",
		station: "kitchen",
		priceCents: 800,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy", "gluten"],
	},
	{
		id: "e5",
		name: "Cheese board",
		description: "Three cheeses, quince paste",
		category: "desserts",
		station: "kitchen",
		priceCents: 1200,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy", "nuts"],
	},
	{
		id: "b1",
		name: "House red, glass",
		description: "Grenache and syrah, 15 cl",
		category: "drinks",
		station: "bar",
		priceCents: 700,
		vatRate: ALCOHOL_VAT,
		isAvailable: true,
		allergens: ["sulphites"],
	},
	{
		id: "b2",
		name: "House white, glass",
		description: "Chenin blanc, 15 cl",
		category: "drinks",
		station: "bar",
		priceCents: 700,
		vatRate: ALCOHOL_VAT,
		isAvailable: true,
		allergens: ["sulphites"],
	},
	{
		id: "b3",
		name: "House red, bottle",
		description: "Grenache and syrah, 75 cl",
		category: "drinks",
		station: "bar",
		priceCents: 3200,
		vatRate: ALCOHOL_VAT,
		isAvailable: true,
		allergens: ["sulphites"],
	},
	{
		id: "b4",
		name: "Pale ale",
		description: "Local brewery, 33 cl",
		category: "drinks",
		station: "bar",
		priceCents: 650,
		vatRate: ALCOHOL_VAT,
		isAvailable: true,
		allergens: ["gluten"],
	},
	{
		id: "b5",
		name: "Spritz",
		description: "Bitter orange, prosecco, soda",
		category: "drinks",
		station: "bar",
		priceCents: 950,
		vatRate: ALCOHOL_VAT,
		isAvailable: true,
		allergens: ["sulphites"],
	},
	{
		id: "b6",
		name: "Sparkling water",
		description: "75 cl",
		category: "drinks",
		station: "bar",
		priceCents: 450,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: [],
	},
	{
		id: "b7",
		name: "House lemonade",
		description: "Lemon, mint, cane sugar",
		category: "drinks",
		station: "bar",
		priceCents: 500,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: [],
	},
	{
		id: "b8",
		name: "Espresso",
		description: "Single origin",
		category: "drinks",
		station: "bar",
		priceCents: 280,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: [],
	},
	{
		id: "b9",
		name: "Cappuccino",
		description: "Whole or oat milk",
		category: "drinks",
		station: "bar",
		priceCents: 420,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: ["dairy"],
	},
	{
		id: "b10",
		name: "Mint tea",
		description: "Fresh mint",
		category: "drinks",
		station: "bar",
		priceCents: 400,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: [],
	},
	{
		id: "b11",
		name: "Apple juice",
		description: "Cloudy, pressed",
		category: "drinks",
		station: "bar",
		priceCents: 450,
		vatRate: FOOD_VAT,
		isAvailable: true,
		allergens: [],
	},
];

// Minutes after the midnight that starts the business day, when the kitchen runs out of a dish with few portions.
// The rillettes go at the end of lunch, the possets during dinner. Other dishes never run out.
const SOLD_OUT_MINUTES: Partial<Record<string, number>> = {
	s6: 13 * 60 + 40,
	e4: 20 * 60 + 50,
};

/** Every menu item, in the order of the printed menu, as the kitchen opens: all available. */
export function listMenuItems(): MenuItem[] {
	return MENU_ITEMS;
}

/** False from the minute of the business day when the kitchen runs out of the item. The day plan reads it. */
export function isOnMenuAt(itemId: string, minute: number): boolean {
	const soldOutMinute = SOLD_OUT_MINUTES[itemId];
	return soldOutMinute === undefined || minute < soldOutMinute;
}

/** The menu at `minute` of the business day (businessDay of sample-orders.ts): a dish that ran out is not available. */
export function listMenuItemsAt(minute: number): MenuItem[] {
	return MENU_ITEMS.map((item) => ({
		...item,
		isAvailable: item.isAvailable && isOnMenuAt(item.id, minute),
	}));
}
