// The sample reservations of the hotel, with their folio charges and payments.
// It stands in for the tables `reservations`, `folio_charges`, and `payments`.
// A seeded walk fills each room from 62 days ago to 21 days ahead, as day offsets from today.
// The `*.queries.ts` files of the pages read the list functions. sample-housekeeping.ts reads STAY_PLANS.
import { addDays, MINUTE_MS, startOfLocalDay, toIsoDay } from "./hotel-day";
import { GUEST_SEEDS } from "./sample-guests";
import { ROOM_SEEDS, type RoomSeed } from "./sample-rooms";
import {
	createSeededRandom,
	pickOne,
	pickWeighted,
	randomInt,
} from "./seeded-random";

/** Every status, in the order of a stay. Its label is the message key `reservationStatuses.<status>`. */
export const RESERVATION_STATUSES = [
	"pending",
	"confirmed",
	"checked_in",
	"checked_out",
	"cancelled",
	"no_show",
] as const;

/** One status. `pending` waits for its deposit. `no_show` never arrived. */
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Where a booking comes from. Its label is the message key `channels.<channel>`. */
export const BOOKING_CHANNELS = [
	"direct",
	"agency",
	"phone",
	"corporate",
] as const;

/** One booking channel. `agency` is an online travel agency: it pays the stay in advance. */
export type BookingChannel = (typeof BOOKING_CHANNELS)[number];

/** The extras that a guest can add to a folio. Its label is the message key `folio.kinds.<kind>`. */
const EXTRA_KINDS = [
	"minibar",
	"restaurant",
	"spa",
	"parking",
	"laundry",
] as const;

/** The kind of one folio line: a stay charge or an extra. */
type FolioChargeKind =
	| "room"
	| "breakfast"
	| "city_tax"
	| (typeof EXTRA_KINDS)[number];

/** Breakfast for one guest and one morning, in whole units of HOTEL_CURRENCY. */
const BREAKFAST_PRICE = 18;
/** City tax for one adult and one night, in whole units of HOTEL_CURRENCY. */
const CITY_TAX = 3;

/** The sample book starts this many days before today: enough for this month and the same days of last month. */
export const BOOK_PAST_DAYS = 62;
/** The sample book ends this many days after today. */
export const BOOK_FUTURE_DAYS = 21;

// A fixed seed: the same book on every load.
const BOOK_SEED = 20_336;
// Rooms sell out for the next 4 days. Then the share of sold rooms falls to 0 over 26 days, as in a real booking curve.
const PICKUP_FULL_DAYS = 4;
const PICKUP_FADE_DAYS = 26;

// [nights, weight]: most stays are 2 or 3 nights.
const STAY_LENGTHS = [
	[1, 16],
	[2, 30],
	[3, 26],
	[4, 14],
	[5, 8],
	[7, 3],
] as const;
// [empty nights after a stay, weight]: about half of the stays are followed by an arrival on the same day.
const GAP_LENGTHS = [
	[0, 50],
	[1, 30],
	[2, 14],
	[3, 6],
] as const;
const CHANNEL_WEIGHTS = [
	["direct", 38],
	["agency", 34],
	["phone", 14],
	["corporate", 14],
] as const;
const RATE_STEPS = [-15, 0, 0, 0, 10, 20] as const;
const REQUESTS = [
	"Anniversary stay. A handwritten card in the room.",
	"Arrives by train. Asks for a taxi at the station.",
	"Baby cot in the room.",
	"High floor, if one is free.",
	"Allergic to nuts. Tell the kitchen.",
	"The luggage arrives before the guest. Keep it at the desk.",
	"Two extra pillows.",
	"Wants the invoice in the company name.",
	"Bicycle storage for two bikes.",
	"Table for two at the restaurant on the first evening.",
] as const;
// [amount, weight] per extra, in whole units of HOTEL_CURRENCY.
const EXTRA_AMOUNTS = {
	minibar: [12, 18, 24, 31],
	restaurant: [46, 68, 84, 112],
	spa: [55, 75, 95],
	parking: [22],
	laundry: [16, 28],
} as const satisfies Record<
	(typeof EXTRA_KINDS)[number],
	readonly [number, ...number[]]
