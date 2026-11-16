// The sample listings of the agency: the homes for sale, with their price, their seller, and their dates.
// sample-leads.ts reads the plans to attach each lead to a home on the market. book.ts reads the listings.
// Each calendar day has its own seed, so a listing keeps its facts from one day to the next.
// To make it real: this module becomes the table `listings`.
import { DAY_MS, dayNumberOf, timeOnDay } from "./agency-clock";
import { AGENTS } from "./sample-agents";
import { sellerNameOf } from "./sample-people";
import {
	createSeededRandom,
	pickOne,
	pickSome,
	pickWeighted,
	randomInt,
	seedOf,
} from "./seeded-random";

/** The currency of every price, as an ISO 4217 code. Move it to a settings table. */
export const AGENCY_CURRENCY = "USD";

/** Every status of a listing, in the order of the sale. The label is the message key `agency.listingStatuses.<status>`. */
export const LISTING_STATUSES = [
	"coming_soon",
	"active",
	"under_offer",
	"sold",
	"withdrawn",
] as const;

/** One status of a listing. */
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Every kind of home. The label is the message key `agency.propertyTypes.<type>`. */
export const PROPERTY_TYPES = [
	"apartment",
	"house",
	"townhouse",
	"loft",
	"studio",
] as const;

/** One kind of home. */
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Every selling point of a home. The label is the message key `agency.features.<feature>`. */
export const LISTING_FEATURES = [
	"balcony",
	"terrace",
	"garden",
	"garage",
	"elevator",
	"fireplace",
	"storage",
	"renovated",
	"south_facing",
	"concierge",
	"bike_room",
	"hardwood_floors",
	"high_ceilings",
	"home_office",
	"river_view",
	"basement",
] as const;

/** One selling point of a home. */
export type ListingFeature = (typeof LISTING_FEATURES)[number];

/** One home for sale, as the pages read it. The times are ISO texts. */
export type Listing = {
	/** The reference of the agency, for example "KS-4770". Also the `$listingId` of the URL. */
	id: string;
	/** The house number and the street, for example "214 Alder Street". */
	street: string;
	/** The unit in the building, for example "Unit 5C". null for a house. */
	unit: string | null;
	/** The district of the city. */
	neighborhood: string;
	type: PropertyType;
	/** 0 for a studio. */
	bedrooms: number;
	bathrooms: number;
	/** The living area, in square feet. */
	areaSqft: number;
	yearBuilt: number;
	/** The floor of the unit, counted from 1. null for a house. */
	floor: number | null;
	parkingSpaces: number;
	features: ListingFeature[];
	/** One sentence of the listing text. */
	summary: string;
	/** The price today, in whole units of the currency. */
	askingPrice: number;
	/** The price on the first day. Above `askingPrice` after a reduction. */
	originalPrice: number;
	/** The time of the price reduction, or null. */
	priceReducedAt: string | null;
	status: ListingStatus;
	/** The time the home went on the market. In the future for a "coming_soon" listing. */
	listedAt: string;
	/** The time the seller signed with the agency. */
	instructedAt: string;
	/** The time the seller accepted an offer, or null. */
	offerAcceptedAt: string | null;
	/** The price of the accepted offer, or null. */
	agreedPrice: number | null;
	/** The time the sale completed, or null. */
	soldAt: string | null;
	/** The time the seller took the home off the market, or null. */
	withdrawnAt: string | null;
	sellerName: string;
	/** The id of the agent who holds the listing. */
	agentId: string;
	/** Count of visits of the listing page on the property portals. */
	portalViews: number;
};

/**
 * The full life of one listing, with its future dates too. Times are milliseconds since 1970.
 * sample-leads.ts needs the future dates: a lead never books a viewing after the home goes under offer.
 */
export type ListingPlan = Omit<
	Listing,
	| "askingPrice"
	| "priceReducedAt"
	| "status"
	| "listedAt"
	| "instructedAt"
	| "offerAcceptedAt"
	| "agreedPrice"
	| "soldAt"
	| "withdrawnAt"
	| "portalViews"
