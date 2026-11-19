// The math of the front desk home: the KPI tiles, the status donut, the occupancy week, the desk feed,
// the revenue bars, the channel split, and the rows of the arrivals and departures table.
// front-desk.queries.ts calls each build function with the sample rows and one `now`. The cards take the types.
// Every function is pure: the same rows and the same `now` give the same figures.
import {
	addDays,
	BOOKING_CHANNELS,
	type BookingChannel,
	DAY_MS,
	type FolioCharge,
	type Guest,
	isoDayToMs,
	type Reservation,
	type ReservationStatus,
	type Room,
	type RoomType,
	startOfLocalDay,
	toIsoDay,
} from "~/features/hotel";

/** The statuses of a stay that holds a room: it will happen, happens now, or happened. */
const KEPT_STATUSES: readonly ReservationStatus[] = [
	"pending",
	"confirmed",
	"checked_in",
	"checked_out",
];

/** The statuses of a stay whose guest came. Only these nights count as revenue. */
const ARRIVED_STATUSES: readonly ReservationStatus[] = [
	"checked_in",
	"checked_out",
];

/** The `YYYY-MM-DD` nights of a stay: the check-in day, then each day before the check-out day. */
function nightsOf(reservation: Reservation): string[] {
	const first = isoDayToMs(reservation.checkIn);
	return Array.from({ length: reservation.nights }, (_, index) =>
		toIsoDay(addDays(first, index)),
	);
}

/** True when the room cannot be sold on the night `day` (`YYYY-MM-DD`). */
function isClosedOn(room: Room, day: string): boolean {
	return (
		room.outOfOrder !== null &&
		toIsoDay(Date.parse(room.outOfOrder.since)) <= day &&
		day < room.outOfOrder.until
	);
}

/** Change against an earlier figure, as a ratio: 0.12 is +12 %. null when the earlier figure is 0, so no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** The four figures of the KPI tiles of the home. */
export type FrontDeskKpis = {
	/** Stays that start today: all of them, and the ones whose guest is in the house already. */
	arrivals: { total: number; done: number };
	/** Stays that end today: all of them, and the ones whose guest has left already. */
	departures: { total: number; done: number };
	/** Guests in the house now (adults and children), and the rooms they use out of the rooms that the desk can sell. */
	inHouse: { guests: number; rooms: number; sellableRooms: number };
	/** Room revenue of the nights of this month to tonight, and of the same count of nights of last month. Whole currency units. */
	revenue: { current: number; previous: number };
};

/** Room revenue of the arrived stays on the nights from `fromDay` to `toDay`, both included. */
function roomRevenueBetween(
	reservations: Reservation[],
	fromDay: string,
	toDay: string,
): number {
	return reservations
		.filter((reservation) => ARRIVED_STATUSES.includes(reservation.status))
		.reduce(
			(sum, reservation) =>
				sum +
				nightsOf(reservation).filter((day) => day >= fromDay && day <= toDay)
					.length *
					reservation.nightlyRate,
			0,
		);
}

/** The KPI figures at `now` (milliseconds since 1970). */
export function buildKpis(
	reservations: Reservation[],
	rooms: Room[],
	now: number,
): FrontDeskKpis {
	const today = toIsoDay(now);
	const arrivals = reservations.filter(
		(reservation) =>
			reservation.checkIn === today &&
			KEPT_STATUSES.includes(reservation.status),
	);
	const departures = reservations.filter(
		(reservation) =>
			reservation.checkOut === today &&
			ARRIVED_STATUSES.includes(reservation.status),
	);
	const inHouse = reservations.filter(
		(reservation) => reservation.status === "checked_in",
	);
	const date = new Date(now);
	const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
	// The same count of nights at the start of last month. A short month ends the range on its last day.
	const elapsedDays = date.getDate() - 1;
	const lastMonthStart = new Date(date.getFullYear(), date.getMonth() - 1, 1);
	const lastMonthEnd = Math.min(
		addDays(lastMonthStart.getTime(), elapsedDays),
		addDays(monthStart.getTime(), -1),
	);
	return {
		arrivals: {
			total: arrivals.length,
			done: arrivals.filter((reservation) => reservation.arrivedAt !== null)
				.length,
		},
		departures: {
			total: departures.length,
			done: departures.filter((reservation) => reservation.departedAt !== null)
				.length,
		},
		inHouse: {
			guests: inHouse.reduce(
				(sum, reservation) => sum + reservation.adults + reservation.children,
				0,
			),
			rooms: new Set(inHouse.map((reservation) => reservation.roomId)).size,
			sellableRooms: rooms.filter((room) => !isClosedOn(room, today)).length,
		},
		revenue: {
			current: roomRevenueBetween(
				reservations,
				toIsoDay(monthStart.getTime()),
				today,
			),
			previous: roomRevenueBetween(
				reservations,
				toIsoDay(lastMonthStart.getTime()),
				toIsoDay(lastMonthEnd),
			),
		},
	};
}

