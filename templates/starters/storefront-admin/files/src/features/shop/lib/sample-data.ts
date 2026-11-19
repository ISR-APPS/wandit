// The sample tables of the shop: products, customers, orders, and order lines.
// Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every date is relative to the midnight that starts today. A seeded generator makes the same rows for the whole day.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import {
	type OrderStatus,
	PAYMENT_METHODS,
	type PaymentMethod,
	type ShippingMethod,
} from "./order-status";
import type { ProductCategory } from "./product-category";
import { HOUR_MS, MINUTE_MS, startOfLocalDay } from "./relative-time";

/** One product of the catalog. */
export type ProductRow = {
	id: string;
	name: string;
	/** The stock keeping unit, for example "PAN-OIL-500". The packing team reads it on the shelf label. */
	sku: string;
	category: ProductCategory;
	/** The price of one unit, in whole units of CURRENCY (lib/format.ts). */
	price: number;
	/** Units on the shelf now. */
	stock: number;
	/** The shop orders more units when `stock` is at or under this number. */
	reorderPoint: number;
};

/** One customer. The first order creates the row. */
export type CustomerRow = {
	id: string;
	name: string;
	email: string;
	/** The delivery address: street line, city, region code, and postal code. */
	street: string;
	city: string;
	region: string;
	postalCode: string;
	/** The time of the first order, as ISO. */
	joinedAt: string;
};

/** One order. The times are ISO texts. A step that did not happen yet is null. */
export type OrderRow = {
	/** The order number as text, for example "1042". Also the `$orderId` of the detail route. */
	id: string;
	customerId: string;
	placedAt: string;
	status: OrderStatus;
	/** The sum of the lines before the discount and the delivery fee. */
	subtotal: number;
	/** The code that the customer typed at checkout, or null. */
	discountCode: string | null;
	/** The amount that the code takes off. 0 with no code. */
	discount: number;
	shippingMethod: ShippingMethod;
	/** 0 for a standard delivery above the free delivery limit. */
	shippingFee: number;
	/** What the customer paid: subtotal minus discount plus shippingFee. */
	total: number;
	paymentMethod: PaymentMethod;
	packedAt: string | null;
	shippedAt: string | null;
	deliveredAt: string | null;
	cancelledAt: string | null;
	refundedAt: string | null;
	/** The carrier number of the parcel. null before the parcel leaves. */
	trackingNumber: string | null;
	/** A message of the customer from the checkout, or null. */
	note: string | null;
};

/** One line of an order: a product and a quantity. */
export type OrderLineRow = {
	id: string;
	orderId: string;
	productId: string;
	quantity: number;
	/** The price of one unit at the time of the order. */
	unitPrice: number;
};

/** Every sample table. Each list is in creation order; the query files sort and join them. */
export type SampleTables = {
	/** The midnight that starts today, in milliseconds since 1970. No row is newer than it. */
	dayStart: number;
	products: ProductRow[];
	customers: CustomerRow[];
	orders: OrderRow[];
	orderLines: OrderLineRow[];
};

/** A catalog entry before it gets an id. `demand` is its relative share of the order lines. */
type CatalogEntry = Omit<ProductRow, "id"> & { demand: number };