> & {
	/** The day number of the first market day. One listing at most starts on a day. */
	dayNumber: number;
	listedAt: number;
	instructedAt: number;
	/** The price after the reduction, or null when the price never changes. */
	reducedPrice: number | null;
	reducedAt: number | null;
	offerAcceptedAt: number | null;
	/** The price of the accepted offer. Meaningful only with `offerAcceptedAt`. */
	agreedPrice: number;
	soldAt: number | null;
	withdrawnAt: number | null;
	/** The time the home leaves the market: the accepted offer or the withdrawal. Infinity when it stays. */
	closesAt: number;
	/** Portal visits of the first day. The daily count then falls. */
	firstDayViews: number;
};

type Neighborhood = {
	name: string;
	/** The usual price of one square foot, in whole units of the currency. */
	pricePerSqft: number;
	streets: readonly [string, ...string[]];
};

// The districts and the streets are fictional. They are data, not interface text.
const NEIGHBORHOODS = [
	{
		name: "Harbor Row",
		pricePerSqft: 720,
		streets: [
			"Granary Wharf",
			"Heron Quay",
			"Lantern Street",
			"Saltmarsh Lane",
		],
	},
	{
		name: "Linden Park",
		pricePerSqft: 560,
		streets: [
			"Alder Street",
			"Birchwood Lane",
			"Hawthorn Close",
			"Rowan Street",
		],
	},
	{
		name: "Old Mill",
		pricePerSqft: 480,
		streets: ["Mill Race Lane", "Tanner Row", "Cobble Row", "Drover Lane"],
	},
	{
		name: "Northgate",
		pricePerSqft: 390,
		streets: [
			"Dunmore Road",
			"Pembury Avenue",
			"Quarry Road",
			"Underhill Road",
		],
	},
	{
		name: "Cedar Heights",
		pricePerSqft: 610,
		streets: ["Juniper Way", "Kestrel Court", "Orchard Rise", "Vesper Lane"],
	},
	{
		name: "Stonebridge",
		pricePerSqft: 450,
		streets: ["Fenwick Street", "Garnet Row", "Bellamy Street", "Ashby Place"],
	},
	{
		name: "Riverside",
		pricePerSqft: 660,
		streets: [
			"Larkspur Road",
			"Marigold Street",
			"Wren Street",
			"Foxglove Road",
		],
	},
	{
		name: "Elm Terrace",
		pricePerSqft: 420,
		streets: ["Ivory Lane", "Nettle Lane", "Yarrow Close", "Ember Court"],
	},
] as const satisfies readonly [Neighborhood, ...Neighborhood[]];

/** The name of one district, picked with `random`. A seller lead names the district of the home to sell. */
export function pickNeighborhoodName(random: () => number): string {
	return pickOne<Neighborhood>(random, NEIGHBORHOODS).name;
}

type TypeSpec = {
	/** Share of the listings of this type. */
	weight: number;
	/** The smallest and the largest living area, in square feet. */
	area: readonly [number, number];
	bedrooms: readonly [number, number];
	yearBuilt: readonly [number, number];
	parking: readonly [number, number];
	/** True for a home in a building: it has a unit and a floor. */
	isUnit: boolean;
	features: readonly ListingFeature[];
	/** Texts that fit a home of this type on any floor. */
	summaries: readonly [string, ...string[]];
	/** A text that fits only a unit on floor 1. */
	groundFloorSummary?: string;
	/** A text that fits only a unit on floor 7 or higher. */
	topFloorSummary?: string;
};

