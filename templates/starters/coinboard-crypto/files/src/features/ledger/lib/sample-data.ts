// The sample ledger of the app: the assets, their price history, and the transactions of the user.
// Only the query files (api/*.queries.ts of each feature) read it, through getSampleLedger().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every time counts back from the start of the current day. A seeded generator makes the same rows for the whole day.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import { priceDecimals } from "./format";
import type {
	Account,
	AssetCategory,
	TransactionStatus,
	TransactionType,
} from "./ledger-codes";
import { UNIT_DIRECTION } from "./ledger-codes";
import { createRandom, nextBell } from "./seeded-random";
import { DAY_MS, HOUR_MS, MINUTE_MS, startOfLocalDay } from "./time";

/** One asset of the market list. */
export type AssetRow = {
	/** Also the `$assetId` part of the asset page URL, for example "aurelium". */
	id: string;
	name: string;
	/** The ticker, 3 or 4 capital letters. */
	symbol: string;
	category: AssetCategory;
	/** Units in circulation. The market size is this count times the price. */
	circulatingSupply: number;
	/** The traded amount of the last 24 hours, in CURRENCY (lib/format.ts). */
	volume24h: number;
	/** Two sentences about the project, shown on the asset page. */
	about: string;
};

/** One movement of the user: a buy, a sell, a deposit, a withdrawal, or a staking reward. */
export type TransactionRow = {
	id: string;
	/** A short code that the user can quote, for example "CB-7F3A-21C9". */
	reference: string;
	assetId: string;
	type: TransactionType;
	status: TransactionStatus;
	/** The account that holds the asset. */
	account: Account;
	/** Units of the asset. Always positive; the type gives the direction. */
	quantity: number;
	/** The price of one unit at the time of the transaction, in CURRENCY. */
	unitPrice: number;
	/** `quantity` times `unitPrice`, in CURRENCY, with cents. */
	amount: number;
	/** The trading or network fee, in CURRENCY. 0 for a deposit and a reward. */
	fee: number;
	/** ISO time. Never after the start of the current day. */
	occurredAt: string;
};

/** The whole sample ledger. A database has one table per list: assets, asset_prices, and transactions. */
export type SampleLedger = {
	/** The start of the current local day, in milliseconds since 1970. Every time of the ledger counts back from it. */
	anchor: number;
	assets: AssetRow[];
	/** One price list per asset id, oldest first, one price every 6 hours. The last price is the price at `anchor`. */
	prices: Record<string, number[]>;
	/** In time order, oldest first. */
	transactions: TransactionRow[];
};

/** The price lists have one price per step of 6 hours. */
export const PRICE_STEP_MS = 6 * HOUR_MS;
/** Price steps in one day. */
export const STEPS_PER_DAY = 4;
// Days of price history. Longer than the oldest transaction, so each one has a price.
const HISTORY_DAYS = 400;

const STEP_COUNT = HISTORY_DAYS * STEPS_PER_DAY;

// The inputs of one generated asset. The generator turns them into an AssetRow and a price list.
type AssetSeed = Omit<AssetRow, "volume24h"> & {
	/** The price at the start of the current day, in CURRENCY. */
	price: number;
	/** The change of the log price over one year. 0.4 is about +49 %. */
	yearDrift: number;
	/** How strongly the price follows the whole market. 1 is the market itself. */
	marketWeight: number;
	/** The size of the own random move of one step, as a ratio. */
	swing: number;
	/** The share of the market size that trades in 24 hours. */
	turnover: number;
};

