// The sample programme of the organiser: 42 fictional events from about 24 weeks ago to 16 weeks ahead.
// It stands in for the `events`, `ticket_tiers`, and `run_of_show_items` tables.
// listEvents builds each date as "today plus N days", so the programme never looks old.
import { addDays, atMinute, startOfLocalDay } from "./time";

/** The kinds of event. Each one has the label `events.kinds.<kind>`. */
export const EVENT_KINDS = [
	"concert",
	"conference",
	"workshop",
	"comedy",
	"gala",
] as const;

/** One kind of event. */
export type EventKind = (typeof EVENT_KINDS)[number];

/** The sales role of a tier: the early tier sells first, the premium tier has a small quota. */
type TierRole = "early" | "general" | "premium";

/** One ticket tier of an event. A future `ticket_tiers` row. */
export type TicketTier = {
	/** Stable id, for example "evt-1013-t2". */
	id: string;
	name: string;
	/** The price of one ticket, in whole euros. */
	price: number;
	/** The most tickets that this tier can sell. The quotas of an event add up to its capacity. */
	quota: number;
	role: TierRole;
};

/** One line of the run of show: the timed plan of the event day. A future `run_of_show_items` row. */
export type ScheduleItem = {
	id: string;
	/** The start, in milliseconds since 1970. */
	startsAt: number;
	durationMinutes: number;
	title: string;
	/** The place in the venue, for example "Stage" or "Foyer". */
	area: string;
	/** The crew role that runs this line. */
	owner: string;
};

/** One event of the programme. A future `events` row, with its tiers and its run of show. */
export type EventRow = {
	/** Stable id, for example "evt-1013". The URL of the detail page holds it. */
	id: string;
	/** The number of the event. Order references start with it. */
	number: number;
	name: string;
	kind: EventKind;
	venueId: string;
	/** One line under the name: the line-up, the format, or the reason of a cancellation. */
	note: string;
	/** The ticket limit of this layout. It is never above the venue capacity. */
	capacity: number;
	/** Milliseconds since 1970. */
	onSaleAt: number;
	doorsAt: number;
	startsAt: number;
	endsAt: number;
	/** The time of the cancellation, or null. A cancelled event sells nothing after it. */
	cancelledAt: number | null;
	/** Expected sales as a share of the capacity. Above 1 sells out before the day. */
	demand: number;
	tiers: TicketTier[];
	schedule: ScheduleItem[];
};

// One planned event: number, name, kind, venue, day offset from today, start (minutes after midnight),
// duration in minutes, capacity, base price in euros, demand, days of sale before the event, note.
type PlannedEvent = readonly [
	number,
	string,
	EventKind,
	string,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	string,
];

