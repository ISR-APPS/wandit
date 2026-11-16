// The full life of every sample lead, with its viewings and its offer: the plan behind sample-leads.ts
// and sample-viewings.ts. Each lead has its own seed, so it keeps its facts from one day to the next.
// A plan holds future times too. The two sample modules show only what is true at the time of the read.
import {
	DAY_MS,
	dayNumberOf,
	HOUR_MS,
	MINUTE_MS,
	timeOnDay,
	weekdayOf,
} from "./agency-clock";
import { AGENTS, type Agent } from "./sample-agents";
import type {
	Financing,
	LeadInterest,
	LeadSource,
	LostReason,
} from "./sample-leads";
import {
	HISTORY_DAYS,
	type ListingFeature,
	type ListingPlan,
	listListingPlans,
	PROPERTY_TYPES,
	type PropertyType,
	pickNeighborhoodName,
} from "./sample-listings";
import { buyerNameOf, emailOf, leadNameOf, phoneOf } from "./sample-people";
import type { ViewingInterest } from "./sample-viewings";
import {
	createSeededRandom,
	pickOne,
	pickWeighted,
	randomInt,
	seedOf,
} from "./seeded-random";

/** One planned viewing of a lead. Times are milliseconds since 1970. */
export type ViewingPlan = {
	/** 1 for the first visit of the lead, 2 for the second. */
	index: number;
	/** The time the agent books the visit with the lead. The viewing exists from this time. */
	bookedAt: number;
	/** The time the seller confirms the visit. Before it, the viewing waits for a confirmation. */
	confirmedAt: number;
	startsAt: number;
	/** What happens at `startsAt`. */
	outcome: "completed" | "no_show" | "cancelled";
	/** How much the lead likes the home after a completed visit. */
	interest: ViewingInterest;
	/** A number from 0 to 1. It picks the note of the agent among the notes that fit this visit. */
	noteDraw: number;
	/** The note of the agent after a completed visit. assignFeedback fills it when all plans exist. */
	feedback: string;
};

/** The full life of one lead. Times are milliseconds since 1970. */
export type LeadPlan = {
	id: string;
	fullName: string;
	email: string;
	phone: string;
	interest: LeadInterest;
	source: LeadSource;
	/** The home that a buyer asks about. null for a seller, and for a buyer with no home in mind. */
	listing: ListingPlan | null;
	/** The district of the home, of the search of a buyer, or of the home that a seller wants to sell. */
	area: string;
	/** The kind of home that a seller wants to sell. null for a buyer. */
	sellType: PropertyType | null;
	message: string;
	budget: number | null;
	financing: Financing | null;
	agentId: string;
	createdAt: number;
	/** The time of the first answer of an agent. Before it, the lead is "new". */
	respondedAt: number;
	viewings: ViewingPlan[];
	offerAt: number | null;
	offerAmount: number | null;
	/** The time the lead buys the home, or signs as a seller. null when that never happens. */
	wonAt: number | null;
	/** The time the agency closes the lead with no sale. null when that never happens. */
	lostAt: number | null;
	lostReason: LostReason | null;
};

// Salts of the seeded streams. sample-listings.ts uses 11.
const DAY_COUNT_SALT = 23;
const LEAD_SALT = 37;
const BUYER_SALT = 53;
const RUN_SALT = 61;
// At most 6 leads arrive on one day. The sequence number of a lead is day * 7 + its place in the day.
const MAX_LEADS_PER_DAY = 6;
const SEQUENCE_STEP = 7;
// The mean count of leads on a day, before the weekday and the season change it.
const BASE_LEADS_PER_DAY = 3.1;
// Sunday to Saturday. People look at homes on the weekend and write on Sunday and Monday.
const WEEKDAY_FACTORS = [1.3, 1.15, 1, 0.95, 0.9, 0.8, 1.2] as const;
// The start times of a viewing, in minutes after midnight: 09:30 to 18:00.
const VIEWING_SLOTS = [570, 630, 690, 780, 840, 900, 960, 1020, 1080] as const;
// The share of the buyer leads that ask for a viewing.
const VIEWING_SHARE = 0.6;
// The share of the leads that want to sell a home. The others want to buy one.
const SELLER_SHARE = 0.16;