/** Local midnight of the Monday of the week of `now`, moved by `weekOffset` weeks. */
export function weekStart(now: number, weekOffset: number): number {
	const todayStart = startOfLocalDay(now);
	// getDay() is 0 on Sunday. The hotel week starts on Monday, as in ISO 8601.
	const sinceMonday = (new Date(todayStart).getDay() + 6) % 7;
	return addDays(todayStart, weekOffset * 7 - sinceMonday);
}

/** The slices of the reservations donut, in the order of a stay. Its label is the message key `frontDesk.mix.<key>`. */
export const MIX_KEYS = [
	"confirmed",
	"inHouse",
	"checkedOut",
	"cancelled",
] as const;

/** One slice key of the reservations donut. */
export type MixKey = (typeof MIX_KEYS)[number];

/** The reservations whose stay starts this week, per status, and the room revenue of the kept ones. */
export type ReservationMix = {
	/** `YYYY-MM-DD` of the Monday and of the Sunday of the week. */
	fromDay: string;
	toDay: string;
	/** One count per key of MIX_KEYS, also at 0. */
	slices: { key: MixKey; value: number }[];
	/** Nights times rate of the stays that were not cancelled, in whole currency units. */
	roomRevenue: number;
};

/** Which slice a status falls in. A booking that waits for its deposit is still a confirmed room. */
const MIX_OF_STATUS = {
	pending: "confirmed",
	confirmed: "confirmed",
	checked_in: "inHouse",
	checked_out: "checkedOut",
	cancelled: "cancelled",
	no_show: "cancelled",
} satisfies Record<ReservationStatus, MixKey>;

/** The donut figures of the week of `now`. */
export function buildReservationMix(
	reservations: Reservation[],
	now: number,
): ReservationMix {
	const fromDay = toIsoDay(weekStart(now, 0));
	const toDay = toIsoDay(addDays(weekStart(now, 0), 6));
	const ofWeek = reservations.filter(
		(reservation) =>
			reservation.checkIn >= fromDay && reservation.checkIn <= toDay,
	);
	return {
		fromDay,
		toDay,
		slices: MIX_KEYS.map((key) => ({
			key,
			value: ofWeek.filter(
				(reservation) => MIX_OF_STATUS[reservation.status] === key,
			).length,
		})),
		roomRevenue: ofWeek
			.filter((reservation) => KEPT_STATUSES.includes(reservation.status))
			.reduce(
				(sum, reservation) =>
					sum + reservation.nights * reservation.nightlyRate,
				0,
			),
	};
}

/** The week choices of the occupancy card: last week, this week, next week. */
export const OCCUPANCY_WEEKS = [-1, 0, 1] as const;

/** One week choice, as an offset in weeks from the week of today. */
export type OccupancyWeek = (typeof OCCUPANCY_WEEKS)[number];

/** One night of the occupancy chart. `booked` and `available` are counts of rooms. */
export type OccupancyPoint = { day: string; booked: number; available: number };