const PLAN: readonly PlannedEvent[] = [
	[
		1001,
		"Lights of the City Gala",
		"gala",
		"v-foundry",
		-168,
		1140,
		300,
		600,
		120,
		0.97,
		60,
		"Black tie. Dinner by Saltmarsh Kitchen.",
	],
	[
		1002,
		"Northern Static",
		"concert",
		"v-lantern",
		-160,
		1200,
		180,
		1800,
		38,
		1.05,
		70,
		"Support from Paper Lanterns.",
	],
	[
		1003,
		"Retail Futures Forum",
		"conference",
		"v-foundry",
		-152,
		540,
		480,
		900,
		180,
		0.86,
		80,
		"24 speakers on two stages.",
	],
	[
		1004,
		"Late Laughs Special",
		"comedy",
		"v-cellar",
		-145,
		1230,
		150,
		350,
		22,
		1.1,
		40,
		"Hosted by Wren Calder.",
	],
	[
		1005,
		"Analog Photo Lab",
		"workshop",
		"v-glasshouse",
		-137,
		600,
		180,
		60,
		85,
		1,
		45,
		"Film cameras on loan. Bring nothing.",
	],
	[
		1006,
		"Kite Season",
		"concert",
		"v-quayside",
		-129,
		1200,
		180,
		2200,
		32,
		0.9,
		75,
		"Standing only. Support from Moth Radio.",
	],
	[
		1007,
		"Design Systems Day",
		"conference",
		"v-foundry",
		-120,
		570,
		480,
		800,
		150,
		0.95,
		80,
		"One track, nine talks, two workshops.",
	],
	[
		1008,
		"Saltbox Stand-up Night",
		"comedy",
		"v-saltbox",
		-112,
		1200,
		150,
		620,
		25,
		0.85,
		45,
		"Five comics, one host.",
	],
	[
		1009,
		"Marisol Ferrer Quartet",
		"concert",
		"v-saltbox",
		-104,
		1170,
		180,
		620,
		34,
		1.08,
		60,
		"Seated jazz in two sets.",
	],
	[
		1010,
		"Natural Wine Tasting",
		"workshop",
		"v-meridian",
		-96,
		1110,
		180,
		120,
		55,
		1.05,
		40,
		"Six wines with a guest grower.",
	],
	[
		1011,
		"Low Tide Choir",
		"concert",
		"v-orchard",
		-88,
		1140,
		180,
		900,
		28,
		0.8,
		60,
		"Open air. Rain plan in the pavilion.",
	],
	[
		1012,
		"Arts Benefit Night",
		"gala",
		"v-orchard",
		-80,
		1110,
		300,
		450,
		140,
		0.9,
		60,
		"Proceeds go to the youth theatre fund.",
	],
	[
		1013,
		"Velvet Arcade",
		"concert",
		"v-lantern",
		-72,
		1200,
		180,
		1800,
		42,
		1.15,
		80,
		"Neon Tour. Support from Glass Fawn.",
	],
	[
		1014,
		"Climate Ops Meetup",
		"conference",
		"v-foundry",
		-64,
		540,
		480,
		500,
		60,
		0.95,
		50,
		"Talks and an evening of demos.",
	],
	[
		1015,
		"Ceramics Evening",
		"workshop",
		"v-glasshouse",
		-57,
		1080,
		180,
		48,
		70,
		1,
		35,
		"Wheel and hand-building. Clay included.",
	],
	[
		1016,
		"The Hollow Pines",
		"concert",
		"v-quayside",
		-50,
		1200,
		180,
		2400,
		36,
		1,
		75,
		"Album launch show.",
	],
	[
		1017,
		"Open Mic at the Cellar",
		"comedy",
		"v-cellar",
		-43,
		1200,
		150,
		300,
		12,
		0.9,
		30,
		"Ten new acts, five minutes each.",
	],
	[
		1018,
		"Founders' Day",
		"conference",
		"v-meridian",
		-36,
		540,
		480,
		240,
		45,
		1.05,
		35,
		"Morning talks, afternoon mentoring.",
	],
	[
		1019,
		"Harbour Strings",
		"concert",
		"v-saltbox",
		-29,
		1170,
		180,
		620,
		30,
		0.95,
		55,
		"A chamber programme by candlelight.",
	],
	[
		1020,
		"Podcast Production Bootcamp",
		"workshop",
		"v-glasshouse",
		-22,
		570,
		180,
		60,
		120,
		0.9,
		40,
		"A mic and an editing seat for each guest.",
	],
	[
		1021,
		"Ember & Ash",
		"concert",
		"v-lantern",
		-15,
		1200,
		180,
		1800,
		39,
		1,
		70,
		"Support from Coastal Static.",
	],
	[
		1022,
		"Stand-up on the Roof",
		"comedy",
		"v-meridian",
		-9,
		1200,
		150,
		260,
		20,
		1.1,
		30,
		"Blankets at the bar.",
	],
	[
		1023,
		"Build & Ship Summit",
		"conference",
		"v-foundry",
		-4,
		540,
		480,
		1200,
		210,
		0.95,
		90,
		"40 speakers, three stages, one day.",
	],
	[
		1024,
		"Deep Cuts Vinyl Night",
		"concert",
		"v-cellar",
		-1,
		1260,
		180,
		350,
		18,
		1.05,
		30,
		"All-vinyl DJ sets until late.",
	],
	[
		1025,
		"Hospitality Leaders Forum",
		"conference",
		"v-foundry",
		0,
		570,
		480,
		700,
		95,
		0.98,
		60,
		"Talks for hotel and venue managers.",
	],
	[
		1026,
		"Moonlit Jazz Session",
		"concert",
		"v-saltbox",
		0,
		1200,
		180,
		620,
		32,
		1.02,
		50,
		"Seated. Late bar after the set.",
	],
	[
		1027,
		"Life Drawing at the Glasshouse",
		"workshop",
		"v-glasshouse",
		2,
		1110,
		180,
		40,
		35,
		1.25,
		30,
		"Materials and a live model.",
	],
	[
		1028,
		"Paper Moons",
		"concert",
		"v-lantern",
		4,
		1200,
		180,
		1800,
		44,
		1.3,
		75,
		"Support from Hollow Bay.",
	],
	[
		1029,
		"Downstairs Comedy Hour",
		"comedy",
		"v-cellar",
		6,
		1230,
		150,
		350,
		24,
		0.95,
		40,
		"Recorded for the club podcast.",
	],
	[
		1030,
		"Product Analytics Day",
		"conference",
		"v-foundry",
		9,
		540,
		480,
		900,
		160,
		0.9,
		80,
		"Hands-on labs in the afternoon.",
	],
	[
		1031,
		"Songwriters in the Round",
		"concert",
		"v-saltbox",
		13,
		1170,
		180,
		620,
		26,
		0.85,
		55,
		"Four writers, one stage.",
	],
	[
		1032,
		"Long Table Supper",
		"gala",
		"v-orchard",
		17,
		1140,
		300,
		400,
		95,
		0.92,
		60,
		"A menu from the farms of the valley.",
	],
	[
		1033,
		"Riverside Sessions",
		"concert",
		"v-meridian",
		21,
		1140,
		180,
		280,
		30,
		1,
		45,
		"Acoustic sets at sunset.",
	],
	[
		1034,
		"Orchard Open-Air Concert",
		"concert",
		"v-orchard",
		26,
		1080,
		180,
		900,
		30,
		0.8,
		60,
		"Cancelled: the park refused the permit. Every order is refunded.",
	],
	[
		1035,
		"Midnight Disco Revival",
		"concert",
		"v-quayside",
		31,
		1320,
		240,
		2400,
		28,
		0.85,
		60,
		"Three rooms, one dress code: sequins.",
	],
	[
		1036,
		"Sketch Comedy Showcase",
		"comedy",
		"v-saltbox",
		38,
		1200,
		150,
		620,
		22,
		0.85,
		45,
		"Six troupes, short sets.",
	],
	[
		1037,
		"Patrons' Winter Gala",
		"gala",
		"v-foundry",
		46,
		1140,
		300,
		650,
		150,
		0.95,
		60,
		"Awards night and a live auction.",
	],
	[
		1038,
		"Wild Atlas",
		"concert",
		"v-lantern",
		55,
		1200,
		180,
		1800,
		40,
		1,
		75,
		"Support from Juniper Coast.",
	],
	[
		1039,
		"Future of Work Forum",
		"conference",
		"v-foundry",
		67,
		540,
		480,
		1000,
		175,
		0.9,
		90,
		"Two tracks and a jobs fair.",
	],
	[
		1040,
		"Warehouse All-Nighter",
		"concert",
		"v-quayside",
		80,
		1260,
		300,
		2400,
		55,
		1,
		90,
		"Four DJs across two rooms.",
	],
	[
		1041,
		"Letterpress Workshop",
		"workshop",
		"v-glasshouse",
		95,
		600,
		180,
		30,
		90,
		1,
		40,
		"Print your own cards to take home.",
	],
	[
		1042,
		"Comedy Festival Preview",
		"comedy",
		"v-saltbox",
		110,
		1200,
		150,
		620,
		24,
		0.9,
		45,
		"A first look at the festival line-up.",
	],
];