const ASSET_SEEDS: AssetSeed[] = [
	{
		id: "aurelium",
		name: "Aurelium",
		symbol: "AUR",
		category: "layer1",
		price: 41870,
		circulatingSupply: 19_420_000,
		yearDrift: 0.42,
		marketWeight: 0.9,
		swing: 0.006,
		turnover: 0.034,
		about:
			"Aurelium is the oldest network in this list, with a fixed supply of 21 million units. Most holders keep it as a long-term store of value.",
	},
	{
		id: "helion",
		name: "Helion",
		symbol: "HLN",
		category: "layer1",
		price: 2315.4,
		circulatingSupply: 121_300_000,
		yearDrift: 0.3,
		marketWeight: 1.1,
		swing: 0.008,
		turnover: 0.052,
		about:
			"Helion runs programs that anyone can deploy, and most lending and trading apps build on it. Its holders can stake units to help secure the network.",
	},
	{
		id: "keel-dollar",
		name: "Keel Dollar",
		symbol: "KUSD",
		category: "stablecoin",
		price: 1.0002,
		circulatingSupply: 84_600_000_000,
		yearDrift: 0,
		marketWeight: 0,
		swing: 0.0002,
		turnover: 0.31,
		about:
			"Keel Dollar is a token that follows the price of one US dollar. Traders hold it between trades and use it to move money between accounts.",
	},
	{
		id: "tesselane",
		name: "Tesselane",
		symbol: "TSL",
		category: "layer1",
		price: 148.2,
		circulatingSupply: 462_000_000,
		yearDrift: 0.62,
		marketWeight: 1.3,
		swing: 0.012,
		turnover: 0.071,
		about:
			"Tesselane is a fast network with low fees, made for apps with many small payments. Staked units earn a reward about every three weeks.",
	},
	{
		id: "novacore",
		name: "Novacore",
		symbol: "NVC",
		category: "infrastructure",
		price: 412.75,
		circulatingSupply: 148_000_000,
		yearDrift: 0.35,
		marketWeight: 1,
		swing: 0.009,
		turnover: 0.028,
		about:
			"Novacore is the token of a large exchange network. Holders pay lower trading fees, and a part of each fee is removed from the supply.",
	},
	{
		id: "meridian",
		name: "Meridian",
		symbol: "MRD",
		category: "payments",
		price: 0.6124,
		circulatingSupply: 56_200_000_000,
		yearDrift: 0.1,
		marketWeight: 1,
		swing: 0.011,
		turnover: 0.046,
		about:
			"Meridian moves money across borders in a few seconds. Banks and payment firms use it to settle transfers between currencies.",
	},
	{
		id: "harbor-dollar",
		name: "Harbor Dollar",
		symbol: "HBRD",
		category: "stablecoin",
		price: 0.9998,
		circulatingSupply: 31_400_000_000,
		yearDrift: 0,
		marketWeight: 0,
		swing: 0.0003,
		turnover: 0.22,
		about:
			"Harbor Dollar follows the price of one US dollar, with cash and short-term bonds behind each token. Its issuer publishes the reserves each month.",
	},
	{
		id: "kestrel",
		name: "Kestrel",
		symbol: "KSTL",
		category: "defi",
		price: 18.94,
		circulatingSupply: 1_020_000_000,
		yearDrift: 0.5,
		marketWeight: 1.4,
		swing: 0.014,
		turnover: 0.062,
		about:
			"Kestrel is an exchange with no order book: traders swap against shared pools of tokens. Holders of the token vote on its fees.",
	},
	{
		id: "halcyon",
		name: "Halcyon",
		symbol: "HLC",
		category: "layer1",
		price: 36.52,
		circulatingSupply: 395_000_000,
		yearDrift: 0.25,
		marketWeight: 1.2,
		swing: 0.012,
		turnover: 0.058,
		about:
			"Halcyon is a network of linked chains that share one set of validators. Staked units earn a reward about every three weeks.",
	},
	{
		id: "quillon",
		name: "Quillon",
		symbol: "QLN",
		category: "infrastructure",
		price: 14.37,
		circulatingSupply: 610_000_000,
		yearDrift: 0.18,
		marketWeight: 1.2,
		swing: 0.013,
		turnover: 0.064,
		about:
			"Quillon brings prices and other outside data to programs on many networks. Node operators stake the token as a promise of correct data.",
	},
	{
		id: "ember",
		name: "Ember",
		symbol: "EMB",
		category: "defi",
		price: 7.86,
		circulatingSupply: 1_190_000_000,
		yearDrift: -0.2,
		marketWeight: 1.5,
		swing: 0.016,
		turnover: 0.049,
		about:
			"Ember is a lending market: users deposit tokens to earn interest, or borrow against them. The token pays for the safety fund of the market.",
	},
	{
		id: "cobalt",
		name: "Cobalt",
		symbol: "CBLT",
		category: "infrastructure",
		price: 1.284,
		circulatingSupply: 7_400_000_000,
		yearDrift: 0.28,
		marketWeight: 1.4,
		swing: 0.015,
		turnover: 0.083,
		about:
			"Cobalt groups many transfers into one and settles them on Helion, so each transfer costs less. Its token pays for that settlement.",
	},
	{
		id: "pinnacle",
		name: "Pinnacle",
		symbol: "PNC",
		category: "payments",
		price: 71.45,
		circulatingSupply: 74_800_000,
		yearDrift: 0.05,
		marketWeight: 0.9,
		swing: 0.01,
		turnover: 0.057,
		about:
			"Pinnacle is a payment network that copies the design of Aurelium with faster blocks. Shops accept it for small daily purchases.",
	},
	{
		id: "velloway",
		name: "Velloway",
		symbol: "VLW",
		category: "payments",
		price: 0.1147,
		circulatingSupply: 31_900_000_000,
		yearDrift: 0.08,
		marketWeight: 0.9,
		swing: 0.011,
		turnover: 0.039,
		about:
			"Velloway sends small payments for a fee of less than one cent. Aid groups and money transfer firms use it in regions with few banks.",
	},
	{
		id: "sorrel",
		name: "Sorrel",
		symbol: "SRL",
		category: "defi",
		price: 92.3,
		circulatingSupply: 15_100_000,
		yearDrift: 0.33,
		marketWeight: 1.3,
		swing: 0.015,
		turnover: 0.077,
		about:
			"Sorrel lets users stake Helion and keep a token that they can still trade. The Sorrel token gives a vote on how the pool chooses validators.",
	},
	{
		id: "ironwood",
		name: "Ironwood",
		symbol: "IRW",
		category: "infrastructure",
		price: 23.6,
		circulatingSupply: 141_000_000,
		yearDrift: 0.45,
		marketWeight: 1.3,
		swing: 0.016,
		turnover: 0.068,
		about:
			"Ironwood rents out file storage on computers around the world. Users pay in the token, and storage providers earn it for each proof of storage.",
	},
	{
		id: "verdant",
		name: "Verdant",
		symbol: "VRD",
		category: "layer1",
		price: 4.18,
		circulatingSupply: 1_260_000_000,
		yearDrift: 0.15,
		marketWeight: 1.3,
		swing: 0.014,
		turnover: 0.051,
		about:
			"Verdant is a network that uses little energy and has a carbon budget in its rules. Staked units earn a reward about every three weeks.",
	},
	{
		id: "riverstone",
		name: "Riverstone",
		symbol: "RVS",
		category: "gaming",
		price: 11.83,
		circulatingSupply: 298_000_000,
		yearDrift: 0.22,
		marketWeight: 1.5,
		swing: 0.018,
		turnover: 0.094,
		about:
			"Riverstone is a network made for games, where each item of a player is a token. Studios pay the network fees for their players.",
	},
	{
		id: "obsidra",
		name: "Obsidra",
		symbol: "OBD",
		category: "gaming",
		price: 5.42,
		circulatingSupply: 512_000_000,
		yearDrift: 0.55,
		marketWeight: 1.6,
		swing: 0.02,
		turnover: 0.11,
		about:
			"Obsidra is the currency of a group of online worlds. Players buy land and items with it, and creators earn it for what they build.",
	},
	{
		id: "glacier",
		name: "Glacier",
		symbol: "GLC",
		category: "infrastructure",
		price: 6.05,
		circulatingSupply: 402_000_000,
		yearDrift: -0.1,
		marketWeight: 1.2,
		swing: 0.014,
		turnover: 0.045,
		about:
			"Glacier keeps data forever for one payment at the start. Archives and research groups use it for records that must not change.",
	},
	{
		id: "marrow",
		name: "Marrow",
		symbol: "MRW",
		category: "defi",
		price: 2.47,
		circulatingSupply: 880_000_000,
		yearDrift: -0.35,
		marketWeight: 1.5,
		swing: 0.017,
		turnover: 0.072,
		about:
			"Marrow trades contracts on future prices with no broker. Holders of the token share a part of the trading fees.",
	},
	{
		id: "veilmark",
		name: "Veilmark",
		symbol: "VML",
		category: "payments",
		price: 3.29,
		circulatingSupply: 590_000_000,
		yearDrift: 0.12,
		marketWeight: 1.1,
		swing: 0.013,
		turnover: 0.041,
		about:
			"Veilmark hides the sender, the receiver, and the amount of each payment. People who need private payments use it.",
	},
	{
		id: "basalt",
		name: "Basalt",
		symbol: "BSLT",
		category: "layer1",
		price: 0.842,
		circulatingSupply: 2_100_000_000,
		yearDrift: -0.25,
		marketWeight: 1.4,
		swing: 0.016,
		turnover: 0.052,
		about:
			"Basalt is a network where each program is checked with a formal proof before it runs. Its growth is slow, and its users value that care.",
	},
	{
		id: "juniper",
		name: "Juniper",
		symbol: "JNP",
		category: "gaming",
		price: 1.076,
		circulatingSupply: 1_480_000_000,
		yearDrift: 0.3,
		marketWeight: 1.6,
		swing: 0.019,
		turnover: 0.088,
		about:
			"Juniper pays players of a card game for each season that they finish. Cards are tokens, and players trade them in a shared market.",
	},
	{
		id: "peregrine",
		name: "Peregrine",
		symbol: "PGN",
		category: "gaming",
		price: 0.4418,
		circulatingSupply: 2_950_000_000,
		yearDrift: -0.15,
		marketWeight: 1.6,
		swing: 0.02,
		turnover: 0.081,
		about:
			"Peregrine is the token of a racing game with player-owned teams. Each race pays a prize in the token to the three fastest teams.",
	},
	{
		id: "larkspur",
		name: "Larkspur",
		symbol: "LRK",
		category: "defi",
		price: 0.3391,
		circulatingSupply: 3_300_000_000,
		yearDrift: 0.2,
		marketWeight: 1.5,
		swing: 0.018,
		turnover: 0.066,
		about:
			"Larkspur finds the best price for a swap across many exchanges. A part of each saving goes to the holders of the token.",
	},
	{
		id: "vantage",
		name: "Vantage",
		symbol: "VNT",
		category: "gaming",
		price: 0.2265,
		circulatingSupply: 3_900_000_000,
		yearDrift: 0.4,
		marketWeight: 1.7,
		swing: 0.022,
		turnover: 0.12,
		about:
			"Vantage rewards viewers and hosts of live game streams. Viewers spend the token on tips and on votes that change the stream.",
	},
	{
		id: "beaconry",
		name: "Beaconry",
		symbol: "BCY",
		category: "infrastructure",
		price: 0.0718,
		circulatingSupply: 9_800_000_000,
		yearDrift: 0.1,
		marketWeight: 1.3,
		swing: 0.016,
		turnover: 0.054,
		about:
			"Beaconry is a network of small radio stations that people run at home. The stations earn the token for the coverage that they give to sensors.",
	},
	{
		id: "northwind",
		name: "Northwind",
		symbol: "NWD",
		category: "payments",
		price: 0.0462,
		circulatingSupply: 13_500_000_000,
		yearDrift: -0.05,
		marketWeight: 1.2,
		swing: 0.015,
		turnover: 0.047,
		about:
			"Northwind is a payment token for phone top-ups and bills. A group of telecom firms runs its network.",
	},
	{
		id: "wisp",
		name: "Wisp",
		symbol: "WSP",
		category: "gaming",
		price: 0.0193,
		circulatingSupply: 21_000_000_000,
		yearDrift: 0.6,
		marketWeight: 1.8,
		swing: 0.026,
		turnover: 0.16,
		about:
			"Wisp started as a joke between players of one game, and a large community keeps it alive. Its price moves more than any other in this list.",
	},
];