>;

/** One extra of a stay, before its date is made. */
type ExtraPlan = {
	/** Night of the stay: 0 is the first day. */
	dayIndex: number;
	/** Minutes after midnight when the desk posts the charge. */
	minute: number;
	kind: (typeof EXTRA_KINDS)[number];
	amount: number;
};

/** One reservation as day offsets from today. The list functions turn it into rows with dates and a status. */
export type StayPlan = {
	/** Also the last part of the detail URL, for example "inn-4127". */
	id: string;
	/** The code that the guest gets, for example "INN-4127". */
	code: string;
	guestId: string;
	roomId: string;
	/** Day of arrival: 0 is today, -3 is three days ago. */
	checkInOffset: number;
	nights: number;
	adults: number;
	children: number;
	channel: BookingChannel;
	/** Price of one night of this stay, in whole units of HOTEL_CURRENCY. */
	nightlyRate: number;
	breakfastIncluded: boolean;
	/** Days from the booking to the arrival. */
	leadDays: number;
	/** Minutes after midnight when the booking came in. */
	bookedMinute: number;
	/** Minutes after midnight when the guest arrives on the first day. */
	arrivalMinute: number;
	/** Minutes after midnight when the guest leaves on the last day. */
	departureMinute: number;
	/** `stay` is a reservation that happens. The two others keep no room. */
	outcome: "stay" | "cancelled" | "no_show";
	/** Where the cancellation sits between the booking and the arrival, from 0 to 1. */
	cancelShare: number;
	/** True for a new booking that still waits for its deposit. */
	isAwaitingDeposit: boolean;
	request: string | null;
	extras: ExtraPlan[];
};

/** One reservation as the pages read it. */
export type Reservation = {
	id: string;
	code: string;
	guestId: string;
	roomId: string;
	/** Day of arrival, `YYYY-MM-DD`. */
	checkIn: string;
	/** Day of departure, `YYYY-MM-DD`. */
	checkOut: string;
	nights: number;
	adults: number;
	children: number;
	channel: BookingChannel;
	nightlyRate: number;
	breakfastIncluded: boolean;
	status: ReservationStatus;
	/** ISO time of the booking. */
	bookedAt: string;
	/** ISO time when the guest plans to arrive. */
	expectedArrivalAt: string;
	/** ISO time when the guest plans to leave. */
	expectedDepartureAt: string;
	/** ISO time of the check-in, or null before it. */
	arrivedAt: string | null;
	/** ISO time of the check-out, or null before it. */
	departedAt: string | null;
	/** ISO time of the cancellation, or null. */
	cancelledAt: string | null;
	/** Sum of the folio charges until now, in whole units of HOTEL_CURRENCY. A cancelled stay keeps its booked value. */
	total: number;
	/** Sum of the payments until now. */
	paid: number;
	request: string | null;
};

/** One line of a folio. */
export type FolioCharge = {
	id: string;
	kind: FolioChargeKind;
	/** Day when the desk posted the line, `YYYY-MM-DD`. */
	postedOn: string;
	quantity: number;
	unitPrice: number;
	amount: number;
};

/** One payment of a reservation. A refund has a negative amount. */
export type Payment = {
	id: string;
	kind: "deposit" | "prepayment" | "settlement" | "refund";
	method: "card" | "transfer" | "cash";
	/** ISO time of the payment. */
	paidAt: string;
	amount: number;
};

/** What the book already holds for one guest: the nights and the rooms of the reservations. */
type GuestUse = { nights: Set<number>; roomIds: Set<string> };

// A guest has at most 4 reservations in the 12 weeks of the book. More would read as a copy error.
const MAX_BOOKINGS_PER_GUEST = 4;

/**
 * Picks a guest for a reservation. `guestUses` holds the use of each guest id.
 * It draws one guest, then takes the next guest of the list who is free on these nights,
 * who did not have this room before, and who has fewer than 2 reservations.
 */
