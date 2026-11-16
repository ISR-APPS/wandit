// The sample ticket orders of each event: who bought, which tier, how many tickets, when, and the door scan.
// It stands in for the `orders` table. buildOrders replays the sales of each event day by day with a seed.
// An order of today exists only when its time has passed. A refund or a door scan shows only after its time.

import type { EventKind, EventRow, TicketTier } from "./sample-events";
import {
	createSeededRandom,
	pickWeighted,
	randomInt,
	shuffled,
} from "./seeded-random";
import {
	addDays,
	atMinute,
	calendarDaysBetween,
	MINUTE_MS,
	startOfLocalDay,
} from "./time";

/** One ticket order. A future `orders` row. */
export type Order = {
	/** Stable id, for example "evt-1013-o0042". */
	id: string;
	/** The reference on the ticket email, for example "SH1013-0042". */
	reference: string;
	eventId: string;
	tierId: string;
	tierName: string;
	/** Tickets in this order, 1 to 4. */
	quantity: number;
	/** The price of one ticket, in whole euros. */
	unitPrice: number;
	/** quantity x unitPrice, in whole euros. */
	amount: number;
	buyerName: string;
	buyerEmail: string;
	/** Milliseconds since 1970. Always before now. */
	placedAt: number;
	/** The refund time, or null. A refunded order has no valid ticket. */
	refundedAt: number | null;
	/** The first door scan of the order, or null. */
	checkedInAt: number | null;
};

const FIRST_NAMES = [
	"Amara",
	"Bastian",
	"Celine",
	"Darius",
	"Elena",
	"Farid",
	"Greta",
	"Hugo",
	"Ingrid",
	"Jonah",
	"Kaia",
	"Lucien",
	"Maren",
	"Nikolai",
	"Odile",
	"Pablo",
	"Quinn",
	"Rosalind",
	"Soren",
	"Talia",
	"Ulrich",
	"Valentina",
	"Wesley",
	"Ximena",
	"Yusuf",
	"Zelda",
	"Anouk",
	"Bruno",
	"Clara",
	"Dmitri",
	"Esme",
	"Felix",
	"Gisele",
	"Henrik",
	"Isadora",
	"Jasper",
	"Leila",
	"Marco",
	"Nadia",
	"Oscar",
	"Petra",
	"Rafael",
	"Sienna",
	"Theo",
	"Vera",
	"Wilhelm",
	"Yara",
	"Zane",
] as const;

const LAST_NAMES = [
	"Ainsworth",
	"Baptiste",
	"Castellano",
	"Delacroix",
	"Eriksen",
	"Fairbanks",
	"Galloway",
	"Halvorsen",
	"Ibarra",
	"Jansen",
	"Kowalczyk",
	"Lindqvist",
	"Marchetti",
	"Novak",
	"Okafor",
	"Pemberton",
	"Quintero",
	"Rasmussen",
	"Santoro",
	"Thornton",
	"Underwood",
	"Vasquez",
	"Whitlock",
	"Yamada",
	"Zielinski",
	"Achebe",
	"Brennan",
	"Carvalho",
	"Duval",
	"Esposito",
	"Fitzgerald",
	"Gutierrez",
	"Hartmann",
	"Iversen",
	"Jovanovic",
	"Kessler",
	"Lambert",
	"Moreau",
	"Nakamura",
	"Oyelaran",
	"Petrov",
	"Rinaldi",
	"Sorensen",
	"Takahashi",
	"Valdez",
	"Weber",
	"Xu",
	"Lockhart",
] as const;

// The reserved example domains: no email of the sample reaches a real inbox.
const EMAIL_DOMAINS = ["example.com", "example.net", "example.org"] as const;

// Orders per hour of the day, 7:00 to 23:00. Lunch and the evening sell the most.
const HOUR_WEIGHTS = [
	[7, 1],
	[8, 2],
	[9, 3],
	[10, 4],
	[11, 5],
	[12, 7],
	[13, 7],
	[14, 5],
	[15, 4],
	[16, 4],
	[17, 5],
	[18, 6],
	[19, 8],
	[20, 8],
	[21, 7],
	[22, 5],
	[23, 2],
] as const satisfies readonly (readonly [number, number])[];

// Tickets per order. Most people buy one or two.
const QUANTITY_WEIGHTS = [
	[1, 45],
	[2, 35],
	[3, 10],
	[4, 10],
] as const satisfies readonly (readonly [number, number])[];

// Sales per weekday, Sunday first. Midweek and Friday sell more than the weekend.
const WEEKDAY_FACTOR = [0.8, 0.9, 1.1, 1.05, 1.1, 1.15, 0.9] as const;

// The share of paid tickets that the door scans, per kind. Free-flow conferences lose more people.
const SHOW_RATE = {
	concert: 0.94,
	conference: 0.86,
	workshop: 0.95,
	comedy: 0.91,
	gala: 0.97,
} satisfies Record<EventKind, number>;