const TYPE_SPECS = {
	apartment: {
		weight: 40,
		area: [640, 1380],
		bedrooms: [1, 3],
		yearBuilt: [1962, 2022],
		parking: [0, 1],
		isUnit: true,
		features: [
			"balcony",
			"elevator",
			"concierge",
			"storage",
			"renovated",
			"south_facing",
			"bike_room",
			"hardwood_floors",
			"river_view",
			"home_office",
		],
		summaries: [
			"Bright corner apartment with an open kitchen and a quiet bedroom wing.",
			"Well-kept apartment with a dining nook and a full wall of closets.",
		],
		groundFloorSummary:
			"Garden-level apartment with its own entrance and a paved patio.",
		topFloorSummary:
			"Top-floor apartment with long views and a wide living room.",
	},
	house: {
		weight: 27,
		area: [1650, 3400],
		bedrooms: [3, 5],
		yearBuilt: [1924, 2018],
		parking: [1, 2],
		isUnit: false,
		features: [
			"garden",
			"garage",
			"fireplace",
			"basement",
			"renovated",
			"home_office",
			"terrace",
			"south_facing",
			"hardwood_floors",
		],
		summaries: [
			"Detached family house on a deep lot with a mature garden.",
			"Brick house with a new kitchen and a double reception room.",
			"Corner house with a wraparound porch and a finished basement.",
			"Quiet house at the end of the street, with a workshop behind the garage.",
		],
	},
	townhouse: {
		weight: 16,
		area: [1380, 2350],
		bedrooms: [3, 4],
		yearBuilt: [1890, 2015],
		// At least 1 space: a townhouse can name its garage in the summary and in the features.
		parking: [1, 2],
		isUnit: false,
		features: [
			"terrace",
			"garden",
			"garage",
			"fireplace",
			"basement",
			"renovated",
			"home_office",
			"hardwood_floors",
			"south_facing",
		],
		summaries: [
			"Three-storey townhouse with a roof terrace and a private garage.",
			"Period townhouse with tall windows and the original floors.",
			"End-of-row townhouse with a walled garden and a study.",
		],
	},
	loft: {
		weight: 9,
		area: [880, 1850],
		bedrooms: [1, 2],
		yearBuilt: [1905, 1938],
		parking: [0, 1],
		isUnit: true,
		features: [
			"high_ceilings",
			"hardwood_floors",
			"elevator",
			"terrace",
			"home_office",
			"storage",
			"renovated",
			"river_view",
		],
		summaries: [
			"Converted warehouse loft with exposed beams and steel windows.",
			"Open-plan loft with a mezzanine bedroom and a freight elevator.",
			"Double-height loft with a studio corner and polished concrete floors.",
		],
	},
	studio: {
		weight: 8,
		area: [410, 560],
		bedrooms: [0, 0],
		yearBuilt: [1975, 2021],
		parking: [0, 0],
		isUnit: true,
		features: [
			"renovated",
			"storage",
			"elevator",
			"bike_room",
			"south_facing",
			"balcony",
		],
		summaries: [
			"Compact studio with a sleeping alcove and built-in storage.",
			"Sunny studio one block from the tram stop.",
			"Renovated studio with a separate kitchen and a small balcony.",
		],
	},
} as const satisfies Record<PropertyType, TypeSpec>;

/** Days before today that the sample data covers: two periods of 90 days, so the longest trend has its earlier period. */
export const HISTORY_DAYS = 180;
// Days after today that hold a "coming soon" listing.
const COMING_SOON_DAYS = 6;
// Salt of the listing stream of a day. sample-leads.ts uses other salts.
const LISTING_SALT = 11;
// On about 3 days of 10, one home goes on the market.
const LISTING_CHANCE = 0.31;
// Shares of the three lives of a listing: it sells, the seller withdraws it, or it stays on the market.
const SELLS_SHARE = 0.6;
const WITHDRAWN_SHARE = 0.08;

function roundTo(value: number, step: number): number {
	return Math.round(value / step) * step;
}