/** The occupancy of one week: the nights, the sums, and the rate of the week before. */
export type Occupancy = {
	points: OccupancyPoint[];
	/** Sold room nights of the week. */
	booked: number;
	/** Unsold room nights of the week. A closed room is not available. */
	available: number;
	/** Share of the sellable room nights that are sold, from 0 to 1. null when no room can be sold. */
	rate: number | null;
	/** The same share for the week before. */
	previousRate: number | null;
};

/** The 7 nights of a week from its Monday `start`, with the booked and the available rooms. */
function occupancyPoints(
	reservations: Reservation[],
	rooms: Room[],
	start: number,
): OccupancyPoint[] {
	const booked = new Map<string, number>();
	for (const reservation of reservations) {
		if (KEPT_STATUSES.includes(reservation.status)) {
			for (const day of nightsOf(reservation)) {
				booked.set(day, (booked.get(day) ?? 0) + 1);
			}
		}
	}
	return Array.from({ length: 7 }, (_, index) => {
		const day = toIsoDay(addDays(start, index));
		const sold = booked.get(day) ?? 0;
		const sellable = rooms.filter((room) => !isClosedOn(room, day)).length;
		return { day, booked: sold, available: Math.max(0, sellable - sold) };
	});
}

/** Sold room nights over sellable room nights. null when no room can be sold. */
function rateOf(points: OccupancyPoint[]): number | null {
	const booked = points.reduce((sum, point) => sum + point.booked, 0);
	const sellable = points.reduce(
		(sum, point) => sum + point.booked + point.available,
		0,
	);
	return sellable === 0 ? null : booked / sellable;
}

/** The occupancy of the week `week` around `now`. */
export function buildOccupancy(
	reservations: Reservation[],
	rooms: Room[],
	now: number,
	week: OccupancyWeek,
): Occupancy {
	const points = occupancyPoints(reservations, rooms, weekStart(now, week));
	const previous = occupancyPoints(
		reservations,
		rooms,
		weekStart(now, week - 1),
	);
	return {
		points,
		booked: points.reduce((sum, point) => sum + point.booked, 0),
		available: points.reduce((sum, point) => sum + point.available, 0),
		rate: rateOf(points),
		previousRate: rateOf(previous),
	};
}

/** One event of the front desk feed. Its line is the message key `frontDesk.activity.<kind>`. */
export type DeskEvent = {
	id: string;
	kind: "checkIn" | "checkOut" | "booking" | "cancellation";
	/** Id of the reservation. The row opens its detail page. */
	reservationId: string;
	guestName: string;
	/** The number on the door, for example "204". */
	roomNumber: string;
	/** ISO time of the event. */
	at: string;
};

/** The events of the desk until `now`, newest first. */
export function buildDeskEvents(
	reservations: Reservation[],
	guests: Guest[],
	rooms: Room[],
	now: number,
): DeskEvent[] {
	const guestNames = new Map(guests.map((guest) => [guest.id, guest.fullName]));
	const roomNumbers = new Map(rooms.map((room) => [room.id, room.number]));
	return reservations
		.flatMap((reservation) => {
			const base = {
				reservationId: reservation.id,
				guestName: guestNames.get(reservation.guestId) ?? reservation.code,
				roomNumber: roomNumbers.get(reservation.roomId) ?? "",
			};
			const times: [DeskEvent["kind"], string | null][] = [
				["booking", reservation.bookedAt],
				["checkIn", reservation.arrivedAt],
				["checkOut", reservation.departedAt],
				["cancellation", reservation.cancelledAt],
			];
			return times.flatMap(([kind, at]) =>
				at !== null && Date.parse(at) <= now
					? [{ ...base, id: `${reservation.id}-${kind}`, kind, at }]
					: [],
			);
		})
		.sort((first, second) => second.at.localeCompare(first.at));
}

/** The period choices of the revenue card. */
export const REVENUE_PERIODS = ["week", "month"] as const;

/** One revenue period: the last 7 days by day, or the last 4 weeks by week. */
export type RevenuePeriod = (typeof REVENUE_PERIODS)[number];