function pickGuestId(
	random: () => number,
	roomId: string,
	checkInOffset: number,
	nights: number,
	guestUses: Map<string, GuestUse>,
): string {
	const first = Math.floor(random() * GUEST_SEEDS.length);
	const stayNights = Array.from(
		{ length: nights },
		(_, night) => checkInOffset + night,
	);
	for (let step = 0; step < GUEST_SEEDS.length; step += 1) {
		const guestId = GUEST_SEEDS[(first + step) % GUEST_SEEDS.length]?.id ?? "";
		const use = guestUses.get(guestId) ?? {
			nights: new Set<number>(),
			roomIds: new Set<string>(),
		};
		if (
			use.roomIds.size < MAX_BOOKINGS_PER_GUEST &&
			!use.roomIds.has(roomId) &&
			stayNights.every((night) => !use.nights.has(night))
		) {
			for (const night of stayNights) {
				use.nights.add(night);
			}
			use.roomIds.add(roomId);
			guestUses.set(guestId, use);
			return guestId;
		}
	}
	// 150 guests with 4 reservations each are more than the book holds, so the loop always returns.
	return GUEST_SEEDS[first]?.id ?? "";
}

/** The count of adults and children for a room. A larger room gets a larger party more often. */
function pickParty(
	random: () => number,
	room: RoomSeed,
): { adults: number; children: number } {
	const adults =
		room.capacity >= 4
			? pickWeighted(random, [
					[2, 55],
					[3, 20],
					[4, 25],
				])
			: pickWeighted(random, [
					[1, room.type === "classic" ? 40 : 20],
					[2, 60],
				]);
	const freeBeds = room.capacity - adults;
	return {
		adults,
		children: freeBeds > 0 && random() < 0.3 ? 1 : 0,
	};
}

/** Builds one plan with no id and no code. `finishPlans` gives both when every room has its plans. */
function planStay(
	random: () => number,
	room: RoomSeed,
	checkInOffset: number,
	nights: number,
	outcome: StayPlan["outcome"],
	guestUses: Map<string, GuestUse>,
): StayPlan {
	const party = pickParty(random, room);
	const channel = pickWeighted(random, CHANNEL_WEIGHTS);
	// A new booking came in 1 or 2 days ago, for a stay that is at least 4 days away.
	const isNew = outcome === "stay" && checkInOffset >= 4 && random() < 0.22;
	// A new booking waits for its deposit. An online agency pays in advance, so its bookings never wait.
	const isAwaitingDeposit = isNew && channel !== "agency";
	const usualLead =
		random() < 0.4 ? randomInt(random, 1, 9) : randomInt(random, 10, 60);
	// A booking is never in the future: the lead is longer than the days until the arrival.
	const leadDays = isNew
		? checkInOffset + randomInt(random, 1, 2)
		: Math.max(usualLead, checkInOffset + randomInt(random, 1, 7));
	const extraCount = outcome === "stay" ? randomInt(random, 0, 3) : 0;
	return {
		id: "",
		code: "",
		guestId: pickGuestId(random, room.id, checkInOffset, nights, guestUses),
		roomId: room.id,
		checkInOffset,
		nights,
		adults: party.adults,
		children: party.children,
		channel,
		// A company rate is 10 lower than the public rate.
		nightlyRate:
			room.nightlyRate +
			pickOne(random, RATE_STEPS) -
			(channel === "corporate" ? 10 : 0),
		breakfastIncluded: random() < 0.55,
		leadDays,
		// Bookings come in from 08:00 to 22:00.
		bookedMinute: randomInt(random, 480, 1320),
		// 15-minute steps. 70% arrive from 15:00 to 18:45, the others until 22:30.
		arrivalMinute:
			random() < 0.7
				? 900 + 15 * randomInt(random, 0, 15)
				: 1140 + 15 * randomInt(random, 0, 14),
		// 85% leave from 07:30 to 11:00. The others have a late check-out, from 12:00 to 12:45.
		departureMinute:
			random() < 0.85
				? 450 + 15 * randomInt(random, 0, 14)
				: 720 + 15 * randomInt(random, 0, 3),
		outcome,
		cancelShare: 0.2 + random() * 0.7,
		isAwaitingDeposit,
		request: random() < 0.3 ? pickOne(random, REQUESTS) : null,
		extras: Array.from({ length: extraCount }, () => {
			const kind = pickOne(random, EXTRA_KINDS);
			return {
				dayIndex: randomInt(random, 0, nights - 1),
				// The desk posts extras from 10:00 to 22:00.
				minute: randomInt(random, 600, 1320),
				kind,
				amount: pickOne(random, EXTRA_AMOUNTS[kind]),
			};
		}),
	};
}