// The inputs of the transactions of one held asset. The generator spreads the buys between the two day counts.
type PositionPlan = {
	assetId: string;
	account: Account;
	/** How units arrive: a buy with a price, or a deposit from another wallet. */
	inflow: "buy" | "deposit";
	/** Days before today of the first and of the last inflow. */
	firstDaysAgo: number;
	lastDaysAgo: number;
	/** Count of inflows, and the mean units of one. */
	inflows: number;
	unitsPerInflow: number;
	/** Each outflow removes `share` of the units held at that time. A sell for a buy plan, a withdrawal for a deposit plan. */
	outflows: { daysAgo: number; share: number }[];
	/** A staking reward every 21 days, as a share of the units held. Absent for an asset that is not staked. */
	rewardShare?: number;
};

const POSITION_PLANS: PositionPlan[] = [
	{
		assetId: "aurelium",
		account: "vault",
		inflow: "buy",
		firstDaysAgo: 352,
		lastDaysAgo: 9,
		inflows: 12,
		unitsPerInflow: 0.125,
		outflows: [{ daysAgo: 131, share: 0.1 }],
	},
	{
		assetId: "helion",
		account: "vault",
		inflow: "buy",
		firstDaysAgo: 331,
		lastDaysAgo: 33,
		inflows: 9,
		unitsPerInflow: 2.1,
		outflows: [{ daysAgo: 77, share: 0.08 }],
	},
	{
		assetId: "tesselane",
		account: "staking",
		inflow: "buy",
		firstDaysAgo: 298,
		lastDaysAgo: 34,
		inflows: 6,
		unitsPerInflow: 22,
		outflows: [],
		rewardShare: 0.0035,
	},
	{
		assetId: "keel-dollar",
		account: "trading",
		inflow: "deposit",
		firstDaysAgo: 322,
		lastDaysAgo: 36,
		inflows: 5,
		unitsPerInflow: 4200,
		outflows: [
			{ daysAgo: 203, share: 0.2 },
			{ daysAgo: 48, share: 0.15 },
		],
	},
	{
		assetId: "novacore",
		account: "vault",
		inflow: "buy",
		firstDaysAgo: 284,
		lastDaysAgo: 41,
		inflows: 5,
		unitsPerInflow: 6.8,
		outflows: [{ daysAgo: 104, share: 0.1 }],
	},
	{
		assetId: "halcyon",
		account: "staking",
		inflow: "buy",
		firstDaysAgo: 243,
		lastDaysAgo: 27,
		inflows: 5,
		unitsPerInflow: 48,
		outflows: [],
		rewardShare: 0.004,
	},
	{
		assetId: "kestrel",
		account: "trading",
		inflow: "buy",
		firstDaysAgo: 207,
		lastDaysAgo: 6,
		inflows: 5,
		unitsPerInflow: 78,
		outflows: [
			{ daysAgo: 142, share: 0.2 },
			{ daysAgo: 38, share: 0.15 },
		],
	},
	{
		assetId: "quillon",
		account: "trading",
		inflow: "buy",
		firstDaysAgo: 188,
		lastDaysAgo: 20,
		inflows: 4,
		unitsPerInflow: 92,
		outflows: [{ daysAgo: 66, share: 0.12 }],
	},
	{
		assetId: "marrow",
		account: "trading",
		inflow: "buy",
		firstDaysAgo: 226,
		lastDaysAgo: 181,
		inflows: 2,
		unitsPerInflow: 640,
		// The whole position is sold: Marrow shows in Activity and on its asset page, not in Holdings.
		outflows: [{ daysAgo: 118, share: 1 }],
	},
	{
		assetId: "meridian",
		account: "trading",
		inflow: "buy",
		firstDaysAgo: 171,
		lastDaysAgo: 52,
		inflows: 3,
		unitsPerInflow: 1650,
		outflows: [{ daysAgo: 24, share: 0.15 }],
	},
	{
		assetId: "sorrel",
		account: "trading",
		inflow: "buy",
		firstDaysAgo: 149,
		lastDaysAgo: 4,
		inflows: 4,
		unitsPerInflow: 10.5,
		outflows: [],
	},
	{
		assetId: "verdant",
		account: "staking",
		inflow: "buy",
		firstDaysAgo: 122,
		lastDaysAgo: 30,
		inflows: 3,
		unitsPerInflow: 175,
		outflows: [],
		rewardShare: 0.0045,
	},
	{
		assetId: "ember",
		account: "trading",
		inflow: "buy",
		firstDaysAgo: 113,
		lastDaysAgo: 45,
		inflows: 3,
		unitsPerInflow: 82,
		outflows: [{ daysAgo: 14, share: 0.2 }],
	},
	{
		assetId: "cobalt",
		account: "trading",
		inflow: "buy",
		firstDaysAgo: 83,
		lastDaysAgo: 3,
		inflows: 3,
		unitsPerInflow: 310,
		outflows: [],
	},
	{
		assetId: "obsidra",
		account: "trading",
		inflow: "buy",
		firstDaysAgo: 61,
		lastDaysAgo: 2,
		inflows: 3,
		unitsPerInflow: 52,
		outflows: [],
	},
];

