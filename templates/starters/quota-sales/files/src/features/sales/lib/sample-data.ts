// The sample tables of the sales board: territories, reps, accounts, orders with their lines, and quarter targets.
// Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// A seeded generator makes the orders of each calendar date, so a date keeps the same orders on every visit.
// The tables end yesterday: the board shows closed days, so the counts do not move during the day.
import {
	type Quarter,
	quarterOfDay,
	shiftQuarter,
	weekdayOf,
} from "./calendar";

/** The product lines that the team sells. The labels are the message keys `productLines.<id>`. */
export const PRODUCT_LINES = [
	"terminals",
	"licenses",
	"installation",
	"support",
	"training",
] as const;

/** One product line. */
export type ProductLine = (typeof PRODUCT_LINES)[number];

/** The kinds of customer business. The labels are the message keys `segments.<id>`. */
export const ACCOUNT_SEGMENTS = [
	"restaurant",
	"cafe",
	"retail",
	"grocery",
	"pharmacy",
	"hotel",
	"salon",
] as const;

/** One kind of customer business. */
export type AccountSegment = (typeof ACCOUNT_SEGMENTS)[number];

/** The job titles of the team. The labels are the message keys `roles.<id>`. */
export const REP_ROLES = ["lead", "senior", "executive"] as const;

/** One job title. */
export type RepRole = (typeof REP_ROLES)[number];

/** One sales territory. Each rep belongs to one territory. */
export type TerritoryRow = { id: string; name: string };

/** One sales rep. */
export type RepRow = {
	id: string;
	name: string;
	territoryId: string;
	role: RepRole;
	email: string;
	/** Days between the start date and today. */
	tenureDays: number;
};

/** One customer account. Its owner is the rep that books its orders. */
export type AccountRow = {
	id: string;
	name: string;
	segment: AccountSegment;
	territoryId: string;
	ownerId: string;
};

/** One line of an order. `amount` is quantity times unitPrice, in whole units of CURRENCY. */
export type OrderLineRow = {
	productLine: ProductLine;
	quantity: number;
	unitPrice: number;
	amount: number;
};

/** One booked order. */
export type OrderRow = {
	id: string;
	/** The order number that the team reads, for example "SO-332336". */
	number: string;
	accountId: string;
	repId: string;
	/** The day number of the booking (calendar.ts). */
	day: number;
	/** Minutes after local midnight of `day`. */
	minutes: number;
	/** 1 to 3 lines, each of another product line. */
	lines: OrderLineRow[];
	/** The sum of the line amounts. */
	amount: number;
	/** A cancelled order counts in no booking total. */
	isCancelled: boolean;
	/** 0 to 2 extra days in each fulfilment step. The order status reads it. */
	delayDays: number;
};

/** The booking target of one rep for one quarter, in whole units of CURRENCY. */
export type TargetRow = {
	repId: string;
	quarterStartDay: number;
	amount: number;
};

/** Every sample table, for the day `today`. The orders end yesterday and start with the oldest quarter of `targets`. */
export type SampleTables = {
	/** The day number of the day that the tables were built for. */
	today: number;
	territories: TerritoryRow[];
	reps: RepRow[];
	accounts: AccountRow[];
	/** Oldest first. */
	orders: OrderRow[];
	targets: TargetRow[];
};

/** How many quarters before the current one keep their orders and targets. The rep page shows them. */
export const HISTORY_QUARTERS = 4;

const TERRITORIES: TerritoryRow[] = [
	{ id: "northeast", name: "Northeast" },
	{ id: "southeast", name: "Southeast" },
	{ id: "great-lakes", name: "Great Lakes" },
	{ id: "central", name: "Central Plains" },
	{ id: "pacific", name: "Pacific" },
];