const BUYER_MESSAGES = [
	"Hello, is this home still available? We could come for a viewing on Saturday morning.",
	"We saw the listing online and would like to know more about the building charges.",
	"Could you send the floor plan? We want to move before the spring.",
	"I walked past the sign yesterday. Is the price open to offers?",
	"We are relocating for work and need to see a few homes in one day. Is Thursday possible?",
	"I am a first-time buyer. Is there any flexibility on the asking price?",
	"Is the parking space included in the price? I would like to book a visit this week.",
	"My partner and I like the layout. How long has it been on the market?",
	"We sold our flat last month and can move fast. When can we see it?",
	"Does the seller accept a viewing after 6 pm? I work late on weekdays.",
	"We need a home near the school. Can you tell me about the street noise?",
	"A friend bought through your agency and recommended you. I am interested in this one.",
] as const;

const SEARCH_MESSAGES = [
	"We want a three-bedroom home near a park. Please send us your new listings.",
	"Do you have a home with a garden in our budget? We can move in the spring.",
	"I would like to register as a buyer. Two bedrooms, close to the tram.",
	"We rent in the area and want to buy this year. What comes to the market soon?",
] as const;

const SELLER_MESSAGES = [
	"We plan to sell our home this year and would like a valuation.",
	"I inherited a property and need advice on the sale. Could someone visit next week?",
	"What is our home worth today? We are thinking about a smaller place.",
	"We move abroad in the summer and want to list our home. What are your fees?",
	"Our current agent has had the listing for six months. We want a second opinion.",
] as const;

/** One note of an agent after a visit. */
type FeedbackNote = {
	text: string;
	/** True when the note fits this home on this visit (1 or 2). No rule: the note fits every visit. */
	fits?: (listing: ListingPlan, visit: number) => boolean;
};

function hasFeature(listing: ListingPlan, feature: ListingFeature): boolean {
	return listing.features.includes(feature);
}