const CATALOG: CatalogEntry[] = [
	{
		name: "Arbequina olive oil",
		sku: "PAN-OIL-500",
		category: "pantry",
		price: 24,
		stock: 86,
		reorderPoint: 30,
		demand: 14,
	},
	{
		name: "Wildflower honey",
		sku: "PAN-HON-340",
		category: "pantry",
		price: 14,
		stock: 64,
		reorderPoint: 24,
		demand: 11,
	},
	{
		name: "Smoked sea salt",
		sku: "PAN-SLT-120",
		category: "pantry",
		price: 9,
		stock: 112,
		reorderPoint: 30,
		demand: 9,
	},
	{
		name: "Harissa spice blend",
		sku: "PAN-HAR-080",
		category: "pantry",
		price: 8,
		stock: 5,
		reorderPoint: 20,
		demand: 10,
	},
	{
		name: "Za'atar blend",
		sku: "PAN-ZAT-080",
		category: "pantry",
		price: 8,
		stock: 71,
		reorderPoint: 20,
		demand: 7,
	},
	{
		name: "Preserved lemons",
		sku: "PAN-LEM-300",
		category: "pantry",
		price: 12,
		stock: 38,
		reorderPoint: 16,
		demand: 6,
	},
	{
		name: "Saffron threads",
		sku: "PAN-SAF-001",
		category: "pantry",
		price: 18,
		stock: 27,
		reorderPoint: 12,
		demand: 4,
	},
	{
		name: "Fig and walnut jam",
		sku: "PAN-JAM-250",
		category: "pantry",
		price: 11,
		stock: 0,
		reorderPoint: 18,
		demand: 7,
	},
	{
		name: "Mint green tea tin",
		sku: "PAN-TEA-100",
		category: "pantry",
		price: 13,
		stock: 58,
		reorderPoint: 20,
		demand: 8,
	},
	{
		name: "Stone-ground tahini",
		sku: "PAN-TAH-300",
		category: "pantry",
		price: 12,
		stock: 44,
		reorderPoint: 16,
		demand: 6,
	},
	{
		name: "Stoneware dinner plate",
		sku: "TBL-PLT-027",
		category: "tableware",
		price: 28,
		stock: 73,
		reorderPoint: 24,
		demand: 9,
	},
	{
		name: "Stoneware pasta bowl",
		sku: "TBL-BWL-022",
		category: "tableware",
		price: 26,
		stock: 12,
		reorderPoint: 20,
		demand: 9,
	},
	{
		name: "Espresso cups, set of 2",
		sku: "TBL-ESP-002",
		category: "tableware",
		price: 32,
		stock: 35,
		reorderPoint: 12,
		demand: 6,
	},
	{
		name: "Speckled mug",
		sku: "TBL-MUG-035",
		category: "tableware",
		price: 22,
		stock: 96,
		reorderPoint: 30,
		demand: 12,
	},
	{
		name: "Serving platter",
		sku: "TBL-PLA-040",
		category: "tableware",
		price: 64,
		stock: 18,
		reorderPoint: 8,
		demand: 3,
	},
	{
		name: "Dipping bowls, set of 4",
		sku: "TBL-DIP-004",
		category: "tableware",
		price: 30,
		stock: 41,
		reorderPoint: 12,
		demand: 5,
	},
	{
		name: "Glazed tagine pot",
		sku: "TBL-TAG-028",
		category: "tableware",
		price: 88,
		stock: 6,
		reorderPoint: 6,
		demand: 2,
	},
	{
		name: "Water carafe",
		sku: "TBL-CAR-100",
		category: "tableware",
		price: 42,
		stock: 23,
		reorderPoint: 8,
		demand: 3,
	},
	{
		name: "Olive wood cutting board",
		sku: "KIT-BRD-038",
		category: "kitchen",
		price: 54,
		stock: 29,
		reorderPoint: 10,
		demand: 5,
	},
	{
		name: "Olive wood spoons, set of 3",
		sku: "KIT-SPN-003",
		category: "kitchen",
		price: 26,
		stock: 52,
		reorderPoint: 16,
		demand: 6,
	},
	{
		name: "Brass pepper mill",
		sku: "KIT-MIL-018",
		category: "kitchen",
		price: 72,
		stock: 14,
		reorderPoint: 6,
		demand: 2,
	},
	{
		name: "Granite mortar and pestle",
		sku: "KIT-MOR-014",
		category: "kitchen",
		price: 46,
		stock: 0,
		reorderPoint: 8,
		demand: 3,
	},
	{
		name: "Copper measuring cups",
		sku: "KIT-CUP-004",
		category: "kitchen",
		price: 38,
		stock: 21,
		reorderPoint: 8,
		demand: 3,
	},
	{
		name: "Hand-forged paring knife",
		sku: "KIT-KNF-009",
		category: "kitchen",
		price: 58,
		stock: 17,
		reorderPoint: 6,
		demand: 2,
	},
	{
		name: "Ceramic oil cruet",
		sku: "KIT-CRU-250",
		category: "kitchen",
		price: 34,
		stock: 33,
		reorderPoint: 10,
		demand: 4,
	},
	{
		name: "Linen apron",
		sku: "LIN-APR-001",
		category: "linen",
		price: 48,
		stock: 26,
		reorderPoint: 10,
		demand: 4,
	},
	{
		name: "Linen tea towels, set of 2",
		sku: "LIN-TWL-002",
		category: "linen",
		price: 24,
		stock: 7,
		reorderPoint: 18,
		demand: 8,
	},
	{
		name: "Linen tablecloth",
		sku: "LIN-TBC-240",
		category: "linen",
		price: 96,
		stock: 11,
		reorderPoint: 4,
		demand: 2,
	},
	{
		name: "Linen napkins, set of 4",
		sku: "LIN-NAP-004",
		category: "linen",
		price: 36,
		stock: 48,
		reorderPoint: 14,
		demand: 5,
	},
	{
		name: "Cotton market tote",
		sku: "LIN-TOT-001",
		category: "linen",
		price: 18,
		stock: 77,
		reorderPoint: 20,
		demand: 6,
	},
	{
		name: "Amber and cedar candle",
		sku: "HOM-CND-AMB",
		category: "home",
		price: 32,
		stock: 54,
		reorderPoint: 16,
		demand: 7,
	},
	{
		name: "Orange blossom candle",
		sku: "HOM-CND-ORA",
		category: "home",
		price: 32,
		stock: 11,
		reorderPoint: 16,
		demand: 7,
	},
	{
		name: "Fig leaf candle",
		sku: "HOM-CND-FIG",
		category: "home",
		price: 32,
		stock: 39,
		reorderPoint: 16,
		demand: 5,
	},
	{
		name: "Terracotta incense holder",
		sku: "HOM-INC-001",
		category: "home",
		price: 20,
		stock: 62,
		reorderPoint: 14,
		demand: 4,
	},
	{
		name: "Woven bread basket",
		sku: "HOM-BSK-026",
		category: "home",
		price: 38,
		stock: 19,
		reorderPoint: 8,
		demand: 3,
	},
	{
		name: "Beeswax tapers, pair",
		sku: "HOM-TPR-002",
		category: "home",
		price: 16,
		stock: 83,
		reorderPoint: 24,
		demand: 6,
	},
];