// `weight` is the share of the team volume. `planBias` sets the target against the volume:
// above 1 the target is high, so the rep runs behind; below 1 the rep runs ahead.
const REP_SEEDS: (Omit<RepRow, "email"> & {
	weight: number;
	planBias: number;
})[] = [
	{
		id: "amara-okafor",
		name: "Amara Okafor",
		territoryId: "northeast",
		role: "lead",
		tenureDays: 2140,
		weight: 1.35,
		planBias: 0.86,
	},
	{
		id: "daniel-reyes",
		name: "Daniel Reyes",
		territoryId: "northeast",
		role: "executive",
		tenureDays: 610,
		weight: 0.85,
		planBias: 1.04,
	},
	{
		id: "hana-kowalski",
		name: "Hana Kowalski",
		territoryId: "northeast",
		role: "senior",
		tenureDays: 1320,
		weight: 1.05,
		planBias: 0.97,
	},
	{
		id: "lucia-moreno",
		name: "Lucia Moreno",
		territoryId: "southeast",
		role: "lead",
		tenureDays: 1880,
		weight: 1.2,
		planBias: 0.93,
	},
	{
		id: "theo-bannister",
		name: "Theo Bannister",
		territoryId: "southeast",
		role: "executive",
		tenureDays: 540,
		weight: 0.8,
		planBias: 1.16,
	},
	{
		id: "grace-adeyemi",
		name: "Grace Adeyemi",
		territoryId: "southeast",
		role: "senior",
		tenureDays: 1010,
		weight: 1.1,
		planBias: 0.88,
	},
	{
		id: "jonas-lindqvist",
		name: "Jonas Lindqvist",
		territoryId: "great-lakes",
		role: "lead",
		tenureDays: 2460,
		weight: 1.15,
		planBias: 1.0,
	},
	{
		id: "mei-tanaka",
		name: "Mei Tanaka",
		territoryId: "great-lakes",
		role: "senior",
		tenureDays: 1190,
		weight: 1.0,
		planBias: 0.91,
	},
	{
		id: "owen-fitzgerald",
		name: "Owen Fitzgerald",
		territoryId: "great-lakes",
		role: "executive",
		tenureDays: 700,
		weight: 0.75,
		planBias: 1.12,
	},
	{
		id: "salma-haddad",
		name: "Salma Haddad",
		territoryId: "central",
		role: "lead",
		tenureDays: 1650,
		weight: 1.25,
		planBias: 0.95,
	},
	{
		id: "marcus-webb",
		name: "Marcus Webb",
		territoryId: "central",
		role: "executive",
		tenureDays: 820,
		weight: 0.9,
		planBias: 1.08,
	},
	{
		id: "ruben-castillo",
		name: "Ruben Castillo",
		territoryId: "pacific",
		role: "lead",
		tenureDays: 1970,
		weight: 1.15,
		planBias: 1.02,
	},
	{
		id: "nora-ellison",
		name: "Nora Ellison",
		territoryId: "pacific",
		role: "senior",
		tenureDays: 1430,
		weight: 1.05,
		planBias: 0.9,
	},
	{
		id: "priya-raman",
		name: "Priya Raman",
		territoryId: "pacific",
		role: "executive",
		tenureDays: 560,
		weight: 0.85,
		planBias: 1.06,
	},
];