// The first note of each list has no rule, so every visit has at least one note that fits.
const FEEDBACK = {
	hot: [
		{
			text: "Loved the light in the living room. Asked about the completion date.",
		},
		{
			text: "Measured the second bedroom for a desk. Wants a second visit with a parent.",
			fits: (listing, visit) => listing.bedrooms >= 2 && visit === 1,
		},
		{
			text: "Asked what offer the seller would accept. Financing is in place.",
		},
		{
			text: "Asked about the neighbors and the monthly charges of the building.",
			fits: (listing) => listing.floor !== null,
		},
		{
			text: "Their mortgage advisor calls us tomorrow. They want to move fast.",
		},
		{
			text: "Already picked a room for the children. Asked for the energy report.",
			fits: (listing) => listing.bedrooms >= 2,
		},
		{ text: "Sold their flat last month. Ready to make an offer this week." },
		{
			text: "Brought a builder along. Plans to open the kitchen to the dining room.",
		},
		{
			text: "Asked if the seller leaves the curtains and the lights. A good sign.",
		},
		{ text: "Walked to the school after the visit. Calls back tonight." },
		{
			text: "Checked the water pressure and the windows this time.",
			fits: (_listing, visit) => visit > 1,
		},
		{
			text: "Came back with their parents. Everyone liked it.",
			fits: (_listing, visit) => visit > 1,
		},
		{ text: "Wants the survey booked before the weekend." },
		{ text: "Asked how soon the seller can move out." },
	],
	warm: [
		{ text: "Liked the kitchen, unsure about the street noise." },
		{ text: "Good fit on size. Wants to compare with two other homes." },
		{ text: "Positive, but the bathroom needs work for their budget." },
		{ text: "Interested if the price moves a little." },
		{
			text: "Likes the area. Worried about the stairs for a parent.",
			fits: (listing) =>
				listing.floor === null ||
				(listing.floor > 1 && !hasFeature(listing, "elevator")),
		},
		{
			text: "Wants to see it again on a weekday evening, for the traffic.",
			fits: (_listing, visit) => visit === 1,
		},
		{
			text: "The garden sells it. The second bedroom is small for them.",
			fits: (listing) => hasFeature(listing, "garden") && listing.bedrooms >= 2,
		},
		{
			text: "Asked about the age of the boiler and the roof.",
			fits: (listing) => listing.floor === null,
		},
		{ text: "Keen, but must sell their own home first." },
		{
			text: "Happy with the layout. Parking on the street is a question.",
			fits: (listing) => listing.parkingSpaces === 0,
		},
		{
			text: "Will come back with a partner who was away this week.",
			fits: (_listing, visit) => visit === 1,
		},
		{ text: "Likes the light. Thinks the asking price is high." },
		{ text: "Liked the living room. Wants a quote to repaint it." },
		{ text: "Good street, but they hoped for a bigger kitchen." },
		{ text: "Asked for the energy bills of last winter." },
		{ text: "The commute works. They want to check the schools first." },
		{ text: "Likes it more than the last two homes they saw." },
		{
			text: "Needs to talk to the bank before a second visit.",
			fits: (_listing, visit) => visit === 1,
		},
		{
			text: "Asked if the storage room comes with the unit.",
			fits: (listing) =>
				listing.floor !== null && hasFeature(listing, "storage"),
		},
		{
			text: "Liked the balcony. Unsure about the size of the bedrooms.",
			fits: (listing) =>
				hasFeature(listing, "balcony") && listing.bedrooms >= 1,
		},
		{ text: "Interested. Asked how many offers the seller has had." },
	],
	cold: [
		{ text: "Too far from the station for a daily commute." },
		{
			text: "Found the bedrooms too small.",
			fits: (listing) => listing.bedrooms >= 1,
		},
		{
			text: "Wanted outdoor space. Not a fit.",
			fits: (listing) =>
				!hasFeature(listing, "balcony") &&
				!hasFeature(listing, "terrace") &&
				!hasFeature(listing, "garden"),
		},
		{
			text: "The layout does not work for a home office.",
			fits: (listing) => !hasFeature(listing, "home_office"),
		},
		{
			text: "Expected more storage. Will keep looking.",
			fits: (listing) =>
				!hasFeature(listing, "storage") && !hasFeature(listing, "basement"),
		},
		{
			text: "The rooms feel too dark. Not for them.",
			fits: (listing) => !hasFeature(listing, "south_facing"),
		},
		{
			text: "Prefers a building with an elevator.",
			fits: (listing) =>
				listing.floor !== null &&
				listing.floor > 1 &&
				!hasFeature(listing, "elevator"),
		},
		{ text: "Budget is under the asking price by a wide margin." },
		{
			text: "Did not like the shared entrance.",
			fits: (listing) => listing.floor !== null,
		},
		{
			text: "Needs three bedrooms after all. Keep them on the list.",
			fits: (listing) => listing.bedrooms < 3,
		},
		{ text: "The street is busier than they expected." },
		{
			text: "Looked fine, but they want a move-in ready home.",
			fits: (listing) => !hasFeature(listing, "renovated"),
		},
		{ text: "The kitchen is too small for them." },
		{ text: "Not a fit once they add the cost of the survey and the move." },
	],
} as const satisfies Record<
	ViewingInterest,
	readonly [FeedbackNote, ...FeedbackNote[]]
>;