/** The listing that starts on `dayNumber`, or null when no home goes on the market that day. */
function planListing(dayNumber: number): ListingPlan | null {
	const random = createSeededRandom(seedOf(dayNumber, LISTING_SALT));
	if (random() >= LISTING_CHANCE) {
		return null;
	}
	const type = pickWeighted(random, [
		["apartment", TYPE_SPECS.apartment.weight],
		["house", TYPE_SPECS.house.weight],
		["townhouse", TYPE_SPECS.townhouse.weight],
		["loft", TYPE_SPECS.loft.weight],
		["studio", TYPE_SPECS.studio.weight],
	] as const);
	const spec: TypeSpec = TYPE_SPECS[type];
	const neighborhood: Neighborhood = pickOne<Neighborhood>(
		random,
		NEIGHBORHOODS,
	);
	const sizeShare = random();
	// Whole tens of square feet, like a listing sheet.
	const areaSqft = roundTo(
		spec.area[0] + sizeShare * (spec.area[1] - spec.area[0]),
		10,
	);
	// A larger home of its type has more bedrooms.
	const bedrooms = Math.min(
		spec.bedrooms[1],
		spec.bedrooms[0] +
			Math.floor(
				(sizeShare * 0.8 + random() * 0.35) *
					(spec.bedrooms[1] - spec.bedrooms[0] + 1),
			),
	);
	const floor = spec.isUnit ? randomInt(random, 1, 9) : null;
	// Prices end on a multiple of 5,000, like real asking prices.
	const originalPrice = roundTo(
		areaSqft * neighborhood.pricePerSqft * (0.9 + random() * 0.22),
		5000,
	);

	// 09:00 to 10:59: the agency publishes a listing in the morning.
	const listedAt = timeOnDay(dayNumber, randomInt(random, 540, 659));
	const life = random();
	// Most homes get an offer in the first weeks. The power makes a long wait rare.
	const daysToOffer = 12 + Math.floor(random() ** 1.6 * 70);
	const daysToWithdrawal = randomInt(random, 45, 120);
	const offerAcceptedAt =
		life < SELLS_SHARE
			? timeOnDay(dayNumber + daysToOffer, randomInt(random, 900, 1050))
			: null;
	const withdrawnAt =
		life >= SELLS_SHARE && life < SELLS_SHARE + WITHDRAWN_SHARE
			? timeOnDay(dayNumber + daysToWithdrawal, randomInt(random, 600, 960))
			: null;
	const closesAt = offerAcceptedAt ?? withdrawnAt ?? Number.POSITIVE_INFINITY;
	// A sale completes 30 to 58 days after the offer: the time of the lawyers and the bank.
	const soldAt =
		offerAcceptedAt === null
			? null
			: offerAcceptedAt + randomInt(random, 30, 58) * DAY_MS;

	// A home with no offer after 4 to 8 weeks often gets a price cut of 3 to 7 percent.
	const reductionAt = timeOnDay(dayNumber + randomInt(random, 28, 55), 600);
	const reductionShare = randomInt(random, 3, 7) / 100;
	const isReduced = random() < 0.65 && reductionAt < closesAt - 6 * DAY_MS;
	const reducedPrice = isReduced
		? roundTo(originalPrice * (1 - reductionShare), 5000)
		: null;
	// The accepted offer is 0 to 4.5 percent under the asking price.
	const agreedPrice = roundTo(
		(reducedPrice ?? originalPrice) * (0.955 + random() * 0.045),
		1000,
	);

	const agent = pickWeighted(random, [
		[AGENTS[0].id, AGENTS[0].listingShare],
		...AGENTS.slice(1).map((item) => [item.id, item.listingShare] as const),
	]);
	const houseNumber = randomInt(random, 2, 248);
	// The reference is the day number minus a fixed base, so it has four digits and never repeats.
	const id = `KS-${dayNumber - 16_000}`;

	return {
		id,
		dayNumber,
		street: `${houseNumber} ${pickOne(random, neighborhood.streets)}`,
		unit:
			floor === null
				? null
				: `Unit ${floor}${pickOne(random, ["A", "B", "C", "D", "E", "F"])}`,
		neighborhood: neighborhood.name,
		type,
		bedrooms,
		bathrooms: Math.max(1, Math.round(bedrooms * 0.55 + random() * 0.7)),
		areaSqft,
		yearBuilt: randomInt(random, spec.yearBuilt[0], spec.yearBuilt[1]),
		floor,
		parkingSpaces: randomInt(random, spec.parking[0], spec.parking[1]),
		features: pickSome(random, spec.features, 4),
		summary: pickOne(random, [
			...spec.summaries,
			// A floor text fits only its floor: "garden-level" on floor 1, "top-floor" from floor 7.
			...(floor === 1 && spec.groundFloorSummary
				? [spec.groundFloorSummary]
				: []),
			...(floor !== null && floor >= 7 && spec.topFloorSummary
				? [spec.topFloorSummary]
				: []),
		]),
		originalPrice,
		reducedPrice,
		reducedAt: isReduced ? reductionAt : null,
		listedAt,
		// The seller signs 5 to 16 days before the first market day: photos and papers take that long.
		instructedAt: listedAt - randomInt(random, 5, 16) * DAY_MS,
		offerAcceptedAt,
		agreedPrice,
		soldAt,
		withdrawnAt,
		closesAt,
		sellerName: sellerNameOf(dayNumber),
		agentId: agent,
		firstDayViews: randomInt(random, 35, 95),
	};
}