// 33 accounts per territory, 24 in Central Plains: about 11 or 12 per rep. The owners follow the order of REP_SEEDS in the territory, in turn.
const ACCOUNT_SEEDS: Record<string, [string, AccountSegment][]> = {
	northeast: [
		["Harborview Bistro", "restaurant"],
		["Copperline Hardware", "retail"],
		["Maple & Rye Bakery", "cafe"],
		["Saltmarsh Grocers", "grocery"],
		["Beaconfield Pharmacy", "pharmacy"],
		["Tidewater Inn", "hotel"],
		["Granite Bay Outfitters", "retail"],
		["Lantern Hall Salon", "salon"],
		["Quarry Hill Pizzeria", "restaurant"],
		["Bluefin Fish Market", "grocery"],
		["Old Mill Tea Room", "cafe"],
		["Northgate Pet Supply", "retail"],
		["Cobblestone Diner", "restaurant"],
		["Pinecrest Cafe", "cafe"],
		["Lighthouse Point Motel", "hotel"],
		["Fairhaven Florist", "retail"],
		["Wharf Street Oyster House", "restaurant"],
		["Elm Row Barbers", "salon"],
		["Ashford Corner Market", "grocery"],
		["Kestrel Books & Prints", "retail"],
		["Brightwater Apothecary", "pharmacy"],
		["Seacliff Guest House", "hotel"],
		["Driftstone Coffee", "cafe"],
		["Hollow Oak Tavern", "restaurant"],
		["Millbrook Wine & Cheese", "retail"],
		["Laurel Lane Nails", "salon"],
		["Briarwood Deli", "restaurant"],
		["Stonewall Cycle Shop", "retail"],
		["Ninth Street Clam Shack", "restaurant"],
		["Redbrick Bagel Co.", "cafe"],
		["Thornbury Natural Foods", "grocery"],
		["Whitecap Surf & Sport", "retail"],
		["Glenmoor Family Pharmacy", "pharmacy"],
	],
	southeast: [
		["Magnolia Table", "restaurant"],
		["Palmetto Market", "grocery"],
		["Cypress & Pine Supply", "retail"],
		["Sweetgrass Cafe", "cafe"],
		["Riverbend Apothecary", "pharmacy"],
		["Coral Key Resort", "hotel"],
		["Orchard Lane Boutique", "retail"],
		["Bayou Cut Studio", "salon"],
		["Live Oak Smokehouse", "restaurant"],
		["Sandpiper Motel", "hotel"],
		["Honeybell Bakery", "cafe"],
		["Gulfside Garden Center", "retail"],
		["Peach Street Diner", "restaurant"],
		["Blackwater Grocery", "grocery"],
		["Spanish Moss Inn", "hotel"],
		["Pelican Pier Bait & Tackle", "retail"],
		["Low Country Pharmacy", "pharmacy"],
		["Camellia Day Spa", "salon"],
		["Dockside Crab House", "restaurant"],
		["Okra & Vine Kitchen", "restaurant"],
		["Saltwater Taffy Shop", "retail"],
		["Hammock Bay Lodge", "hotel"],
		["Heron Point Coffee", "cafe"],
		["Red Clay Hardware", "retail"],
		["Wisteria Salon", "salon"],
		["Kudzu Corner Market", "grocery"],
		["Creekside Biscuit Co.", "cafe"],
		["Sea Oats Gift Shop", "retail"],
		["Marsh Hen Oyster Bar", "restaurant"],
		["Indigo Row Pharmacy", "pharmacy"],
		["Lantana Beach Hotel", "hotel"],
		["Fig Tree Farm Stand", "grocery"],
		["Jasmine Street Books", "retail"],
	],
	"great-lakes": [
		["Lakeshore Brewhouse", "restaurant"],
		["Ironworks Deli", "restaurant"],
		["North Pier Books", "retail"],
		["Birchwood Foods", "grocery"],
		["Ledgeview Pharmacy", "pharmacy"],
		["Elmstead Lodge", "hotel"],
		["Prairie Thread Co.", "retail"],
		["Foundry Barbers", "salon"],
		["Walleye Bay Tavern", "restaurant"],
		["Kettle Corner Cafe", "cafe"],
		["Harbor Point Hardware", "retail"],
		["Stonebridge Wellness", "pharmacy"],
		["Cherry Lane Creamery", "cafe"],
		["Freighter's Rest Inn", "hotel"],
		["Dune Grass Outfitters", "retail"],
		["Two Rivers Market", "grocery"],
		["Lakeview Supper Club", "restaurant"],
		["Ironwood Pharmacy", "pharmacy"],
		["Copper Kettle Fudge", "retail"],
		["Brickyard Pizza", "restaurant"],
		["Northwind Salon", "salon"],
		["Lighthouse Lane Coffee", "cafe"],
		["Spoke & Sprocket Bikes", "retail"],
		["Oakhaven Motor Inn", "hotel"],
		["Riverside Butcher Block", "grocery"],
		["Maplewood Toy Chest", "retail"],
		["Sandbar Fish Fry", "restaurant"],
		["Lantern Pharmacy & Gifts", "pharmacy"],
		["Willow Creek Hair Studio", "salon"],
		["Rust Belt Records", "retail"],
		["Danube Pierogi Kitchen", "restaurant"],
		["Granary Bakehouse", "cafe"],
		["Trillium Natural Grocer", "grocery"],
	],
	central: [
		["Red Mesa Grill", "restaurant"],
		["Wheatland Co-op", "grocery"],
		["Bluestem Coffee", "cafe"],
		["High Plains Feed & Tack", "retail"],
		["Sagebrush Pharmacy", "pharmacy"],
		["Cottonwood Suites", "hotel"],
		["Juniper Row Salon", "salon"],
		["Sunflower Toy Shop", "retail"],
		["Prairie Fire Pizza", "restaurant"],
		["Windmill Market", "grocery"],
		["Big Sky Boot Co.", "retail"],
		["Silver Creek Inn", "hotel"],
		["Dust Bowl Diner", "restaurant"],
		["Tallgrass Books", "retail"],
		["Meadowlark Bakery", "cafe"],
		["Grain Elevator Taproom", "restaurant"],
		["Buffalo Ridge Pharmacy", "pharmacy"],
		["Prairie Rose Motel", "hotel"],
		["Two Forks Hardware", "retail"],
		["Redbud Salon & Spa", "salon"],
		["Harvest Moon Grocery", "grocery"],
		["Barbed Wire BBQ", "restaurant"],
		["Plains Drug & Gift", "pharmacy"],
		["Cattle Drive Western Wear", "retail"],
	],
	pacific: [
		["Cedar & Smoke Kitchen", "restaurant"],
		["Driftwood Coffee Roasters", "cafe"],
		["Evergreen Natural Foods", "grocery"],
		["Fernhill Pharmacy", "pharmacy"],
		["Summit Ridge Lodge", "hotel"],
		["Cascade Cycle Works", "retail"],
		["Tidepool Surf Shop", "retail"],
		["Mossgrove Spa", "salon"],
		["Salt & Cedar Oyster Bar", "restaurant"],
		["Hillside Organics", "grocery"],
		["Kelp Forest Kayaks", "retail"],
		["Bramble Tea House", "cafe"],
		["Foghorn Fish & Chips", "restaurant"],
		["Redwood Hollow Inn", "hotel"],
		["Sea Glass Gallery", "retail"],
		["Sourdough Corner Bakery", "cafe"],
		["Golden Hill Pharmacy", "pharmacy"],
		["Avocado Grove Market", "grocery"],
		["Basalt Climbing Supply", "retail"],
		["Marigold Taqueria", "restaurant"],
		["Rain City Barbers", "salon"],
		["Sitka Spruce Lodge", "hotel"],
		["Huckleberry Cafe", "cafe"],
		["Orca Bay Market", "grocery"],
		["Cliffside Wine Bar", "restaurant"],
		["Manzanita Day Spa", "salon"],
		["Coastline Pharmacy", "pharmacy"],
		["Ferry Landing Books", "retail"],
		["Pinnacle Ski & Board", "retail"],
		["Kombu Ramen House", "restaurant"],
		["Seabreeze Motel", "hotel"],
		["Fiddlehead Coffee Bar", "cafe"],
		["Lupine Farm Grocer", "grocery"],
	],
};

