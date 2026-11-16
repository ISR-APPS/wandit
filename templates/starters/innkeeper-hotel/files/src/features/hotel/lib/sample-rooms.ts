// The sample rooms of the hotel: 18 rooms on 3 floors. It stands in for a `rooms` table.
// sample-reservations.ts and sample-housekeeping.ts read ROOM_SEEDS. The pages read `listRooms`.
// To make it real: create the table, then read it in the queryFn of each `*.queries.ts` file.
import { addDays, MINUTE_MS, startOfLocalDay, toIsoDay } from "./hotel-day";

/** The currency of every amount in the sample data, as an ISO 4217 code. A real app reads it from its settings. */
export const HOTEL_CURRENCY = "EUR";

/** Every room type, from the smallest to the largest. Its label is the message key `roomTypes.<type>`. */
const ROOM_TYPES = ["classic", "deluxe", "junior_suite", "suite"] as const;

/** One room type. */
export type RoomType = (typeof ROOM_TYPES)[number];

/** The bed of a room. Its label is the message key `beds.<bed>`. */
type RoomBed = "queen" | "king" | "twin";

/** What the windows of a room show. Its label is the message key `views.<view>`. */
type RoomView = "garden" | "courtyard" | "rooftops";

/** A time when a room cannot be sold, as day offsets from today. */
type OutOfOrderSeed = {
	/** First day out of order: 0 is today, -2 is two days ago. */
	fromOffset: number;
	/** Minutes after midnight of the first day when the desk closed the room. */
	fromMinute: number;
	/** First day back in service. The room can take an arrival on this day. */
	untilOffset: number;
	/** What is wrong, as the desk wrote it. */
	reason: string;
};

/** One room before its dates are made: the fixed facts and the out-of-order time as day offsets. */
export type RoomSeed = {
	id: string;
	/** The number on the door. The first digit is the floor. */
	number: string;
	floor: 1 | 2 | 3;
	type: RoomType;
	bed: RoomBed;
	view: RoomView;
	/** The largest count of guests that the room sleeps. */
	capacity: number;
	/** Public price of one night, in whole units of HOTEL_CURRENCY. */
	nightlyRate: number;
	outOfOrder: OutOfOrderSeed | null;
};

/** One room as the pages read it. */
export type Room = Omit<RoomSeed, "outOfOrder"> & {
	/** Set while the room cannot be sold. `since` is an ISO time. `until` is the first day back in service, `YYYY-MM-DD`. */
	outOfOrder: { since: string; until: string; reason: string } | null;
};