// 132 first names and 132 last names. customerName pairs them so that no full name occurs two times.
const FIRST_NAMES = [
	"Maya",
	"Daniel",
	"Priya",
	"Tomas",
	"Aisha",
	"Lucas",
	"Ingrid",
	"Mateo",
	"Chloe",
	"Kwame",
	"Elena",
	"Rafael",
	"Naomi",
	"Viktor",
	"Leila",
	"Oscar",
	"Hana",
	"Julien",
	"Amara",
	"Felix",
	"Sofia",
	"Idris",
	"Clara",
	"Nikolai",
	"Yuki",
	"Gabriel",
	"Fatima",
	"Anton",
	"Zoe",
	"Emeka",
	"Lucia",
	"Henrik",
	"Nadia",
	"Marco",
	"Tessa",
	"Rohan",
	"Freya",
	"Diego",
	"Imani",
	"Stefan",
	"Alma",
	"Kenji",
	"Beatrice",
	"Omar",
	"Selma",
	"Callum",
	"Mirela",
	"Andre",
	"Sienna",
	"Tariq",
	"Greta",
	"Pablo",
	"Anika",
	"Bruno",
	"Esme",
	"Darius",
	"Paloma",
	"Jasper",
	"Noor",
	"Luca",
	"Maren",
	"Cyrus",
	"Odette",
	"Ravi",
	"Linnea",
	"Hugo",
	"Amina",
	"Elias",
	"Carys",
	"Joaquin",
	"Thea",
	"Samir",
	"Vera",
	"Nolan",
	"Zara",
	"Emil",
	"Dalia",
	"Tobias",
	"Ines",
	"Kofi",
	"Marta",
	"Arjun",
	"Signe",
	"Leon",
	"Farah",
	"Mikkel",
	"Rosa",
	"Dmitri",
	"Ayla",
	"Cormac",
	"Lena",
	"Bashir",
	"Elodie",
	"Magnus",
	"Tamsin",
	"Enzo",
	"Suki",
	"Wyatt",
	"Petra",
	"Malik",
	"Astrid",
	"Ruben",
	"Kiona",
	"Silas",
	"Mina",
	"Otto",
	"Renata",
	"Jude",
	"Halima",
	"Ansel",
	"Corinne",
	"Teo",
	"Yara",
	"Lars",
	"Bianca",
	"Ezra",
	"Salome",
	"Niall",
	"Opal",
	"Rhys",
	"Delphine",
	"Kai",
	"Marisol",
	"Abel",
	"Wren",
	"Soren",
	"Ilse",
	"Dante",
	"Liv",
	"Amos",
	"Josefina",
	"Idun",
];