/** The count of leads of the day `dayNumber` before runs are broken: a weekday rhythm, two slow waves, and noise. */
function rawLeadCountOf(dayNumber: number): number {
	const random = createSeededRandom(seedOf(dayNumber, DAY_COUNT_SALT));
	const weekdayFactor = WEEKDAY_FACTORS[weekdayOf(dayNumber)] ?? 1;
	// Two waves of 150 and 47 days: the market has slow seasons, and no two months look the same.
	const season =
		1 +
		0.22 * Math.sin((2 * Math.PI * dayNumber) / 150) +
		0.1 * Math.sin((2 * Math.PI * dayNumber) / 47);
	const noise = 0.55 + random() * 0.9;
	return Math.min(
		MAX_LEADS_PER_DAY,
		Math.round(BASE_LEADS_PER_DAY * weekdayFactor * season * noise),
	);
}

/** The count of leads that arrive on the day `dayNumber`. Three equal days in a row are rare in real life. */
function leadCountOf(dayNumber: number): number {
	const count = rawLeadCountOf(dayNumber);
	if (
		count !== rawLeadCountOf(dayNumber - 1) ||
		count !== rawLeadCountOf(dayNumber - 2)
	) {
		return count;
	}
	// The third equal day moves 1 up or 1 down, inside 1 to the daily maximum. Its own salt keeps the other streams.
	const random = createSeededRandom(seedOf(dayNumber, RUN_SALT));
	if (count <= 1) {
		return count + 1;
	}
	if (count >= MAX_LEADS_PER_DAY) {
		return count - 1;
	}
	return random() < 0.5 ? count - 1 : count + 1;
}

/** An answer time inside the hours of the team: an answer after 22:00 or before 07:00 moves to the next morning. */
function inOfficeHours(ms: number, random: () => number): number {
	const hour = new Date(ms).getHours();
	if (hour >= 7 && hour < 22) {
		return ms;
	}
	const morning = hour >= 22 ? dayNumberOf(ms) + 1 : dayNumberOf(ms);
	// 08:10 to 09:40: the team reads the night mail first.
	return timeOnDay(morning, randomInt(random, 490, 580));
}

/** A viewing on the day `dayNumber`. No viewing takes place on a Sunday: it moves to the Monday. */
function planViewing(
	random: () => number,
	index: number,
	bookedAt: number,
	dayNumber: number,
	outcome: ViewingPlan["outcome"],
	interest: ViewingInterest,
): ViewingPlan {
	const viewingDay = weekdayOf(dayNumber) === 0 ? dayNumber + 1 : dayNumber;
	const startsAt = timeOnDay(viewingDay, pickOne(random, VIEWING_SLOTS));
	// The seller confirms 4 to 60 hours after the booking, and 3 hours before the visit at the latest.
	const confirmedAt = Math.max(
		bookedAt,
		Math.min(
			bookedAt + randomInt(random, 4, 60) * HOUR_MS,
			startsAt - 3 * HOUR_MS,
		),
	);
	return {
		index,
		bookedAt,
		confirmedAt,
		startsAt,
		outcome,
		interest,
		noteDraw: random(),
		feedback: "",
	};
}

// With this count of homes on the market, 92 % of the buyers ask about one of them.
// With fewer homes, more buyers only describe what they look for.
const FULL_MARKET = 28;

/**
 * The listing that a buyer of the time `createdAt` asks about. A newer listing gets more leads.
 * null for a buyer with no home in mind.
 */
function pickListing(
	random: () => number,
	plans: ListingPlan[],
	createdAt: number,
): ListingPlan | null {
	const onMarket = plans.filter(
		(plan) => plan.listedAt < createdAt && createdAt < plan.closesAt,
	);
	if (random() >= Math.min(0.92, onMarket.length / FULL_MARKET)) {
		return null;
	}
	// A listing of today weighs 1.15. After 10 days it weighs half of that, and never under 0.15.
	const weights = onMarket.map(
		(plan) => 0.15 + 1 / (1 + (createdAt - plan.listedAt) / (10 * DAY_MS)),
	);
	let cursor = random() * weights.reduce((sum, weight) => sum + weight, 0);
	for (const [index, plan] of onMarket.entries()) {
		cursor -= weights[index] ?? 0;
		if (cursor < 0) {
			return plan;
		}
	}
	return onMarket.at(-1) ?? null;
}