/**
 * List price and quantity range of each product line. Prices are whole units of CURRENCY.
 * Small shops buy a few units per order, so one account rarely passes 40,000 in a quarter.
 */
const PRODUCT_PRICES: Record<
	ProductLine,
	{ unitPrice: number; minQuantity: number; maxQuantity: number }
> = {
	terminals: { unitPrice: 1290, minQuantity: 1, maxQuantity: 6 },
	licenses: { unitPrice: 540, minQuantity: 2, maxQuantity: 12 },
	installation: { unitPrice: 780, minQuantity: 1, maxQuantity: 3 },
	support: { unitPrice: 1150, minQuantity: 1, maxQuantity: 4 },
	training: { unitPrice: 420, minQuantity: 1, maxQuantity: 3 },
};

// The chance of each product line as the first line of an order. Terminals and licenses lead most orders.
const FIRST_LINE_WEIGHTS: Record<ProductLine, number> = {
	terminals: 0.36,
	licenses: 0.34,
	installation: 0.08,
	support: 0.14,
	training: 0.08,
};

// Mean orders of the whole team on a weekday and on a weekend day.
const WEEKDAY_ORDERS = 6.2;
const WEEKEND_ORDERS = 0.4;
// The order numbers give each day 16 slots, so a day keeps at most 15 orders.
const MAX_ORDERS_PER_DAY = 15;
// 1 in 25 orders is cancelled after the booking.
const CANCEL_RATE = 0.04;

/** A small seeded generator (mulberry32). The same seed gives the same numbers on every visit. */
function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