// The event that the organiser cancelled, and the day of the cancellation (3 days ago, at 11:00).
const CANCELLED_EVENT = 1034;
const CANCELLED_DAYS_AGO = 3;
const CANCELLED_MINUTE = 660;
// Tickets go on sale at 10:00 on the first day of sale.
const ON_SALE_MINUTE = 600;

// Minutes between the doors and the start, per kind.
const DOORS_LEAD_MINUTES = {
	concert: 60,
	conference: 45,
	workshop: 15,
	comedy: 30,
	gala: 45,
} satisfies Record<EventKind, number>;

// The tiers of each kind: name, price factor of the base price, and quota share. null takes the rest of the capacity.
const TIER_PLANS = {
	concert: [
		["Early bird", 0.8, 0.15, "early"],
		["General admission", 1, null, "general"],
		["VIP balcony", 2.2, 0.06, "premium"],
	],
	conference: [
		["Early bird", 0.7, 0.2, "early"],
		["Standard pass", 1, null, "general"],
		["All-access pass", 1.6, 0.1, "premium"],
	],
	workshop: [
		["Member price", 0.8, 0.25, "early"],
		["Standard seat", 1, null, "general"],
	],
	comedy: [
		["Early bird", 0.8, 0.2, "early"],
		["General admission", 1, null, "general"],
		["Front row", 1.5, 0.08, "premium"],
	],
	gala: [
		["Single seat", 1, null, "general"],
		["Patron seat", 1.8, 0.15, "premium"],
	],
} satisfies Record<
	EventKind,
	readonly (readonly [string, number, number | null, TierRole])[]
>;