/** One lead of the day `dayNumber`. `place` is its place in the day, from 0. */
function planLead(
	dayNumber: number,
	place: number,
	minuteOfDay: number,
	listings: ListingPlan[],
): LeadPlan {
	const sequence = dayNumber * SEQUENCE_STEP + place;
	const random = createSeededRandom(seedOf(sequence, LEAD_SALT));
	const createdAt = timeOnDay(dayNumber, minuteOfDay);
	const fullName = leadNameOf(sequence);
	const isSeller = random() < SELLER_SHARE;
	const listing = isSeller ? null : pickListing(random, listings, createdAt);

	// 60 % get an answer in under 3 hours, 14 % in the same day or the next, and 26 % wait 2 to 9 days.
	const answerKind = random();
	const answerMinutes =
		answerKind < 0.6
			? randomInt(random, 8, 170)
			: answerKind < 0.74
				? randomInt(random, 180, 22 * 60)
				: randomInt(random, 2 * 24 * 60, 9 * 24 * 60);
	const respondedAt = inOfficeHours(
		createdAt + answerMinutes * MINUTE_MS,
		random,
	);
	const source = pickWeighted<LeadSource>(random, [
		["portal", 42],
		["website", 22],
		["referral", 12],
		["signboard", 9],
		["social", 9],
		["walk_in", 6],
	]);
	const base = {
		// The id is the sequence number with a fixed base removed, so it stays short.
		id: `L-${(dayNumber - 16_000) * 10 + place}`,
		fullName,
		email: emailOf(fullName),
		phone: phoneOf(sequence),
		source,
		createdAt,
		respondedAt,
	};

	if (isSeller) {
		// A seller signs with the agency 6 to 25 days after the first answer, or goes away.
		const signs = random() < 0.3;
		const decidedDay =
			dayNumberOf(respondedAt) +
			(signs ? randomInt(random, 6, 25) : randomInt(random, 10, 35));
		// 09:00 to 17:30: the agency signs or closes a seller in the office hours.
		const decidedAt = timeOnDay(decidedDay, randomInt(random, 540, 1050));
		return {
			...base,
			interest: "sell",
			listing: null,
			area: pickNeighborhoodName(random),
			sellType: pickOne(random, PROPERTY_TYPES),
			message: pickOne(random, SELLER_MESSAGES),
			budget: null,
			financing: null,
			agentId: pickOne<Agent>(random, AGENTS).id,
			viewings: [],
			offerAt: null,
			offerAmount: null,
			wonAt: signs ? decidedAt : null,
			lostAt: signs ? null : decidedAt,
			lostReason: signs
				? null
				: pickWeighted<LostReason>(random, [
						["other_agency", 45],
						["changed_plans", 30],
						["no_reply", 25],
					]),
		};
	}

	if (listing === null) {
		// A buyer with no home in mind stays on the mailing list for 2 to 8 weeks.
		return {
			...base,
			interest: "buy",
			listing: null,
			area: pickNeighborhoodName(random),
			sellType: null,
			message: pickOne(random, SEARCH_MESSAGES),
			// 280,000 to 1,400,000, on a multiple of 10,000.
			budget: randomInt(random, 28, 140) * 10_000,
			financing: pickWeighted<Financing>(random, [
				["cash", 12],
				["pre_approved", 38],
				["mortgage_needed", 50],
			]),
			agentId: pickOne<Agent>(random, AGENTS).id,
			viewings: [],
			offerAt: null,
			offerAmount: null,
			wonAt: null,
			lostAt: respondedAt + randomInt(random, 15, 55) * DAY_MS,
			lostReason: pickWeighted<LostReason>(random, [
				["no_reply", 40],
				["bought_elsewhere", 35],
				["budget", 15],
				["changed_plans", 10],
			]),
		};
	}

	const viewings: ViewingPlan[] = [];
	if (random() < VIEWING_SHARE) {
		const bookedAt = respondedAt + randomInt(random, 8, 150) * MINUTE_MS;
		const outcome = pickWeighted<ViewingPlan["outcome"]>(random, [
			["completed", 84],
			["no_show", 7],
			["cancelled", 9],
		]);
		const interest = pickWeighted<ViewingInterest>(random, [
			["hot", 25],
			["warm", 45],
			["cold", 30],
		]);
		const first = planViewing(
			random,
			1,
			bookedAt,
			dayNumberOf(bookedAt) + randomInt(random, 1, 9),
			outcome,
			interest,
		);
		// A home under offer takes no more viewings.
		if (first.startsAt < listing.closesAt) {
			viewings.push(first);
			const wantsSecond =
				outcome === "completed" && interest !== "cold" && random() < 0.4;
			const second = planViewing(
				random,
				2,
				first.startsAt + randomInt(random, 2, 30) * HOUR_MS,
				dayNumberOf(first.startsAt) + randomInt(random, 2, 8),
				random() < 0.9 ? "completed" : "cancelled",
				// A second visit keeps the interest, or raises it.
				random() < 0.5 ? "hot" : interest,
			);
			if (wantsSecond && second.startsAt < listing.closesAt) {
				viewings.push(second);
			}
		}
	}

	const lastViewing = viewings.at(-1);
	const sawTheHome = lastViewing?.outcome === "completed";
	// Half of the keen leads make an offer, and 1 in 8 of the warm ones. The seller declines it later.
	const offerChance =
		!sawTheHome || lastViewing === undefined
			? 0
			: lastViewing.interest === "hot"
				? 0.5
				: lastViewing.interest === "warm"
					? 0.12
					: 0;
	const offerTime =
		(lastViewing?.startsAt ?? 0) + randomInt(random, 20, 96) * HOUR_MS;
	const makesOffer = random() < offerChance && offerTime < listing.closesAt;
	const askingPrice = listing.reducedPrice ?? listing.originalPrice;

	// The time the lead goes cold when the home stays on the market, and why.
	let lostAt: number;
	let lostReason: LostReason;
	if (lastViewing === undefined) {
		lostAt = respondedAt + randomInt(random, 9, 38) * DAY_MS;
		lostReason = pickWeighted<LostReason>(random, [
			["no_reply", 45],
			["bought_elsewhere", 25],
			["budget", 20],
			["changed_plans", 10],
		]);
	} else if (!sawTheHome) {
		lostAt = lastViewing.startsAt + randomInt(random, 3, 10) * DAY_MS;
		lostReason = "no_reply";
	} else if (makesOffer) {
		lostAt = offerTime + randomInt(random, 3, 9) * DAY_MS;
		lostReason = "offer_declined";
	} else {
		lostAt = lastViewing.startsAt + randomInt(random, 5, 14) * DAY_MS;
		lostReason =
			lastViewing.interest === "cold"
				? "not_a_fit"
				: pickWeighted<LostReason>(random, [
						["bought_elsewhere", 50],
						["changed_plans", 25],
						["budget", 25],
					]);
	}
	// The home leaves the market first: the agency closes the lead a few hours later.
	const goneAt = listing.closesAt + randomInt(random, 2, 26) * HOUR_MS;
	if (goneAt < lostAt) {
		lostAt = goneAt;
		lostReason = "property_gone";
	}

	// The draws keep their order (message, budget, then the fields below), so the other sample rows do not change.
	const message = pickOne(random, BUYER_MESSAGES);
	// A budget near the price, on a multiple of 5,000.
	const budget =
		Math.round((askingPrice * (0.92 + random() * 0.16)) / 5000) * 5000;
	return {
		...base,
		interest: "buy",
		listing,
		area: listing.neighborhood,
		sellType: null,
		message,
		budget,
		financing: pickWeighted<Financing>(random, [
			["cash", 18],
			["pre_approved", 44],
			["mortgage_needed", 38],
		]),
		agentId: listing.agentId,
		viewings,
		// An offer that arrives in the night reaches the team the next morning.
		offerAt: makesOffer ? inOfficeHours(offerTime, random) : null,
		// A first offer is 3.5 to 10 percent under the asking price, and never above the budget of the lead.
		offerAmount: makesOffer
			? Math.min(
					budget,
					Math.round((askingPrice * (0.9 + random() * 0.065)) / 1000) * 1000,
				)
			: null,
		wonAt: null,
		lostAt,
		lostReason,
	};
}