// About 2 orders in 100 ask for a refund, 1 to 12 days after the purchase.
const REFUND_RATE = 0.02;

/** One planned order of a day, before the name and the tier. */
type Draft = {
	minute: number;
	quantity: number;
	tierRoll: number;
	refundRoll: number;
	refundDays: number;
	showRoll: number;
	scanMinute: number;
	domainRoll: number;
};

/** The share of the sales of each day of the sale window. The first day spikes; the last two weeks rise. */
function dayWeights(windowStart: number, dayCount: number): number[] {
	return Array.from({ length: dayCount }, (_, index) => {
		const weekday = new Date(addDays(windowStart, index)).getDay();
		const launch = index === 0 ? 8 : index === 1 ? 3 : index === 2 ? 1.8 : 1;
		const daysLeft = dayCount - 1 - index;
		// The last 14 days rise to 3.5 times the base: people buy late.
		const lateRise = daysLeft < 14 ? 1 + ((14 - daysLeft) / 14) * 2.5 : 1;
		return launch * lateRise * (WEEKDAY_FACTOR[weekday] ?? 1);
	});
}

// A first name does not come back within 24 picks, and a last name within 20.
// So a page of 20 rows has no repeated first or last name. 48 names of each kind leave enough free pairs.
const FIRST_NAME_GAP = 24;
const LAST_NAME_GAP = 20;

/** A list of names with no repeat. Near names never share a first name, and adjacent names never share a last name. */
function createNamePicker(random: () => number): () => string {
	// Every first and last name pair, in a random order.
	const order = shuffled(
		random,
		Array.from(
			{ length: FIRST_NAMES.length * LAST_NAMES.length },
			(_, index) => index,
		),
	);
	let cursor = 0;
	const recentFirsts: number[] = [];
	const recentLasts: number[] = [];
	const isTooNear = (pair: number) =>
		recentFirsts.includes(Math.floor(pair / LAST_NAMES.length)) ||
		recentLasts.includes(pair % LAST_NAMES.length);
	return () => {
		// The next pair that is not too near moves forward. The list has 2,304 pairs, more than any event sells.
		let pick = cursor;
		while (pick < order.length - 1 && isTooNear(order[pick] ?? 0)) {
			pick += 1;
		}
		const value = order[pick] ?? 0;
		order[pick] = order[cursor] ?? 0;
		order[cursor] = value;
		cursor = Math.min(cursor + 1, order.length - 1);
		const first = Math.floor(value / LAST_NAMES.length);
		const last = value % LAST_NAMES.length;
		recentFirsts.push(first);
		recentLasts.push(last);
		if (recentFirsts.length > FIRST_NAME_GAP) {
			recentFirsts.shift();
		}
		if (recentLasts.length > LAST_NAME_GAP) {
			recentLasts.shift();
		}
		return `${FIRST_NAMES[first] ?? ""} ${LAST_NAMES[last] ?? ""}`;
	};
}

/** The email of a buyer: first.last at one of the example domains. */
function emailOf(name: string, domainRoll: number): string {
	const local = name
		.toLowerCase()
		.replace(/[^a-z ]/g, "")
		.replace(" ", ".");
	return `${local}@${EMAIL_DOMAINS[Math.floor(domainRoll * EMAIL_DOMAINS.length)] ?? EMAIL_DOMAINS[0]}`;
}

/**
 * The tier of the next order: premium on a small roll, then the early tier, then the rest. null when sold out.
 * `premiumFloor` is the count of premium tickets that this day must keep for later days.
 */
function chooseTier(
	tiers: TicketTier[],
	sold: Map<string, number>,
	roll: number,
	premiumFloor: number,
): TicketTier | null {
	const left = (tier: TicketTier) => tier.quota - (sold.get(tier.id) ?? 0);
	const premium = tiers.find((tier) => tier.role === "premium");
	// About 3 orders in 20 ask for the premium tier. The floor keeps some premium tickets for late buyers.
	if (premium && roll < 0.15 && left(premium) > premiumFloor) {
		return premium;
	}
	const early = tiers.find((tier) => tier.role === "early");
	if (early && left(early) > 0) {
		return early;
	}
	const general = tiers.find((tier) => tier.role === "general");
	if (general && left(general) > 0) {
		return general;
	}
	return tiers.find((tier) => left(tier) > 0) ?? null;
}

/**
 * Every order of one event that exists at `now`, oldest first.
 * The draws of each day do not depend on `now`, so a later call only adds orders at the end.
 */