const LAST_NAMES = [
	"Alvarez",
	"Bergman",
	"Castillo",
	"Dalton",
	"Eklund",
	"Faraday",
	"Greene",
	"Halloran",
	"Iwasaki",
	"Jansen",
	"Kessler",
	"Lombardi",
	"Mercer",
	"Nakata",
	"Oduya",
	"Pemberton",
	"Quintero",
	"Rosales",
	"Sandoval",
	"Tran",
	"Underhill",
	"Voss",
	"Whitaker",
	"Yamada",
	"Zimmer",
	"Abbasi",
	"Brandt",
	"Cardenas",
	"Devlin",
	"Esposito",
	"Flores",
	"Gauthier",
	"Hargrove",
	"Ibarra",
	"Jovanovic",
	"Kimura",
	"Laurent",
	"Mahlangu",
	"Nasser",
	"Ortega",
	"Pavlov",
	"Quaye",
	"Romero",
	"Sato",
	"Tiwari",
	"Urquhart",
	"Valdez",
	"Wolfe",
	"Xavier",
	"Yoon",
	"Zubiri",
	"Adler",
	"Bakker",
	"Coelho",
	"Dimitrov",
	"Ekwueme",
	"Falk",
	"Gordon",
	"Hale",
	"Ito",
	"Joshi",
	"Kovac",
	"Lund",
	"Mendes",
	"Ndlovu",
	"Olsen",
	"Papadakis",
	"Reinholt",
	"Soto",
	"Tobin",
	"Usman",
	"Vance",
	"Weller",
	"Yeo",
	"Zeller",
	"Amato",
	"Boyle",
	"Cruz",
	"Dorsey",
	"Ellery",
	"Fujita",
	"Grimaldi",
	"Holt",
	"Ismail",
	"Jarvis",
	"Keane",
	"Lindqvist",
	"Morales",
	"Novotny",
	"Oyama",
	"Prescott",
	"Rao",
	"Sinclair",
	"Thorne",
	"Ulloa",
	"Verma",
	"Winters",
	"Yates",
	"Zapata",
	"Arden",
	"Becker",
	"Conti",
	"Duarte",
	"Emery",
	"Fairbanks",
	"Gallo",
	"Hendry",
	"Imai",
	"Jorgensen",
	"Khoury",
	"Landry",
	"Maddox",
	"Nieves",
	"Okoro",
	"Pike",
	"Ramsey",
	"Shah",
	"Teague",
	"Umar",
	"Vidal",
	"Wexler",
	"Yarrow",
	"Zane",
	"Ambrose",
	"Barlow",
	"Cobb",
	"Drake",
	"Eastman",
	"Finch",
	"Garza",
	"Hyde",
	"Ingram",
];

// Reserved test domains: no real mailbox has such an address.
const EMAIL_DOMAINS = ["postbox.example", "mailhaven.example", "inbox.example"];