/** The lead that buys `listing`: it arrives 5 to 20 days before the accepted offer. null when the home does not sell. */
function planBuyer(listing: ListingPlan): LeadPlan | null {
	if (listing.offerAcceptedAt === null) {
		return null;
	}
	const random = createSeededRandom(seedOf(listing.dayNumber, BUYER_SALT));
	const offerDay = dayNumberOf(listing.offerAcceptedAt);
	// A home takes 12 days or more to get its offer, so the lead arrives after the first market day.
	const leadDays = randomInt(
		random,
		5,
		Math.min(20, offerDay - listing.dayNumber - 1),
	);
	const createdDay = offerDay - leadDays;
	const createdAt = timeOnDay(createdDay, randomInt(random, 450, 1300));
	const respondedAt = inOfficeHours(
		createdAt + randomInt(random, 6, 75) * MINUTE_MS,
		random,
	);
	// The first visit is 3 days or more before the offer. A Sunday visit moves 1 day later.
	const first = planViewing(
		random,
		1,
		respondedAt + randomInt(random, 8, 90) * MINUTE_MS,
		createdDay + randomInt(random, 1, leadDays - 3),
		"completed",
		"hot",
	);
	const viewings = [first];
	const firstDay = dayNumberOf(first.startsAt);
	if (firstDay + 1 <= offerDay - 2 && random() < 0.5) {
		viewings.push(
			planViewing(
				random,
				2,
				first.startsAt + randomInt(random, 2, 20) * HOUR_MS,
				randomInt(random, firstDay + 1, offerDay - 2),
				"completed",
				"hot",
			),
		);
	}
	const lastStart = viewings.at(-1)?.startsAt ?? first.startsAt;
	const fullName = buyerNameOf(listing.dayNumber);
	return {
		// Place 9 of the day of the listing: the other leads of a day use the places 0 to 5.
		id: `L-${(listing.dayNumber - 16_000) * 10 + 9}`,
		fullName,
		email: emailOf(fullName),
		phone: phoneOf(listing.dayNumber * 3 + 41),
		interest: "buy",
		source: pickWeighted<LeadSource>(random, [
			["portal", 40],
			["website", 20],
			["referral", 25],
			["signboard", 15],
		]),
		listing,
		area: listing.neighborhood,
		sellType: null,
		message: pickOne(random, BUYER_MESSAGES),
		budget: Math.ceil((listing.agreedPrice * 1.03) / 5000) * 5000,
		financing: pickWeighted<Financing>(random, [
			["cash", 30],
			["pre_approved", 70],
		]),
		agentId: listing.agentId,
		createdAt,
		respondedAt,
		viewings,
		// The offer comes 20 to 44 hours before the seller accepts it, and after the last visit.
		// A night offer moves to 08:10 to 09:40. The seller accepts from 15:00, so the order stays.
		offerAt: inOfficeHours(
			Math.max(
				lastStart + 2 * HOUR_MS,
				listing.offerAcceptedAt - randomInt(random, 20, 44) * HOUR_MS,
			),
			random,
		),
		offerAmount: listing.agreedPrice,
		wonAt: listing.soldAt,
		lostAt: null,
		lostReason: null,
	};
}