// The run of show of each kind: minutes from the start (negative before it), duration, title, area, crew role.
const SCHEDULE_PLANS = {
	concert: [
		[-300, 120, "Load-in and stage build", "Stage", "Production"],
		[-180, 45, "Soundcheck, headline act", "Stage", "Sound"],
		[-120, 30, "Soundcheck, support act", "Stage", "Sound"],
		[-75, 15, "Crew briefing and radio check", "Backstage", "Stage manager"],
		[-60, 60, "Doors open", "Foyer", "Front of house"],
		[0, 40, "Support act", "Stage", "Stage manager"],
		[40, 25, "Changeover", "Stage", "Production"],
		[65, 95, "Headline set", "Stage", "Stage manager"],
		[160, 20, "House lights up, exit", "Auditorium", "Front of house"],
		[180, 90, "Load-out", "Stage", "Production"],
	],
	conference: [
		[-90, 45, "Registration desk set-up", "Foyer", "Front of house"],
		[-45, 45, "Badge pick-up and coffee", "Foyer", "Front of house"],
		[0, 45, "Opening keynote", "Main hall", "Host"],
		[50, 60, "Panel: the year ahead", "Main hall", "Host"],
		[110, 30, "Coffee break", "Foyer", "Catering"],
		[140, 90, "Breakout sessions", "Rooms B and C", "Programme team"],
		[230, 60, "Lunch", "Foyer", "Catering"],
		[290, 120, "Afternoon track", "Main hall", "Programme team"],
		[410, 30, "Closing remarks", "Main hall", "Host"],
		[440, 40, "Networking drinks", "Foyer", "Catering"],
	],
	workshop: [
		[-60, 45, "Room set-up and materials", "Studio", "Host"],
		[-15, 15, "Doors and welcome drink", "Entrance", "Front of house"],
		[0, 20, "Introduction", "Studio", "Host"],
		[20, 40, "Demonstration", "Studio", "Host"],
		[60, 90, "Hands-on session", "Studio", "Host"],
		[150, 30, "Show and tell, wrap-up", "Studio", "Host"],
		[180, 30, "Pack-down", "Studio", "Production"],
	],
	comedy: [
		[-120, 30, "Tech run and mic check", "Stage", "Sound"],
		[-30, 30, "Doors and bar open", "Bar", "Front of house"],
		[0, 10, "Welcome from the host", "Stage", "Host"],
		[10, 45, "First half: three openers", "Stage", "Stage manager"],
		[55, 20, "Interval", "Bar", "Front of house"],
		[75, 60, "Headliner", "Stage", "Stage manager"],
		[135, 15, "Close and exit", "Auditorium", "Front of house"],
	],
	gala: [
		[-240, 120, "Room dressing and table plan", "Main room", "Production"],
		[-90, 30, "Catering briefing", "Kitchen", "Catering"],
		[-45, 45, "Arrival and welcome drinks", "Terrace", "Front of house"],
		[0, 15, "Welcome address", "Main room", "Host"],
		[15, 75, "Dinner service", "Main room", "Catering"],
		[90, 45, "Awards and speeches", "Stage", "Stage manager"],
		[135, 30, "Live auction", "Stage", "Host"],
		[165, 135, "Dance floor and late bar", "Main room", "Front of house"],
	],
} satisfies Record<
	EventKind,
	readonly (readonly [number, number, string, string, string])[]
>;

/** The tiers of one event. The quotas add up to `capacity`. */
function buildTiers(
	eventId: string,
	kind: EventKind,
	capacity: number,
	basePrice: number,
): TicketTier[] {
	const plans = TIER_PLANS[kind];
	const fixedQuota = plans.reduce(
		(sum, [, , share]) =>
			share === null ? sum : sum + Math.round(capacity * share),
		0,
	);
	return plans.map(([name, factor, share, role], index) => ({
		id: `${eventId}-t${index + 1}`,
		name,
		price: Math.round(basePrice * factor),
		quota:
			share === null ? capacity - fixedQuota : Math.round(capacity * share),
		role,
	}));
}

/**
 * Every event of the programme, the earliest first. `now` is milliseconds since 1970.
 * The dates count from the local midnight of today, so the rows stay the same all day.
 */
export function listEvents(now: number): EventRow[] {
	const today = startOfLocalDay(now);
	return PLAN.map(
		([
			number,
			name,
			kind,
			venueId,
			dayOffset,
			startMinute,
			durationMinutes,
			capacity,
			basePrice,
			demand,
			saleDays,
			note,
		]) => {
			const id = `evt-${number}`;
			const eventDay = addDays(today, dayOffset);
			const startsAt = atMinute(eventDay, startMinute);
			return {
				id,
				number,
				name,
				kind,
				venueId,
				note,
				capacity,
				onSaleAt: atMinute(addDays(eventDay, -saleDays), ON_SALE_MINUTE),
				doorsAt: atMinute(eventDay, startMinute - DOORS_LEAD_MINUTES[kind]),
				startsAt,
				endsAt: atMinute(eventDay, startMinute + durationMinutes),
				cancelledAt:
					number === CANCELLED_EVENT
						? atMinute(addDays(today, -CANCELLED_DAYS_AGO), CANCELLED_MINUTE)
						: null,
				demand,
				tiers: buildTiers(id, kind, capacity, basePrice),
				schedule: SCHEDULE_PLANS[kind].map(
					([offset, duration, title, area, owner], index) => ({
						id: `${id}-s${index + 1}`,
						startsAt: atMinute(eventDay, startMinute + offset),
						durationMinutes: duration,
						title,
						area,
						owner,
					}),
				),
			};
		},
	);
}