// The plans of one day never change, and every query of a page load asks for them.
// The cache holds the plans of the last day asked, so a load builds them once.
let cachedPlans: { today: number; plans: ListingPlan[] } | null = null;

/** Every listing plan from `HISTORY_DAYS` before the day `today` to 6 days after it, oldest first. */
export function listListingPlans(today: number): ListingPlan[] {
	if (cachedPlans?.today === today) {
		return cachedPlans.plans;
	}
	const plans: ListingPlan[] = [];
	for (
		let dayNumber = today - HISTORY_DAYS;
		dayNumber <= today + COMING_SOON_DAYS;
		dayNumber += 1
	) {
		const plan = planListing(dayNumber);
		if (plan) {
			plans.push(plan);
		}
	}
	cachedPlans = { today, plans };
	return plans;
}

/** A plan at the time `now`: only the facts that are true at that time. A future date is null. */
export function listingAt(plan: ListingPlan, now: number): Listing {
	const isListed = plan.listedAt <= now;
	const hasOffer = plan.offerAcceptedAt !== null && plan.offerAcceptedAt <= now;
	const isSold = plan.soldAt !== null && plan.soldAt <= now;
	const isWithdrawn = plan.withdrawnAt !== null && plan.withdrawnAt <= now;
	const isReduced = plan.reducedAt !== null && plan.reducedAt <= now;
	const status: ListingStatus = !isListed
		? "coming_soon"
		: isWithdrawn
			? "withdrawn"
			: isSold
				? "sold"
				: hasOffer
					? "under_offer"
					: "active";
	// The portal counts visits only while the home is on the market.
	const marketDays = isListed
		? (Math.min(now, plan.closesAt) - plan.listedAt) / DAY_MS
		: 0;
	return {
		id: plan.id,
		street: plan.street,
		unit: plan.unit,
		neighborhood: plan.neighborhood,
		type: plan.type,
		bedrooms: plan.bedrooms,
		bathrooms: plan.bathrooms,
		areaSqft: plan.areaSqft,
		yearBuilt: plan.yearBuilt,
		floor: plan.floor,
		parkingSpaces: plan.parkingSpaces,
		features: [...plan.features],
		summary: plan.summary,
		askingPrice:
			isReduced && plan.reducedPrice !== null
				? plan.reducedPrice
				: plan.originalPrice,
		originalPrice: plan.originalPrice,
		priceReducedAt:
			isReduced && plan.reducedAt !== null
				? new Date(plan.reducedAt).toISOString()
				: null,
		status,
		listedAt: new Date(plan.listedAt).toISOString(),
		instructedAt: new Date(plan.instructedAt).toISOString(),
		offerAcceptedAt:
			hasOffer && plan.offerAcceptedAt !== null
				? new Date(plan.offerAcceptedAt).toISOString()
				: null,
		agreedPrice: hasOffer ? plan.agreedPrice : null,
		soldAt:
			isSold && plan.soldAt !== null
				? new Date(plan.soldAt).toISOString()
				: null,
		withdrawnAt:
			isWithdrawn && plan.withdrawnAt !== null
				? new Date(plan.withdrawnAt).toISOString()
				: null,
		sellerName: plan.sellerName,
		agentId: plan.agentId,
		// The visits of a day fall with the age of the listing: a time constant of 22 days, then 3 a day.
		portalViews: Math.round(
			plan.firstDayViews * 22 * (1 - Math.exp(-marketDays / 22)) +
				3 * marketDays,
		),
	};
}

/** Every listing at the time `now`, oldest first. A home that is not yet instructed does not exist. */
export function listListings(now: number): Listing[] {
	return listListingPlans(dayNumberOf(now))
		.filter((plan) => plan.instructedAt <= now)
		.map((plan) => listingAt(plan, now));
}

/** Whole days that `listing` was on the market until `now`, or until it left the market. 0 before the first day. */
export function daysOnMarketOf(listing: Listing, now: number): number {
	const end = listing.offerAcceptedAt ?? listing.withdrawnAt;
	const endMs = end === null ? now : Date.parse(end);
	return Math.max(
		0,
		Math.floor((endMs - Date.parse(listing.listedAt)) / DAY_MS),
	);
}