/** Moves a viewing 1 hour later while its agent has another viewing at the same time. */
function spreadViewings(leads: LeadPlan[]): void {
	const taken = new Set<string>();
	const slots = leads
		.flatMap((lead) =>
			lead.viewings.map((viewing) => ({ agentId: lead.agentId, viewing })),
		)
		.sort((first, second) => first.viewing.startsAt - second.viewing.startsAt);
	for (const { agentId, viewing } of slots) {
		while (taken.has(`${agentId}:${viewing.startsAt}`)) {
			viewing.startsAt += HOUR_MS;
		}
		taken.add(`${agentId}:${viewing.startsAt}`);
	}
}

// A note does not come back within the next 20 notes of the agency.
// The newest notes on the viewings page and on a listing then never repeat a text.
const RECENT_NOTES = 20;

/**
 * Gives each completed visit a note that fits its home and its visit number, in time order.
 * A home never gets the same note two times while other fitting notes are free.
 */
function assignFeedback(leads: LeadPlan[]): void {
	const visits = leads
		.flatMap(({ listing, viewings }) =>
			listing === null
				? []
				: viewings
						.filter((viewing) => viewing.outcome === "completed")
						.map((viewing) => ({ listing, viewing })),
		)
		.sort((first, second) => first.viewing.startsAt - second.viewing.startsAt);
	const usedByListing = new Map<string, Set<string>>();
	const recent: string[] = [];
	for (const { listing, viewing } of visits) {
		const notes: readonly FeedbackNote[] = FEEDBACK[viewing.interest];
		const fitting = notes
			.filter((note) => note.fits?.(listing, viewing.index) ?? true)
			.map((note) => note.text);
		const used = usedByListing.get(listing.id) ?? new Set<string>();
		const unused = fitting.filter((text) => !used.has(text));
		const fresh = unused.filter((text) => !recent.includes(text));
		// Fall back step by step when a busy home has used every fitting note.
		// Without a fresh note, the note used the longest time ago comes back.
		const pool = unused.length > 0 ? unused : fitting;
		const oldest = [...pool].sort(
			(first, second) => recent.indexOf(first) - recent.indexOf(second),
		)[0];
		const text =
			(fresh.length > 0
				? fresh[Math.floor(viewing.noteDraw * fresh.length)]
				: oldest) ?? FEEDBACK[viewing.interest][0].text;
		viewing.feedback = text;
		used.add(text);
		usedByListing.set(listing.id, used);
		recent.push(text);
		if (recent.length > RECENT_NOTES) {
			recent.shift();
		}
	}
}