/** One bar of the revenue chart, in whole currency units. `fromDay` is the first day of the bar. */
export type RevenueBar = { fromDay: string; rooms: number; extras: number };

/** The revenue of one period: the bars, the sum, and the sum of the period before. */
export type Revenue = {
	bars: RevenueBar[];
	total: number;
	previousTotal: number;
};

/** Days per bar and bars per period. */
const REVENUE_SHAPE = {
	week: { barDays: 1, bars: 7 },
	month: { barDays: 7, bars: 4 },
} satisfies Record<RevenuePeriod, { barDays: number; bars: number }>;

/** The folio charges that count as revenue. City tax goes to the city, so it is left out. */
export type RevenueCharge = Pick<
	FolioCharge,
	"kind" | "postedOn" | "amount" | "quantity"
> & {
	/** The stay of the charge: its nights spread the room and breakfast lines over the days. */
	checkIn: string;
	nights: number;
};

/** Room and extras revenue per day, from the folio charges of the arrived stays. */
function revenueByDay(
	charges: RevenueCharge[],
): Map<string, { rooms: number; extras: number }> {
	const byDay = new Map<string, { rooms: number; extras: number }>();
	const add = (day: string, part: "rooms" | "extras", amount: number) => {
		const entry = byDay.get(day) ?? { rooms: 0, extras: 0 };
		entry[part] += amount;
		byDay.set(day, entry);
	};
	for (const charge of charges) {
		if (charge.kind === "city_tax") {
			continue;
		}
		if (charge.kind === "room" || charge.kind === "breakfast") {
			// The folio posts the whole stay on the check-in day. The chart spreads it over the nights.
			const first = isoDayToMs(charge.checkIn);
			for (let night = 0; night < charge.nights; night += 1) {
				add(
					toIsoDay(addDays(first, night)),
					charge.kind === "room" ? "rooms" : "extras",
					charge.amount / charge.nights,
				);
			}
			continue;
		}
		add(charge.postedOn, "extras", charge.amount);
	}
	return byDay;
}

/** The revenue bars of `period`, to today, and the sum of the period before. Future nights are not revenue yet. */
export function buildRevenue(
	charges: RevenueCharge[],
	now: number,
	period: RevenuePeriod,
): Revenue {
	const { barDays, bars } = REVENUE_SHAPE[period];
	const byDay = revenueByDay(charges);
	const todayStart = startOfLocalDay(now);
	const periodDays = barDays * bars;
	const sumDays = (start: number, days: number) => {
		const sum = { rooms: 0, extras: 0 };
		for (let index = 0; index < days; index += 1) {
			const entry = byDay.get(toIsoDay(addDays(start, index)));
			sum.rooms += entry?.rooms ?? 0;
			sum.extras += entry?.extras ?? 0;
		}
		return sum;
	};
	const firstDay = addDays(todayStart, 1 - periodDays);
	const result = Array.from({ length: bars }, (_, index) => {
		const start = addDays(firstDay, index * barDays);
		const sum = sumDays(start, barDays);
		return {
			fromDay: toIsoDay(start),
			rooms: Math.round(sum.rooms),
			extras: Math.round(sum.extras),
		};
	});
	const previous = sumDays(addDays(firstDay, -periodDays), periodDays);
	return {
		bars: result,
		total: result.reduce((sum, bar) => sum + bar.rooms + bar.extras, 0),
		previousTotal: Math.round(previous.rooms + previous.extras),
	};
}

/** The tabs of the channel card: bookings received today, in the last 7 days, and in the last 30 days. */
export const CHANNEL_PERIODS = ["day", "week", "month"] as const;

/** One tab of the channel card. */
export type ChannelPeriod = (typeof CHANNEL_PERIODS)[number];

/** Days per tab. "day" is the last 24 hours. */
const CHANNEL_PERIOD_DAYS = {
	day: 1,
	week: 7,
	month: 30,
} satisfies Record<ChannelPeriod, number>;

/** The bookings received in one period, per channel, also at 0. */
export type ChannelSplit = { channel: BookingChannel; value: number }[];