/** Walks one room from the start of the book to its end: a stay, then some empty nights, then the next stay. */
function planRoom(
	room: RoomSeed,
	roomIndex: number,
	guestUses: Map<string, GuestUse>,
): StayPlan[] {
	// 7919 is a prime number, so each room gets its own list of random numbers.
	const random = createSeededRandom(BOOK_SEED + roomIndex * 7919);
	const plans: StayPlan[] = [];
	// The first stay starts before the book, so its first day already has guests in the house.
	let day = -BOOK_PAST_DAYS - randomInt(random, 0, 4);
	while (day < BOOK_FUTURE_DAYS) {
		let nights: number = pickWeighted(random, STAY_LENGTHS);
		const gap = pickWeighted(random, GAP_LENGTHS);
		const closed = room.outOfOrder;
		// A room that is out of order takes no stay. A stay before it ends on its first closed day.
		if (
			closed &&
			day < closed.untilOffset &&
			day + nights > closed.fromOffset
		) {
			if (day >= closed.fromOffset) {
				day = closed.untilOffset;
				continue;
			}
			nights = closed.fromOffset - day;
		}
		const isSold =
			day <= PICKUP_FULL_DAYS ||
			random() < 1 - (day - PICKUP_FULL_DAYS) / PICKUP_FADE_DAYS;
		if (isSold) {
			plans.push(planStay(random, room, day, nights, "stay", guestUses));
		}
		// Some empty nights were a booking once: a cancellation, or a guest who did not come.
		if (gap > 0 && random() < 0.22) {
			const lostStart = day + nights;
			plans.push(
				planStay(
					random,
					room,
					lostStart,
					Math.min(gap, 2),
					lostStart < 0 && random() < 0.4 ? "no_show" : "cancelled",
					guestUses,
				),
			);
		}
		day += nights + gap;
	}
	return plans;
}

/** Gives each plan its code and its id. An older booking gets a lower number. */
function finishPlans(plans: StayPlan[]): StayPlan[] {
	const random = createSeededRandom(BOOK_SEED + 1);
	// 4,000 comes before the first code of the sample book.
	let number = 4000;
	return [...plans]
		.sort(
			(first, second) =>
				first.checkInOffset -
					first.leadDays -
					(second.checkInOffset - second.leadDays) ||
				first.bookedMinute - second.bookedMinute,
		)
		.map((plan) => {
			number += randomInt(random, 1, 4);
			return { ...plan, id: `inn-${number}`, code: `INN-${number}` };
		});
}

/** Every reservation of the sample book as day offsets, oldest booking first. About 400 rows. */
export const STAY_PLANS: StayPlan[] = (() => {
	const guestUses = new Map<string, GuestUse>();
	return finishPlans(
		ROOM_SEEDS.flatMap((room, roomIndex) =>
			planRoom(room, roomIndex, guestUses),
		),
	);
})();

/** The charges that a stay has from its booking: the nights, the breakfasts, and the city tax. */
function stayCharges(plan: StayPlan): Omit<FolioCharge, "id" | "postedOn">[] {
	const guests = plan.adults + plan.children;
	const charges: Omit<FolioCharge, "id" | "postedOn">[] = [
		{
			kind: "room",
			quantity: plan.nights,
			unitPrice: plan.nightlyRate,
			amount: plan.nights * plan.nightlyRate,
		},
	];
	if (plan.breakfastIncluded) {
		charges.push({
			kind: "breakfast",
			quantity: guests * plan.nights,
			unitPrice: BREAKFAST_PRICE,
			amount: guests * plan.nights * BREAKFAST_PRICE,
		});
	}
	charges.push({
		kind: "city_tax",
		quantity: plan.adults * plan.nights,
		unitPrice: CITY_TAX,
		amount: plan.adults * plan.nights * CITY_TAX,
	});
	return charges;
}

