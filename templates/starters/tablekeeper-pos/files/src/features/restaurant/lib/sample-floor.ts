// The floor of the restaurant: 20 tables in 3 zones, the 4 servers, and the types of seatings and bookings.
// It stands in for the `tables` and `servers` tables. sample-orders.ts derives the seatings and the bookings.
// The floor queries and the order screen read the tables through ~/features/restaurant.

/** The zones of the floor, in the order of the floor plan. The orders list filters by zone. */
export const ZONES = ["dining", "terrace", "bar"] as const;

/** One zone. Its label is the message key `zones.<zone>`. */
export type Zone = (typeof ZONES)[number];

/** One server of the team. A server works one section of tables. */
export type Server = {
	id: string;
	/** Full name. The pages show the first name in tight places. */
	name: string;
};

/** One table of the floor. */
export type DiningTable = {
	/** Stable id, for example "t4". The URL param `?table=t4` uses it. */
	id: string;
	/** The name on the floor plan, for example "T4" or "B2". */
	name: string;
	zone: Zone;
	/** Chairs at the table. Covers on an order never pass this number. */
	seats: number;
	/** Id of the server whose section holds this table. */
	serverId: string;
};

/** Guests at a table who have not ordered yet. */
export type Seating = {
	tableId: string;
	/** Guests at the table. */
	covers: number;
	/** ISO time when the host seated them. Always before now. */
	seatedAt: string;
};

/** A booking that comes in the next hour. The table shows as reserved until then. */
export type Reservation = {
	id: string;
	tableId: string;
	/** The name in the book, last name first, as a host writes it. */
	guestName: string;
	covers: number;
	/** ISO time of the booking. Always after now. */
	startsAt: string;
};

const SERVERS: Server[] = [
	{ id: "nadia", name: "Nadia Ferrand" },
	{ id: "tom", name: "Tom Okafor" },
	{ id: "lea", name: "Léa Marchetti" },
	{ id: "sam", name: "Sam Whitford" },
];

// The dining room splits into two sections. The terrace and the bar have one server each.
const TABLES: DiningTable[] = [
	{ id: "t1", name: "T1", zone: "dining", seats: 2, serverId: "nadia" },
	{ id: "t2", name: "T2", zone: "dining", seats: 2, serverId: "nadia" },
	{ id: "t3", name: "T3", zone: "dining", seats: 4, serverId: "nadia" },
	{ id: "t4", name: "T4", zone: "dining", seats: 4, serverId: "nadia" },
	{ id: "t5", name: "T5", zone: "dining", seats: 6, serverId: "nadia" },
	{ id: "t6", name: "T6", zone: "dining", seats: 4, serverId: "tom" },
	{ id: "t7", name: "T7", zone: "dining", seats: 2, serverId: "tom" },
	{ id: "t8", name: "T8", zone: "dining", seats: 4, serverId: "tom" },
	{ id: "t9", name: "T9", zone: "dining", seats: 8, serverId: "tom" },
	{ id: "t10", name: "T10", zone: "dining", seats: 2, serverId: "tom" },
	{ id: "t11", name: "T11", zone: "terrace", seats: 4, serverId: "lea" },
	{ id: "t12", name: "T12", zone: "terrace", seats: 2, serverId: "lea" },
	{ id: "t13", name: "T13", zone: "terrace", seats: 4, serverId: "lea" },
	{ id: "t14", name: "T14", zone: "terrace", seats: 2, serverId: "lea" },
	{ id: "t15", name: "T15", zone: "terrace", seats: 6, serverId: "lea" },
	{ id: "t16", name: "T16", zone: "terrace", seats: 4, serverId: "lea" },
	{ id: "b1", name: "B1", zone: "bar", seats: 2, serverId: "sam" },
	{ id: "b2", name: "B2", zone: "bar", seats: 2, serverId: "sam" },
	{ id: "b3", name: "B3", zone: "bar", seats: 2, serverId: "sam" },
	{ id: "b4", name: "B4", zone: "bar", seats: 2, serverId: "sam" },
];

/** Every server, in the order of the sections. */
export function listServers(): Server[] {
	return SERVERS;
}

/** Every table, in the order of the floor plan. */
export function listTables(): DiningTable[] {
	return TABLES;
}