/** The 18 rooms, by door number. Each floor has 6 rooms. Two rooms are out of order around today. */
export const ROOM_SEEDS: RoomSeed[] = [
	{
		id: "room-101",
		number: "101",
		floor: 1,
		type: "classic",
		bed: "queen",
		view: "garden",
		capacity: 2,
		nightlyRate: 145,
		outOfOrder: null,
	},
	{
		id: "room-102",
		number: "102",
		floor: 1,
		type: "classic",
		bed: "twin",
		view: "garden",
		capacity: 2,
		nightlyRate: 145,
		outOfOrder: null,
	},
	{
		id: "room-103",
		number: "103",
		floor: 1,
		type: "classic",
		bed: "queen",
		view: "courtyard",
		capacity: 2,
		nightlyRate: 140,
		outOfOrder: null,
	},
	{
		id: "room-104",
		number: "104",
		floor: 1,
		type: "deluxe",
		bed: "king",
		view: "garden",
		capacity: 2,
		nightlyRate: 185,
		outOfOrder: null,
	},
	{
		id: "room-105",
		number: "105",
		floor: 1,
		type: "deluxe",
		bed: "king",
		view: "courtyard",
		capacity: 3,
		nightlyRate: 180,
		outOfOrder: null,
	},
	{
		id: "room-106",
		number: "106",
		floor: 1,
		type: "junior_suite",
		bed: "king",
		view: "garden",
		capacity: 3,
		nightlyRate: 240,
		// 17:20 yesterday. The room is back tomorrow.
		outOfOrder: {
			fromOffset: -1,
			fromMinute: 1040,
			untilOffset: 1,
			reason: "Broken window lock. Repair today.",
		},
	},
	{
		id: "room-201",
		number: "201",
		floor: 2,
		type: "classic",
		bed: "queen",
		view: "courtyard",
		capacity: 2,
		nightlyRate: 150,
		outOfOrder: null,
	},
	{
		id: "room-202",
		number: "202",
		floor: 2,
		type: "classic",
		bed: "twin",
		view: "courtyard",
		capacity: 2,
		nightlyRate: 150,
		outOfOrder: null,
	},
	{
		id: "room-203",
		number: "203",
		floor: 2,
		type: "deluxe",
		bed: "king",
		view: "garden",
		capacity: 2,
		nightlyRate: 190,
		outOfOrder: null,
	},
	{
		id: "room-204",
		number: "204",
		floor: 2,
		type: "deluxe",
		bed: "king",
		view: "garden",
		capacity: 3,
		nightlyRate: 195,
		outOfOrder: null,
	},
	{
		id: "room-205",
		number: "205",
		floor: 2,
		type: "junior_suite",
		bed: "king",
		view: "courtyard",
		capacity: 3,
		nightlyRate: 245,
		outOfOrder: null,
	},
	{
		id: "room-206",
		number: "206",
		floor: 2,
		type: "junior_suite",
		bed: "king",
		view: "garden",
		capacity: 3,
		nightlyRate: 250,
		outOfOrder: null,
	},
	{
		id: "room-301",
		number: "301",
		floor: 3,
		type: "classic",
		bed: "queen",
		view: "rooftops",
		capacity: 2,
		nightlyRate: 160,
		outOfOrder: null,
	},
	{
		id: "room-302",
		number: "302",
		floor: 3,
		type: "deluxe",
		bed: "king",
		view: "rooftops",
		capacity: 2,
		nightlyRate: 205,
		outOfOrder: null,
	},
	{
		id: "room-303",
		number: "303",
		floor: 3,
		type: "deluxe",
		bed: "queen",
		view: "rooftops",
		capacity: 2,
		nightlyRate: 200,
		// 09:40 two days ago. The room is back in two days.
		outOfOrder: {
			fromOffset: -2,
			fromMinute: 580,
			untilOffset: 2,
			reason: "Sink leak. Plumber waits for a part.",
		},
	},
	{
		id: "room-304",
		number: "304",
		floor: 3,
		type: "junior_suite",
		bed: "king",
		view: "rooftops",
		capacity: 3,
		nightlyRate: 260,
		outOfOrder: null,
	},
	{
		id: "room-305",
		number: "305",
		floor: 3,
		type: "suite",
		bed: "king",
		view: "rooftops",
		capacity: 4,
		nightlyRate: 330,
		outOfOrder: null,
	},
	{
		id: "room-306",
		number: "306",
		floor: 3,
		type: "suite",
		bed: "king",
		view: "garden",
		capacity: 4,
		nightlyRate: 320,
		outOfOrder: null,
	},
];

/** Every room, by door number, with its out-of-order dates made from `now` (milliseconds since 1970). */
export function listRooms(now: number): Room[] {
	const todayStart = startOfLocalDay(now);
	return ROOM_SEEDS.map((seed) => ({
		...seed,
		outOfOrder: seed.outOfOrder
			? {
					since: new Date(
						addDays(todayStart, seed.outOfOrder.fromOffset) +
							seed.outOfOrder.fromMinute * MINUTE_MS,
					).toISOString(),
					until: toIsoDay(addDays(todayStart, seed.outOfOrder.untilOffset)),
					reason: seed.outOfOrder.reason,
				}
			: null,
	}));
}