/** The dates of one plan for the day that starts at `todayStart`, in milliseconds since 1970. */
function planTimes(plan: StayPlan, todayStart: number) {
	const checkInStart = addDays(todayStart, plan.checkInOffset);
	const checkOutStart = addDays(todayStart, plan.checkInOffset + plan.nights);
	return {
		checkInStart,
		checkOutStart,
		bookedAt:
			addDays(checkInStart, -plan.leadDays) + plan.bookedMinute * MINUTE_MS,
		arrivalAt: checkInStart + plan.arrivalMinute * MINUTE_MS,
		departureAt: checkOutStart + plan.departureMinute * MINUTE_MS,
	};
}

/** The status of one plan at `now`. A stay moves from confirmed to checked in to checked out with the clock. */
function statusAt(
	plan: StayPlan,
	times: ReturnType<typeof planTimes>,
	now: number,
): ReservationStatus {
	if (plan.outcome !== "stay") {
		return plan.outcome;
	}
	if (now >= times.departureAt) {
		return "checked_out";
	}
	if (now >= times.arrivalAt) {
		return "checked_in";
	}
	return plan.isAwaitingDeposit ? "pending" : "confirmed";
}

/** The extras that the desk posted until `now`, with their dates. */
function postedExtras(
	plan: StayPlan,
	times: ReturnType<typeof planTimes>,
	now: number,
): { extra: ExtraPlan; postedAt: number }[] {
	return plan.extras
		.map((extra) => ({
			extra,
			postedAt: Math.max(
				addDays(times.checkInStart, extra.dayIndex) + extra.minute * MINUTE_MS,
				// An extra of the first day comes 45 minutes after the arrival, or later.
				times.arrivalAt + 45 * MINUTE_MS,
			),
		}))
		.filter(({ postedAt }) => postedAt <= now)
		.sort((first, second) => first.postedAt - second.postedAt);
}

/** The payments of one plan until `now`, oldest first. */
function paymentsAt(
	plan: StayPlan,
	times: ReturnType<typeof planTimes>,
	status: ReservationStatus,
	total: number,
	now: number,
): Payment[] {
	if (status === "pending") {
		return [];
	}
	const payments: Payment[] = [];
	const stayTotal = stayCharges(plan).reduce(
		(sum, charge) => sum + charge.amount,
		0,
	);
	// An online agency pays a stay in advance. Every other booking pays the first night as a deposit.
	const isPrepaid = plan.channel === "agency" && plan.outcome === "stay";
	const advance = isPrepaid ? stayTotal : plan.nightlyRate;
	payments.push({
		id: `${plan.id}-advance`,
		kind: isPrepaid ? "prepayment" : "deposit",
		method: isPrepaid ? "transfer" : "card",
		// The payment follows the booking by 12 minutes.
		paidAt: new Date(times.bookedAt + 12 * MINUTE_MS).toISOString(),
		amount: advance,
	});
	if (status === "cancelled") {
		const cancelledAt = cancellationTime(plan, times, now);
		payments.push({
			id: `${plan.id}-refund`,
			kind: "refund",
			method: isPrepaid ? "transfer" : "card",
			// The refund follows the cancellation by one hour.
			paidAt: new Date(cancelledAt + 60 * MINUTE_MS).toISOString(),
			amount: -advance,
		});
	}
	if (status === "checked_out" && total > advance) {
		payments.push({
			id: `${plan.id}-settlement`,
			kind: "settlement",
			// The id ends in a digit. A digit of 0, 3, 6, or 9 pays in cash, so the method is the same on every load.
			method: Number(plan.id.slice(-1)) % 3 === 0 ? "cash" : "card",
			// The guest pays 6 minutes before the check-out.
			paidAt: new Date(times.departureAt - 6 * MINUTE_MS).toISOString(),
			amount: total - advance,
		});
	}
	return payments;
}