export function buildOrders(event: EventRow, now: number): Order[] {
	const random = createSeededRandom(event.number * 7919);
	const nextName = createNamePicker(random);
	const windowStart = startOfLocalDay(event.onSaleAt);
	const dayCount = calendarDaysBetween(windowStart, event.startsAt) + 1;
	const weights = dayWeights(windowStart, dayCount);
	const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
	const expectedTickets = event.capacity * event.demand;
	// Sales stop at the start of the event, or at the cancellation.
	const salesEnd = event.cancelledAt ?? event.startsAt;
	const premiumQuota =
		event.tiers.find((tier) => tier.role === "premium")?.quota ?? 0;
	// Tickets per tier that are sold and not refunded at the time of the current draft.
	const sold = new Map<string, number>();
	// Planned refunds that still hold their tickets. A refund puts its tickets back on sale at its time.
	let heldRefunds: { at: number; tierId: string; quantity: number }[] = [];
	const orders: Order[] = [];
	let sequence = 0;
	let weightAfter = weightTotal;

	for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
		const dayStart = addDays(windowStart, dayIndex);
		if (dayStart > now || dayStart >= salesEnd) {
			break;
		}
		// The premium tier sells in step with the expected sales, so its last tickets go in the last days.
		weightAfter -= weights[dayIndex] ?? 0;
		const premiumFloor = Math.floor((premiumQuota * weightAfter) / weightTotal);
		const noise = 0.75 + random() * 0.5;
		const target = Math.round(
			((expectedTickets * (weights[dayIndex] ?? 0)) / weightTotal) * noise,
		);
		// Plan the whole day first, so the orders of today are the same at any hour.
		const drafts: Draft[] = [];
		let planned = 0;
		while (planned < target) {
			const hour = pickWeighted(random, HOUR_WEIGHTS);
			// The first day opens at 10:00, so its orders start then.
			const minute =
				(dayIndex === 0 ? Math.max(hour, 10) : hour) * 60 +
				randomInt(random, 0, 59);
			const quantity = pickWeighted(random, QUANTITY_WEIGHTS);
			drafts.push({
				minute,
				quantity,
				tierRoll: random(),
				refundRoll: random(),
				refundDays: randomInt(random, 1, 12),
				showRoll: random(),
				scanMinute: randomInt(random, 0, 100),
				domainRoll: random(),
			});
			planned += quantity;
		}
		drafts.sort((first, second) => first.minute - second.minute);

		for (const draft of drafts) {
			const placedAt = atMinute(dayStart, draft.minute);
			if (placedAt > now || placedAt >= salesEnd) {
				break;
			}
			for (const refund of heldRefunds) {
				if (refund.at <= placedAt) {
					sold.set(
						refund.tierId,
						(sold.get(refund.tierId) ?? 0) - refund.quantity,
					);
				}
			}
			heldRefunds = heldRefunds.filter((refund) => refund.at > placedAt);
			const tier = chooseTier(event.tiers, sold, draft.tierRoll, premiumFloor);
			// Sold out for now. A later refund can free tickets for a later draft.
			if (!tier) {
				continue;
			}
			const quantity = Math.min(
				draft.quantity,
				tier.quota - (sold.get(tier.id) ?? 0),
			);
			sold.set(tier.id, (sold.get(tier.id) ?? 0) + quantity);
			sequence += 1;
			const buyerName = nextName();
			// A cancelled event refunds every order within 36 hours of the cancellation.
			const refundTime =
				event.cancelledAt !== null
					? event.cancelledAt +
						Math.round(draft.refundRoll * 36 * 60) * MINUTE_MS
					: draft.refundRoll < REFUND_RATE
						? Math.min(
								addDays(placedAt, draft.refundDays),
								event.startsAt - 60 * MINUTE_MS,
							)
						: null;
			// A refund before the purchase is no refund: a late buyer keeps the ticket.
			const refundPlan =
				refundTime !== null && refundTime > placedAt ? refundTime : null;
			if (refundPlan !== null) {
				heldRefunds.push({ at: refundPlan, tierId: tier.id, quantity });
			}
			const refundedAt =
				refundPlan !== null && refundPlan <= now ? refundPlan : null;
			// The scan comes after the doors open and after the purchase, before the end.
			const scanPlan = Math.max(
				event.doorsAt + draft.scanMinute * MINUTE_MS,
				placedAt + 5 * MINUTE_MS,
			);
			const isScanned =
				refundPlan === null &&
				draft.showRoll < SHOW_RATE[event.kind] &&
				scanPlan <= now &&
				scanPlan < event.endsAt;
			orders.push({
				id: `${event.id}-o${String(sequence).padStart(4, "0")}`,
				reference: `SH${event.number}-${String(sequence).padStart(4, "0")}`,
				eventId: event.id,
				tierId: tier.id,
				tierName: tier.name,
				quantity,
				unitPrice: tier.price,
				amount: quantity * tier.price,
				buyerName,
				buyerEmail: emailOf(buyerName, draft.domainRoll),
				placedAt,
				refundedAt,
				checkedInAt: isScanned ? scanPlan : null,
			});
		}
	}
	return orders;
}