// The plans of one day never change, and every query of a page load asks for them.
// The cache holds the plans of the last day asked, so a load builds them once.
let cachedPlans: { today: number; plans: LeadPlan[] } | null = null;

/** Every lead plan of the last `HISTORY_DAYS` days and of the day `today`, oldest first. */
export function listLeadPlans(today: number): LeadPlan[] {
	if (cachedPlans?.today === today) {
		return cachedPlans.plans;
	}
	const listings = listListingPlans(today);
	const plans: LeadPlan[] = [];
	for (
		let dayNumber = today - HISTORY_DAYS + 1;
		dayNumber <= today;
		dayNumber += 1
	) {
		const random = createSeededRandom(seedOf(dayNumber, DAY_COUNT_SALT + 1));
		// 07:10 to 22:20, in time order: the place of a lead in its day follows the clock.
		const minutes = Array.from({ length: leadCountOf(dayNumber) }, () =>
			randomInt(random, 430, 1340),
		).sort((first, second) => first - second);
		for (const [place, minuteOfDay] of minutes.entries()) {
			plans.push(planLead(dayNumber, place, minuteOfDay, listings));
		}
	}
	const firstDayStart = timeOnDay(today - HISTORY_DAYS + 1, 0);
	for (const listing of listings) {
		const buyer = planBuyer(listing);
		if (buyer && buyer.createdAt >= firstDayStart) {
			plans.push(buyer);
		}
	}
	plans.sort((first, second) => first.createdAt - second.createdAt);
	spreadViewings(plans);
	assignFeedback(plans);
	cachedPlans = { today, plans };
	return plans;
}