// Street names with no real place behind them.
const STREETS = [
	"Alder Lane",
	"Juniper Court",
	"Marigold Street",
	"Quarry Road",
	"Saltbox Way",
	"Thistle Avenue",
	"Copperfield Drive",
	"Lantern Row",
	"Millrace Lane",
	"Orchard Bend",
	"Pinewater Road",
	"Sparrow Hill",
	"Tannery Street",
	"Wren Close",
	"Foxglove Terrace",
	"Harbor View Road",
	"Ironwood Avenue",
	"Kestrel Way",
	"Larkspur Lane",
	"Meadowlark Drive",
	"Nettle Street",
	"Old Ferry Road",
	"Primrose Court",
	"Redstone Avenue",
	"Sycamore Row",
	"Tidewater Lane",
	"Vineyard Path",
	"Willowbrook Drive",
	"Cedar Hollow Road",
	"Bramble Street",
];

const CITIES: { city: string; region: string }[] = [
	{ city: "Portland", region: "OR" },
	{ city: "Austin", region: "TX" },
	{ city: "Asheville", region: "NC" },
	{ city: "Denver", region: "CO" },
	{ city: "Madison", region: "WI" },
	{ city: "Savannah", region: "GA" },
	{ city: "Providence", region: "RI" },
	{ city: "Boise", region: "ID" },
	{ city: "Santa Fe", region: "NM" },
	{ city: "Burlington", region: "VT" },
	{ city: "Minneapolis", region: "MN" },
	{ city: "Pittsburgh", region: "PA" },
	{ city: "Sacramento", region: "CA" },
	{ city: "Richmond", region: "VA" },
	{ city: "Tucson", region: "AZ" },
	{ city: "Ann Arbor", region: "MI" },
	{ city: "Chattanooga", region: "TN" },
	{ city: "Salt Lake City", region: "UT" },
	{ city: "Bellingham", region: "WA" },
	{ city: "Louisville", region: "KY" },
	{ city: "Omaha", region: "NE" },
	{ city: "Charleston", region: "SC" },
	{ city: "Albany", region: "NY" },
	{ city: "Columbus", region: "OH" },
	{ city: "Eugene", region: "OR" },
	{ city: "Spokane", region: "WA" },
	{ city: "Duluth", region: "MN" },
	{ city: "Lexington", region: "KY" },
	{ city: "Durham", region: "NC" },
	{ city: "Tulsa", region: "OK" },
	{ city: "Fort Collins", region: "CO" },
	{ city: "Missoula", region: "MT" },
	{ city: "Ithaca", region: "NY" },
	{ city: "Des Moines", region: "IA" },
	{ city: "Lancaster", region: "PA" },
	{ city: "Flagstaff", region: "AZ" },
];

const NOTES = [
	"It is a gift. Please do not put the receipt in the parcel.",
	"Please leave the parcel with the neighbor at number 12 if nobody is home.",
	"The doorbell does not work. Please knock.",
	"Please pack each item with extra paper. The last parcel arrived with a broken box.",
	"Can you add a gift note that says: Happy new home, from Lena.",
	"Delivery after 5 pm is best.",
	"Please ship all items in one parcel.",
	"This is for a dinner on Saturday. Thank you for a fast delivery.",
];

/** The discount codes of the checkout and the share of the subtotal that each one takes off. */
const DISCOUNT_RATES = { HARVEST20: 0.2, WELCOME10: 0.1 } as const;