// An integer from min to max, both included.
function randomInt(random: () => number, min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

// A draw from a Poisson law (Knuth). The mean stays under 15, so the loop is short.
function poisson(random: () => number, mean: number): number {
	const limit = Math.exp(-mean);
	let count = 0;
	let product = random();
	while (product > limit) {
		count += 1;
		product *= random();
	}
	return count;
}

// One key of `weights`, with a chance in proportion to its weight.
function weightedPick<Key extends string>(
	random: () => number,
	weights: Record<Key, number>,
	keys: readonly Key[],
): Key {
	const total = keys.reduce((sum, key) => sum + weights[key], 0);
	let point = random() * total;
	let picked: Key | undefined;
	for (const key of keys) {
		picked = key;
		point -= weights[key];
		if (point <= 0) {
			break;
		}
	}
	if (picked === undefined) {
		throw new Error("weightedPick needs at least one key.");
	}
	return picked;
}

const REPS: RepRow[] = REP_SEEDS.map(({ weight, planBias, ...rep }) => ({
	...rep,
	// example.com is a reserved domain, so no mail reaches a real person.
	email: `${rep.id.replace("-", ".")}@example.com`,
}));

const ACCOUNTS: AccountRow[] = TERRITORIES.flatMap((territory) => {
	const owners = REP_SEEDS.filter((rep) => rep.territoryId === territory.id);
	return (ACCOUNT_SEEDS[territory.id] ?? []).flatMap(
		([name, segment], index) => {
			const owner = owners[index % owners.length];
			// Every territory has reps. A territory with none keeps no accounts.
			return owner
				? [
						{
							id: `${territory.id}-${index + 1}`,
							name,
							segment,
							territoryId: territory.id,
							ownerId: owner.id,
						},
					]
				: [];
		},
	);
});

// The account ids of each rep, for the account draw of each order.
const ACCOUNT_IDS_BY_REP = new Map(
	REP_SEEDS.map((rep) => [
		rep.id,
		ACCOUNTS.filter((account) => account.ownerId === rep.id).map(
			(account) => account.id,
		),
	]),
);

// The order weight of each account in one quarter. The seed is the quarter start, so a quarter keeps its weights.
// About 1 account in 4 expands in a quarter (new sites, new staff) and orders twice as often. 1 in 4 stays quiet.
function accountWeightsOf(quarterStartDay: number): Record<string, number> {
	const random = seededRandom(quarterStartDay * 104_729 + 3);
	return Object.fromEntries(
		ACCOUNTS.map((account) => {
			const draw = random();
			return [account.id, draw < 0.25 ? 2 : draw < 0.75 ? 1 : 0.4];
		}),
	);
}

const REP_WEIGHTS = Object.fromEntries(
	REP_SEEDS.map((rep) => [rep.id, rep.weight]),
);
const REP_IDS = REP_SEEDS.map((rep) => rep.id);

// The volume of a day: the weekday rhythm, a slow growth, a slow start of each quarter, and a push before its end.
function meanOrdersOf(day: number): number {
	const weekday = weekdayOf(day);
	const base = weekday === 0 || weekday === 6 ? WEEKEND_ORDERS : WEEKDAY_ORDERS;
	// About 12 % growth per year. Day 20,000 is 2024-10-04.
	const growth = 1 + (0.12 * (day - 20_000)) / 365;
	const quarter = quarterOfDay(day);
	// Reps close more in the last two weeks of a quarter, and less in the first ten days.
	const season =
		quarter.endDay - day <= 14 ? 1.35 : day - quarter.startDay < 10 ? 0.8 : 1;
	return base * growth * season;
}

/** The orders of one calendar date. The seed is the date, so the orders never change. */
function ordersOfDay(day: number): OrderRow[] {
	const random = seededRandom(day * 7919 + 17);
	const count = Math.min(
		poisson(random, meanOrdersOf(day)),
		MAX_ORDERS_PER_DAY,
	);
	const accountWeights = accountWeightsOf(quarterOfDay(day).startDay);
	const orders: OrderRow[] = [];
	for (let index = 0; index < count; index += 1) {
		const repId = weightedPick(random, REP_WEIGHTS, REP_IDS);
		const accountIds = ACCOUNT_IDS_BY_REP.get(repId) ?? [];
		// Each rep owns about 11 accounts. A rep with none books nothing.
		if (accountIds.length === 0) {
			continue;
		}
		const accountId = weightedPick(random, accountWeights, accountIds);
		const lineCount = 1 + (random() < 0.45 ? 1 : 0) + (random() < 0.15 ? 1 : 0);
		const productLines: ProductLine[] = [];
		while (productLines.length < lineCount) {
			const productLine = weightedPick(
				random,
				FIRST_LINE_WEIGHTS,
				PRODUCT_LINES,
			);
			if (!productLines.includes(productLine)) {
				productLines.push(productLine);
			}
		}
		const lines = productLines.map((productLine) => {
			const price = PRODUCT_PRICES[productLine];
			const quantity = randomInt(random, price.minQuantity, price.maxQuantity);
			return {
				productLine,
				quantity,
				unitPrice: price.unitPrice,
				amount: quantity * price.unitPrice,
			};
		});
		orders.push({
			// The number comes after the sort below, so the numbers of a day rise with the time.
			id: "",
			number: "",
			accountId,
			repId,
			day,
			// Between 08:00 and 18:00.
			minutes: 480 + randomInt(random, 0, 599),
			lines,
			amount: lines.reduce((sum, line) => sum + line.amount, 0),
			isCancelled: random() < CANCEL_RATE,
			delayDays: randomInt(random, 0, 2),
		});
	}
	// Each day lists its orders in time order. A later order of the day gets a higher number.
	return orders
		.sort((first, second) => first.minutes - second.minutes)
		.map((order, index) => {
			const number = day * 16 + index;
			return { ...order, id: `so-${number}`, number: `SO-${number}` };
		});
}

// Rounds a target to a whole 5,000, as a sales plan does.
function roundTarget(amount: number): number {
	return Math.max(5000, Math.round(amount / 5000) * 5000);
}

/**
 * The targets of each rep for each quarter. A target is the simulated volume of the full quarter
 * times the plan bias of the rep and a small seeded noise, so each rep ends near 85 % to 120 %.
 */
function targetsOf(
	quarters: Quarter[],
	ordersByDay: Map<number, OrderRow[]>,
): TargetRow[] {
	return quarters.flatMap((quarter) => {
		const volume = new Map<string, number>();
		for (let day = quarter.startDay; day < quarter.endDay; day += 1) {
			for (const order of ordersByDay.get(day) ?? []) {
				if (!order.isCancelled) {
					volume.set(
						order.repId,
						(volume.get(order.repId) ?? 0) + order.amount,
					);
				}
			}
		}
		return REP_SEEDS.map((rep, repIndex) => {
			const noise =
				seededRandom(quarter.startDay * 31 + repIndex)() * 0.14 - 0.07;
			return {
				repId: rep.id,
				quarterStartDay: quarter.startDay,
				amount: roundTarget((volume.get(rep.id) ?? 0) * (rep.planBias + noise)),
			};
		});
	});
}

// The tables of the last call. They change only when the day changes.
let cachedTables: SampleTables | null = null;

/** Every sample table for the day `today` (a day number). The query files call it. */
export function getSampleTables(today: number): SampleTables {
	if (cachedTables?.today === today) {
		return cachedTables;
	}
	const currentQuarter = quarterOfDay(today);
	const quarters = Array.from({ length: HISTORY_QUARTERS + 1 }, (_, index) =>
		shiftQuarter(currentQuarter, index - HISTORY_QUARTERS),
	);
	const firstDay = shiftQuarter(currentQuarter, -HISTORY_QUARTERS).startDay;
	// The targets need the volume of the whole current quarter, so the generator also runs on the days after today.
	const ordersByDay = new Map<number, OrderRow[]>();
	for (let day = firstDay; day < currentQuarter.endDay; day += 1) {
		ordersByDay.set(day, ordersOfDay(day));
	}
	const orders: OrderRow[] = [];
	for (let day = firstDay; day < today; day += 1) {
		orders.push(...(ordersByDay.get(day) ?? []));
	}
	cachedTables = {
		today,
		territories: TERRITORIES,
		reps: REPS,
		accounts: ACCOUNTS,
		orders,
		targets: targetsOf(quarters, ordersByDay),
	};
	return cachedTables;
}