// A transaction that the plans do not make: an old deposit, and the pending and failed rows.
type ExtraTransaction = {
	assetId: string;
	account: Account;
	type: TransactionType;
	status: TransactionStatus;
	quantity: number;
	daysAgo: number;
	/** Minutes after midnight, local time. */
	minuteOfDay: number;
};

const EXTRA_TRANSACTIONS: ExtraTransaction[] = [
	{
		assetId: "aurelium",
		account: "vault",
		type: "deposit",
		status: "confirmed",
		quantity: 0.2184,
		daysAgo: 346,
		minuteOfDay: 11 * 60 + 12,
	},
	{
		assetId: "ember",
		account: "trading",
		type: "buy",
		status: "failed",
		quantity: 60,
		daysAgo: 96,
		minuteOfDay: 9 * 60 + 47,
	},
	{
		assetId: "meridian",
		account: "trading",
		type: "withdrawal",
		status: "failed",
		quantity: 800,
		daysAgo: 57,
		minuteOfDay: 20 * 60 + 5,
	},
	{
		assetId: "kestrel",
		account: "trading",
		type: "sell",
		status: "failed",
		quantity: 40,
		daysAgo: 23,
		minuteOfDay: 14 * 60 + 31,
	},
	{
		assetId: "keel-dollar",
		account: "trading",
		type: "withdrawal",
		status: "pending",
		quantity: 1200,
		daysAgo: 1,
		minuteOfDay: 18 * 60 + 16,
	},
	{
		assetId: "helion",
		account: "vault",
		type: "buy",
		status: "pending",
		quantity: 0.85,
		daysAgo: 1,
		minuteOfDay: 21 * 60 + 42,
	},
];