// A fixed seed: the generator gives the same numbers on each run.
const SEED = 4242;
/** The shop opened this many days ago. The first sample order is of that day. */
const HISTORY_DAYS = 180;
// Orders per day: at the opening, and now. The shop grows between the two.
const OPENING_RATE = 2.6;
const CURRENT_RATE = 6.4;
// Sunday to Saturday. Online orders are highest from Sunday to Tuesday.
const WEEKDAY_FACTORS = [1.25, 1.15, 1.05, 0.9, 0.85, 0.8, 1.0];
// The Harvest sale: seven days, 16 to 22 days ago. More orders, and many of them use the sale code.
const SALE_FIRST_DAYS_AGO = 22;
const SALE_LAST_DAYS_AGO = 16;
const SALE_ORDER_FACTOR = 1.5;
// The share of orders from a new customer: nine in ten at the opening, about half now.
const NEW_SHARE_OPENING = 0.9;
const NEW_SHARE_NOW = 0.45;
// The fewest days between two orders of one customer.
const REORDER_GAP_DAYS = 6;
const FIRST_ORDER_NUMBER = 1001;
// Delivery fees in CURRENCY. A standard delivery is free from this order value.
const STANDARD_FEE = 6;
const EXPRESS_FEE = 14;
const FREE_DELIVERY_FROM = 75;

// The full name of customer `index`. The first name changes on each row, so neighbours never share it.
// The last name moves 37 places per row and one more place per round of first names.
// The pair stays unique for 132 x 132 customers.
function customerName(index: number): string {
	const round = Math.floor(index / FIRST_NAMES.length);
	return `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 37 + round) % LAST_NAMES.length]}`;
}

/** The mulberry32 generator: a function that returns the next number in [0, 1). */
function createRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

// A number in [min, max).
function between(random: () => number, min: number, max: number): number {
	return min + random() * (max - min);
}

// The index of one weight, picked with a chance in proportion to its value.
function pickWeighted(random: () => number, weights: number[]): number {
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	let roll = random() * total;
	for (let index = 0; index < weights.length; index += 1) {
		roll -= weights[index] ?? 0;
		if (roll < 0) {
			return index;
		}
	}
	return weights.length - 1;
}

// The minute of the day of one order. Most orders come at lunch and in the evening.
function orderMinute(random: () => number): number {
	const roll = random();
	const [fromHour, toHour] =
		roll < 0.12
			? [7, 11]
			: roll < 0.4
				? [11, 15]
				: roll < 0.55
					? [15, 18]
					: roll < 0.95
						? [18, 23.5]
						: [0, 7];
	return Math.floor(between(random, fromHour * 60, toHour * 60));
}

// Moves a time into the working day (8:00 to 18:00): the team packs, and the carrier collects, only then.
function toWorkingHours(ms: number, random: () => number): number {
	const date = new Date(ms);
	const hour = date.getHours();
	if (hour >= 8 && hour < 18) {
		return ms;
	}
	if (hour >= 18) {
		date.setDate(date.getDate() + 1);
	}
	date.setHours(8, Math.floor(between(random, 0, 150)), 0, 0);
	return date.getTime();
}

/** A customer while the generator runs: the row index, and how the person orders again. */
type Shopper = {
	/** The relative chance that this customer places the next repeat order. */
	loyalty: number;
	/** The customer orders until this count of days before today. 0: the customer still orders. */
	activeUntilDaysAgo: number;
	orderCount: number;
	/** The day of the newest order, as a count of days before today. */
	lastOrderDaysAgo: number;
};