/** The time of a cancellation: between the booking and the arrival, and never after `now`. */
function cancellationTime(
	plan: StayPlan,
	times: ReturnType<typeof planTimes>,
	now: number,
): number {
	const latest = Math.min(times.arrivalAt, now);
	return times.bookedAt + plan.cancelShare * (latest - times.bookedAt);
}

/** One plan as a row at `now`. */
function toReservation(plan: StayPlan, now: number): Reservation {
	const times = planTimes(plan, startOfLocalDay(now));
	const status = statusAt(plan, times, now);
	const stayTotal = stayCharges(plan).reduce(
		(sum, charge) => sum + charge.amount,
		0,
	);
	const extrasTotal = postedExtras(plan, times, now).reduce(
		(sum, { extra }) => sum + extra.amount,
		0,
	);
	// A guest who did not come pays the first night: the deposit stays with the hotel.
	const total =
		status === "no_show" ? plan.nightlyRate : stayTotal + extrasTotal;
	const paid = paymentsAt(plan, times, status, total, now).reduce(
		(sum, payment) => sum + payment.amount,
		0,
	);
	const hasArrived = status === "checked_in" || status === "checked_out";
	return {
		id: plan.id,
		code: plan.code,
		guestId: plan.guestId,
		roomId: plan.roomId,
		checkIn: toIsoDay(times.checkInStart),
		checkOut: toIsoDay(times.checkOutStart),
		nights: plan.nights,
		adults: plan.adults,
		children: plan.children,
		channel: plan.channel,
		nightlyRate: plan.nightlyRate,
		breakfastIncluded: plan.breakfastIncluded,
		status,
		bookedAt: new Date(times.bookedAt).toISOString(),
		expectedArrivalAt: new Date(times.arrivalAt).toISOString(),
		expectedDepartureAt: new Date(times.departureAt).toISOString(),
		arrivedAt: hasArrived ? new Date(times.arrivalAt).toISOString() : null,
		departedAt:
			status === "checked_out"
				? new Date(times.departureAt).toISOString()
				: null,
		cancelledAt:
			status === "cancelled"
				? new Date(cancellationTime(plan, times, now)).toISOString()
				: null,
		total,
		paid,
		request: plan.request,
	};
}

/** Every reservation at `now` (milliseconds since 1970), oldest booking first. */
export function listReservations(now: number): Reservation[] {
	return STAY_PLANS.map((plan) => toReservation(plan, now));
}

/** The folio lines of one reservation at `now`: the stay charges, then the extras by date. An unknown id gives no line. */
export function listFolioCharges(
	reservationId: string,
	now: number,
): FolioCharge[] {
	const plan = STAY_PLANS.find((candidate) => candidate.id === reservationId);
	if (!plan || plan.outcome === "cancelled") {
		return [];
	}
	const times = planTimes(plan, startOfLocalDay(now));
	// A guest who did not come pays the first night only.
	if (plan.outcome === "no_show") {
		return [
			{
				id: `${plan.id}-room`,
				kind: "room",
				postedOn: toIsoDay(times.checkInStart),
				quantity: 1,
				unitPrice: plan.nightlyRate,
				amount: plan.nightlyRate,
			},
		];
	}
	return [
		...stayCharges(plan).map((charge) => ({
			...charge,
			id: `${plan.id}-${charge.kind}`,
			postedOn: toIsoDay(times.checkInStart),
		})),
		...postedExtras(plan, times, now).map(({ extra, postedAt }, index) => ({
			id: `${plan.id}-extra-${index}`,
			kind: extra.kind,
			postedOn: toIsoDay(postedAt),
			quantity: 1,
			unitPrice: extra.amount,
			amount: extra.amount,
		})),
	];
}

/** The payments of one reservation at `now`, oldest first. An unknown id gives no payment. */
export function listPayments(reservationId: string, now: number): Payment[] {
	const plan = STAY_PLANS.find((candidate) => candidate.id === reservationId);
	if (!plan) {
		return [];
	}
	const reservation = toReservation(plan, now);
	return paymentsAt(
		plan,
		planTimes(plan, startOfLocalDay(now)),
		reservation.status,
		reservation.total,
		now,
	);
}