// Days between two staking rewards of one asset.
const REWARD_EVERY_DAYS = 21;
// The trading fee of a buy and of a sell, as a share of the amount: 0.25 %.
const TRADING_FEE_RATIO = 0.0025;

function roundTo(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

// The decimals of a quantity follow the price: a costly asset trades in small parts.
function quantityDecimals(price: number): number {
	if (price >= 10_000) {
		return 4;
	}
	if (price >= 100) {
		return 3;
	}
	return price >= 1 ? 2 : 0;
}

// One log return per price step for the whole market. Every asset follows it by its marketWeight.
function buildMarketSteps(): number[] {
	const random = createRandom(1547);
	return Array.from({ length: STEP_COUNT + 1 }, (_, step) => {
		// A slow wave of about 70 days gives the year its rises and its falls.
		const wave =
			Math.sin((step / (70 * STEPS_PER_DAY)) * 2 * Math.PI + 4.1) * 0.0011;
		return nextBell(random) * 0.0075 + wave;
	});
}

// The price list of one asset: a random walk that ends at the price of the seed.
function buildPrices(
	seed: AssetSeed,
	index: number,
	market: number[],
): number[] {
	const random = createRandom(9025 + index * 131);
	const decimals = priceDecimals(seed.price);
	const logs: number[] = [0];
	for (let step = 1; step <= STEP_COUNT; step += 1) {
		const previous = logs[step - 1] ?? 0;
		const stepDrift = seed.yearDrift / (365 * STEPS_PER_DAY);
		const marketMove = (market[step] ?? 0) * seed.marketWeight;
		if (seed.category === "stablecoin") {
			// A stablecoin does not walk: each step pulls back to its price, then moves a little.
			logs.push(previous * 0.8 + nextBell(random) * seed.swing);
		} else {
			logs.push(
				previous + stepDrift + marketMove + nextBell(random) * seed.swing,
			);
		}
	}
	const last = logs[STEP_COUNT] ?? 0;
	// The list ends at the seed price. Each price has the decimals that the pages show, so every sum agrees.
	return logs.map((log) =>
		roundTo(seed.price * Math.exp(log - last), decimals),
	);
}

// One planned movement before its quantity and its price are known.
type PlannedMove = {
	assetId: string;
	account: Account;
	type: TransactionType;
	status: TransactionStatus;
	/** Milliseconds since 1970. */
	time: number;
	/** Fixed units, or null when the move takes a share of the held units. */
	quantity: number | null;
	/** The share of the held units that the move takes, when `quantity` is null. */
	share: number;
};

// The time of a move: `daysAgo` full days before the anchor, plus the minutes after midnight.
// daysAgo is 1 or more and the minutes stay under one day, so no move is after the anchor.
function moveTime(anchor: number, daysAgo: number, minuteOfDay: number) {
	return anchor - daysAgo * DAY_MS + minuteOfDay * MINUTE_MS;
}

function planMoves(anchor: number): PlannedMove[] {
	const random = createRandom(2718);
	const moves: PlannedMove[] = [];
	for (const plan of POSITION_PLANS) {
		const base = {
			assetId: plan.assetId,
			account: plan.account,
			status: "confirmed" as const,
		};
		const span = plan.firstDaysAgo - plan.lastDaysAgo;
		for (let index = 0; index < plan.inflows; index += 1) {
			const even =
				plan.firstDaysAgo - (span * index) / Math.max(1, plan.inflows - 1);
			// The first and the last inflow keep their day. The others move by up to 4 days.
			const isEdge = index === 0 || index === plan.inflows - 1;
			const daysAgo = Math.round(even + (isEdge ? 0 : (random() - 0.5) * 8));
			// Between 07:00 and 22:59.
			const minuteOfDay = 7 * 60 + Math.floor(random() * 16 * 60);
			moves.push({
				...base,
				type: plan.inflow,
				time: moveTime(anchor, daysAgo, minuteOfDay),
				quantity: plan.unitsPerInflow * (0.7 + random() * 0.6),
				share: 0,
			});
		}
		for (const outflow of plan.outflows) {
			const minuteOfDay = 8 * 60 + Math.floor(random() * 13 * 60);
			moves.push({
				...base,
				type: plan.inflow === "buy" ? "sell" : "withdrawal",
				time: moveTime(anchor, outflow.daysAgo, minuteOfDay),
				quantity: null,
				share: outflow.share,
			});
		}
		if (plan.rewardShare) {
			// The network pays at the same minute of the night each time.
			const minuteOfDay = 60 + Math.floor(random() * 120);
			for (
				let daysAgo = plan.firstDaysAgo - REWARD_EVERY_DAYS;
				daysAgo >= 2;
				daysAgo -= REWARD_EVERY_DAYS
			) {
				moves.push({
					...base,
					type: "reward",
					time: moveTime(anchor, daysAgo, minuteOfDay),
					quantity: null,
					share: plan.rewardShare * (0.85 + random() * 0.3),
				});
			}
		}
	}
	for (const extra of EXTRA_TRANSACTIONS) {
		moves.push({
			assetId: extra.assetId,
			account: extra.account,
			type: extra.type,
			status: extra.status,
			time: moveTime(anchor, extra.daysAgo, extra.minuteOfDay),
			quantity: extra.quantity,
			share: 0,
		});
	}
	return moves.sort((first, second) => first.time - second.time);
}

// Four capital hex digits for a reference code.
function hexPart(random: () => number): string {
	return Math.floor(random() * 0x10000)
		.toString(16)
		.toUpperCase()
		.padStart(4, "0");
}

function buildTransactions(
	anchor: number,
	prices: Record<string, number[]>,
): TransactionRow[] {
	const random = createRandom(1618);
	// Units held per asset while the moves run in time order. A share-based move reads it.
	const held = new Map<string, number>();
	const rows: TransactionRow[] = [];
	for (const move of planMoves(anchor)) {
		const list = prices[move.assetId] ?? [];
		const stepsAgo = Math.round((anchor - move.time) / PRICE_STEP_MS);
		const marketPrice = list[STEP_COUNT - stepsAgo] ?? 0;
		const lastPrice = list[STEP_COUNT] ?? 0;
		// A trade does not fill exactly at the price of the 6-hour step: up to 0.3 % away.
		// A deposit, a withdrawal, and a reward are not trades, so they take the market price.
		const slip = (random() - 0.5) * 0.006;
		const isTrade = move.type === "buy" || move.type === "sell";
		const unitPrice = roundTo(
			marketPrice * (isTrade ? 1 + slip : 1),
			priceDecimals(lastPrice),
		);
		const heldUnits = held.get(move.assetId) ?? 0;
		// A reward is small, so it keeps two more decimals than a trade.
		const decimals = Math.min(
			4,
			quantityDecimals(lastPrice) + (move.type === "reward" ? 2 : 0),
		);
		const quantity =
			move.quantity === null
				? // A share of 1 sells every unit, with no rounding rest.
					move.share === 1
					? heldUnits
					: roundTo(heldUnits * move.share, decimals)
				: roundTo(move.quantity, decimals);
		const amount = roundTo(quantity * unitPrice, 2);
		const fee =
			move.type === "buy" || move.type === "sell"
				? roundTo(amount * TRADING_FEE_RATIO, 2)
				: move.type === "withdrawal"
					? // A network fee between 1.50 and 5.50.
						roundTo(1.5 + random() * 4, 2)
					: 0;
		if (move.status === "confirmed") {
			// 8 decimals remove the float rest of the sum.
			held.set(
				move.assetId,
				roundTo(heldUnits + UNIT_DIRECTION[move.type] * quantity, 8),
			);
		}
		rows.push({
			id: `tx-${String(rows.length + 1).padStart(4, "0")}`,
			reference: `CB-${hexPart(random)}-${hexPart(random)}`,
			assetId: move.assetId,
			type: move.type,
			status: move.status,
			account: move.account,
			quantity,
			unitPrice,
			amount,
			fee,
			occurredAt: new Date(move.time).toISOString(),
		});
	}
	return rows;
}

function buildLedger(anchor: number): SampleLedger {
	const market = buildMarketSteps();
	const volumeRandom = createRandom(577);
	const prices: Record<string, number[]> = {};
	const assets = ASSET_SEEDS.map((seed, index): AssetRow => {
		prices[seed.id] = buildPrices(seed, index, market);
		const marketSize = seed.price * seed.circulatingSupply;
		return {
			id: seed.id,
			name: seed.name,
			symbol: seed.symbol,
			category: seed.category,
			circulatingSupply: seed.circulatingSupply,
			// The traded amount differs from the mean turnover by up to 20 %.
			volume24h: Math.round(
				marketSize * seed.turnover * (0.8 + volumeRandom() * 0.4),
			),
			about: seed.about,
		};
	});
	return {
		anchor,
		assets,
		prices,
		transactions: buildTransactions(anchor, prices),
	};
}

// The ledger of the current day. A new day builds a new one.
let cachedLedger: SampleLedger | null = null;

/** The sample ledger of today. The same object for the whole day, so every page shows the same numbers. */
export function getSampleLedger(): SampleLedger {
	const anchor = startOfLocalDay(Date.now());
	if (cachedLedger?.anchor !== anchor) {
		cachedLedger = buildLedger(anchor);
	}
	return cachedLedger;
}

/** The price of an asset `stepsAgo` steps of 6 hours before the start of today. 0 when the asset or the step does not exist. */
export function priceStepsAgo(
	ledger: SampleLedger,
	assetId: string,
	stepsAgo: number,
): number {
	return ledger.prices[assetId]?.[STEP_COUNT - stepsAgo] ?? 0;
}

/** The price of an asset at midnight `daysAgo` days before today. 0 days ago is the current price. */
export function priceDaysAgo(
	ledger: SampleLedger,
	assetId: string,
	daysAgo: number,
): number {
	return priceStepsAgo(ledger, assetId, daysAgo * STEPS_PER_DAY);
}