// Builds every table for the day that starts at `dayStart`. The newest order is of yesterday.
function buildTables(dayStart: number): SampleTables {
	const random = createRandom(SEED);
	const products: ProductRow[] = CATALOG.map((entry, index) => ({
		id: `prod-${String(index + 1).padStart(2, "0")}`,
		name: entry.name,
		sku: entry.sku,
		category: entry.category,
		price: entry.price,
		stock: entry.stock,
		reorderPoint: entry.reorderPoint,
	}));
	const demand = CATALOG.map((entry) => entry.demand);
	const customers: CustomerRow[] = [];
	const shoppers: Shopper[] = [];
	const orders: OrderRow[] = [];
	const orderLines: OrderLineRow[] = [];
	// An event after this midnight did not happen yet, so its time stays null.
	const reached = (ms: number): string | null =>
		ms < dayStart ? new Date(ms).toISOString() : null;

	for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
		const day = new Date(dayStart);
		// setDate keeps the calendar day across a clock change.
		day.setDate(day.getDate() - daysAgo);
		const midnight = day.getTime();
		// 0 on the opening day, 1 yesterday.
		const progress = 1 - daysAgo / HISTORY_DAYS;
		const isSale =
			daysAgo <= SALE_FIRST_DAYS_AGO && daysAgo >= SALE_LAST_DAYS_AGO;
		const rate =
			(OPENING_RATE + (CURRENT_RATE - OPENING_RATE) * progress) *
			(WEEKDAY_FACTORS[day.getDay()] ?? 1) *
			(isSale ? SALE_ORDER_FACTOR : 1) *
			between(random, 0.75, 1.25);
		const minutes = Array.from({ length: Math.max(1, Math.round(rate)) }, () =>
			orderMinute(random),
		).sort((first, second) => first - second);

		for (const minute of minutes) {
			const placedMs = midnight + minute * MINUTE_MS;
			const orderId = String(FIRST_ORDER_NUMBER + orders.length);

			// The customer: a new one, or one that still orders.
			// A customer does not order again in the same week: the pantry of the last parcel is still full.
			const repeatWeights = shoppers.map((shopper) =>
				shopper.activeUntilDaysAgo <= daysAgo &&
				shopper.lastOrderDaysAgo - daysAgo >= REORDER_GAP_DAYS
					? shopper.loyalty
					: 0,
			);
			const newShare =
				NEW_SHARE_NOW +
				(NEW_SHARE_OPENING - NEW_SHARE_NOW) * (1 - progress) ** 4;
			const isNew =
				customers.length < FIRST_NAMES.length * LAST_NAMES.length &&
				(repeatWeights.every((weight) => weight === 0) || random() < newShare);
			if (isNew) {
				const index = customers.length;
				const name = customerName(index);
				// 7 and the 36 cities share no factor, so 36 customers in a row live in 36 different cities.
				const place = CITIES[(index * 7) % CITIES.length];
				const loyaltyRoll = random();
				// About one customer in five stops after some weeks. The customer page shows them as lapsed.
				const stopsAfterDays =
					random() < 0.22 ? Math.floor(between(random, 8, 45)) : null;
				customers.push({
					id: `cus-${String(index + 1).padStart(3, "0")}`,
					name,
					email: `${name.toLowerCase().replace(" ", ".")}@${EMAIL_DOMAINS[index % EMAIL_DOMAINS.length]}`,
					street: `${Math.floor(between(random, 12, 980))} ${STREETS[Math.floor(random() * STREETS.length)]}`,
					city: place?.city ?? "",
					region: place?.region ?? "",
					postalCode: String(Math.floor(between(random, 10_000, 99_000))),
					joinedAt: new Date(placedMs).toISOString(),
				});
				shoppers.push({
					loyalty: loyaltyRoll < 0.55 ? 1 : loyaltyRoll < 0.9 ? 2 : 3,
					activeUntilDaysAgo:
						stopsAfterDays === null ? 0 : Math.max(0, daysAgo - stopsAfterDays),
					orderCount: 0,
					lastOrderDaysAgo: daysAgo,
				});
			}
			const customerIndex = isNew
				? customers.length - 1
				: pickWeighted(random, repeatWeights);
			const customer = customers[customerIndex];
			const shopper = shoppers[customerIndex];
			if (!customer || !shopper) {
				continue;
			}

			// The lines: 1 to 4 different products, 1 to 3 units each.
			const lineCount = 1 + pickWeighted(random, [34, 36, 20, 10]);
			const productIndexes = new Set<number>();
			while (productIndexes.size < lineCount) {
				productIndexes.add(pickWeighted(random, demand));
			}
			let subtotal = 0;
			for (const productIndex of productIndexes) {
				const product = products[productIndex];
				if (!product) {
					continue;
				}
				const quantityRoll = random();
				const quantity = quantityRoll < 0.68 ? 1 : quantityRoll < 0.92 ? 2 : 3;
				orderLines.push({
					id: `${orderId}-${orderLines.length + 1}`,
					orderId,
					productId: product.id,
					quantity,
					unitPrice: product.price,
				});
				subtotal += quantity * product.price;
			}

			// The sale code in the sale week, or the welcome code on a first order.
			const discountCode: keyof typeof DISCOUNT_RATES | null =
				isSale && random() < 0.55
					? "HARVEST20"
					: shopper.orderCount === 0 && random() < 0.4
						? "WELCOME10"
						: null;
			const discount = discountCode
				? Math.round(subtotal * DISCOUNT_RATES[discountCode])
				: 0;
			const shippingMethod: ShippingMethod =
				random() < 0.18 ? "express" : "standard";
			const shippingFee =
				shippingMethod === "express"
					? EXPRESS_FEE
					: subtotal - discount >= FREE_DELIVERY_FROM
						? 0
						: STANDARD_FEE;
			// Card, wallet, bank transfer: the weights follow the order of PAYMENT_METHODS.
			const paymentMethod = PAYMENT_METHODS[pickWeighted(random, [68, 24, 8])];

			// The fulfilment plan. An express order is packed first. A few standard orders wait days for an item.
			const isExpress = shippingMethod === "express";
			const waitsForStock = !isExpress && random() < 0.05;
			const packedMs = toWorkingHours(
				placedMs +
					(isExpress ? between(random, 1, 6) : between(random, 4, 30)) *
						HOUR_MS +
					(waitsForStock ? between(random, 60, 110) * HOUR_MS : 0),
				random,
			);
			const shippedMs = toWorkingHours(
				packedMs +
					(isExpress ? between(random, 1, 4) : between(random, 2, 18)) *
						HOUR_MS,
				random,
			);
			const deliveredMs = toWorkingHours(
				shippedMs +
					(isExpress ? between(random, 20, 44) : between(random, 48, 120)) *
						HOUR_MS,
				random,
			);
			const cancelRoll = random();
			const refundRoll = random();
			const cancelledAt =
				cancelRoll < 0.025
					? reached(placedMs + between(random, 20, 240) * MINUTE_MS)
					: null;
			const packedAt = cancelledAt ? null : reached(packedMs);
			const shippedAt = packedAt ? reached(shippedMs) : null;
			const deliveredAt = shippedAt ? reached(deliveredMs) : null;
			const refundedAt =
				deliveredAt && refundRoll < 0.04
					? reached(
							toWorkingHours(
								deliveredMs + between(random, 48, 216) * HOUR_MS,
								random,
							),
						)
					: null;
			const trackingDigits = () =>
				String(Math.floor(between(random, 100, 1000)));
			const trackingNumber = `TRK-${trackingDigits()}-${trackingDigits()}-${trackingDigits()}`;
			const noteRoll = random();
			const note = NOTES[Math.floor(random() * NOTES.length)] ?? null;

			orders.push({
				id: orderId,
				customerId: customer.id,
				placedAt: new Date(placedMs).toISOString(),
				status: cancelledAt
					? "cancelled"
					: refundedAt
						? "refunded"
						: deliveredAt
							? "delivered"
							: shippedAt
								? "shipped"
								: "to_ship",
				subtotal,
				discountCode,
				discount,
				shippingMethod,
				shippingFee,
				total: subtotal - discount + shippingFee,
				paymentMethod: paymentMethod ?? "card",
				packedAt,
				shippedAt,
				deliveredAt,
				cancelledAt,
				refundedAt,
				trackingNumber: shippedAt ? trackingNumber : null,
				note: noteRoll < 0.1 ? note : null,
			});
			shopper.orderCount += 1;
			shopper.lastOrderDaysAgo = daysAgo;
		}
	}
	return { dayStart, products, customers, orders, orderLines };
}

// The tables of the current day. A new day builds them again.
let cache: SampleTables | null = null;

/** Every sample table, the same rows for the whole local day of `now` (milliseconds since 1970). */
export function getSampleTables(now: number = Date.now()): SampleTables {
	const dayStart = startOfLocalDay(now);
	if (cache?.dayStart !== dayStart) {
		cache = buildTables(dayStart);
	}
	return cache;
}