/** The channel split of each tab at `now`. A cancelled booking counts too: the desk received it. */
export function buildChannelSplits(
	reservations: Reservation[],
	now: number,
): Record<ChannelPeriod, ChannelSplit> {
	const splitOf = (days: number): ChannelSplit => {
		const since = now - days * DAY_MS;
		const received = reservations.filter((reservation) => {
			const at = Date.parse(reservation.bookedAt);
			return at > since && at <= now;
		});
		return BOOKING_CHANNELS.map((channel) => ({
			channel,
			value: received.filter((reservation) => reservation.channel === channel)
				.length,
		}));
	};
	return {
		day: splitOf(CHANNEL_PERIOD_DAYS.day),
		week: splitOf(CHANNEL_PERIOD_DAYS.week),
		month: splitOf(CHANNEL_PERIOD_DAYS.month),
	};
}

/** One row of the arrivals and departures table. */
export type MovementRow = {
	/** Key of the row and its selection: the reservation id plus the movement. One stay can give two rows. */
	id: string;
	/** Id of the reservation. The detail link uses it. */
	reservationId: string;
	code: string;
	guestName: string;
	roomNumber: string;
	roomType: RoomType;
	/** "arrival" when the stay starts today or tomorrow. "departure" when it ends tomorrow, or today after the guest came. */
	movement: "arrival" | "departure";
	/** "today" or "tomorrow": the day of the movement. */
	day: "today" | "tomorrow";
	/** ISO time of the check-in or check-out, done or expected. The table sorts by it. */
	at: string;
	checkIn: string;
	checkOut: string;
	nights: number;
	status: ReservationStatus;
};

/**
 * The arrivals and departures of today and tomorrow: today first, the arrivals of each day first, then time order.
 * The desk prepares the arrivals first. A cancelled stay moves nobody.
 */
export function buildMovements(
	reservations: Reservation[],
	guests: Guest[],
	rooms: Room[],
	now: number,
): MovementRow[] {
	const today = toIsoDay(now);
	const tomorrow = toIsoDay(addDays(startOfLocalDay(now), 1));
	const guestNames = new Map(guests.map((guest) => [guest.id, guest.fullName]));
	return reservations
		.filter((reservation) => KEPT_STATUSES.includes(reservation.status))
		.flatMap((reservation): MovementRow[] => {
			const room = rooms.find(
				(candidate) => candidate.id === reservation.roomId,
			);
			const base = {
				reservationId: reservation.id,
				code: reservation.code,
				guestName: guestNames.get(reservation.guestId) ?? "",
				roomNumber: room?.number ?? "",
				roomType: room?.type ?? "classic",
				checkIn: reservation.checkIn,
				checkOut: reservation.checkOut,
				nights: reservation.nights,
				status: reservation.status,
			};
			// Two separate checks: a one-night stay that arrives today and leaves tomorrow gives both rows.
			const rows: MovementRow[] = [];
			if (reservation.checkIn === today || reservation.checkIn === tomorrow) {
				rows.push({
					...base,
					id: `${reservation.id}:arrival`,
					movement: "arrival",
					day: reservation.checkIn === today ? "today" : "tomorrow",
					at: reservation.arrivedAt ?? reservation.expectedArrivalAt,
				});
			}
			// A stay that ends today with no arrival is a no-show: nobody leaves. The "Departures today" tile skips it too.
			const isDepartureToday =
				reservation.checkOut === today &&
				ARRIVED_STATUSES.includes(reservation.status);
			if (isDepartureToday || reservation.checkOut === tomorrow) {
				rows.push({
					...base,
					id: `${reservation.id}:departure`,
					movement: "departure",
					day: reservation.checkOut === today ? "today" : "tomorrow",
					at: reservation.departedAt ?? reservation.expectedDepartureAt,
				});
			}
			return rows;
		})
		.sort(
			(first, second) =>
				Number(second.day === "today") - Number(first.day === "today") ||
				Number(second.movement === "arrival") -
					Number(first.movement === "arrival") ||
				first.at.localeCompare(second.at),
		);
}
