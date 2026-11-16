// The checks of the current business day, with the guests who wait to order, the bookings, and the closed zones.
// It stands in for the `orders`, `order_lines`, `seatings`, and `reservations` tables.
// One plan of the whole day sits on the clock from local midnight, so the ids and the amounts never change.
// `now` only decides which checks exist yet and how far each one is: seated, in the kitchen, served, bill, paid.
// The business day runs from its first check to the first check of the next day, so the late bar stays in it.
import type { DiningTable, Reservation, Seating, Zone } from "./sample-floor";
import { listServers, listTables, ZONES } from "./sample-floor";
import type { TodayTotals } from "./sample-history";
import { isOnMenuAt, listMenuItems, type MenuItem } from "./sample-menu";
import { createSeededRandom, pickOne, randomInt } from "./seeded-random";

/** Every order status, in the order of a meal. The tabs of the orders page follow this order. */
export const ORDER_STATUSES = [
	"in_kitchen",
	"served",
	"bill",
	"paid",
	"void",
] as const;

/** One status. Its label is the message key `orderStatuses.<status>`. */
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The statuses of a check that is still on the floor. */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
	"in_kitchen",
	"served",
	"bill",
];

/** How a paid check was settled. Its label is the message key `payments.<method>`. */
export type PaymentMethod = "card" | "cash";

/** Why a manager voided a check. Its label is the message key `voidReasons.<reason>`. */
export type VoidReason = "duplicate" | "guests_left";

/** One line of a check. It keeps the name and the price of the item at the time of sale. */
export type OrderLine = {
	/** "<check number>-<line number>", for example "4812-3". */
	id: string;
	/** Id of the menu item. The item can change later; the line does not. */
	menuItemId: string;
	name: string;
	category: MenuItem["category"];
	station: MenuItem["station"];
	quantity: number;
	/** Price of one portion in cents, VAT included. */
	unitPriceCents: number;
	/** VAT share inside the price, from the menu item: 0.1 or 0.2. */
	vatRate: number;
	/** A note for the kitchen, for example "Medium rare". null when the server wrote none. */
	note: string | null;
};

/** One check of the business day. */
export type Order = {
	/** The check number as text, for example "4812". The URL `/app/orders/4812` uses it. */
	id: string;
	/** Running check number of the till. A higher number is a later check. */
	number: number;
	tableId: string;
	/** Name of the table on the floor plan, for example "T4". Joined from the table row. */
	tableName: string;
	zone: Zone;
	serverId: string;
	/** Full name of the server. Joined from the server row. */
	serverName: string;
	/** Guests on this check. Never above the seats of the table. */
	covers: number;
	/** ISO time when the server opened the check. */
	openedAt: string;
	/** ISO time when the first lines went to the kitchen. */
	sentAt: string;
	/** ISO time when the mains reached the table. null while the kitchen works, and on a void. */
	servedAt: string | null;
	/** ISO time when the server printed the bill. null before that. */
	billAt: string | null;
	/** ISO time of the payment. null on an open check and on a void. */
	paidAt: string | null;
	/** ISO time of the void. null on every other check. */
	voidedAt: string | null;
	voidReason: VoidReason | null;
	status: OrderStatus;
	lines: OrderLine[];
	/** Tip on a card payment, in cents. Cash tips go to the jar and are not on the check. */
	tipCents: number;
	/** null while the check is open, and on a void. */
	payment: PaymentMethod | null;
};

/** The kind of a sitting. It decides what the guests order and how long they stay. Its label is `services.<service>`. */
export type Service = "coffee" | "lunch" | "afternoon" | "dinner" | "late";

/** A zone that takes no new guests at this time, with its next service. */
export type ClosedZone = {
	zone: Zone;
	/** ISO time when the zone opens again. Always after now. */
	opensAt: string;
	/** The service that opens the zone again. */
	service: Service;
};

/** One planned check of the day. Times are minutes after local midnight. */
type PlannedCheck = {
	number: number;
	table: DiningTable;
	service: Service;
	covers: number;
	openedMinute: number;
	sentMinute: number;
	servedMinute: number;
	billMinute: number;
	closedMinute: number;
	/** Set on a void: the minute of the void and its reason. The check then never gets a bill. */
	voided: { minute: number; reason: VoidReason } | null;
	/** The name in the booking book, or null for a walk-in. */
	bookedName: string | null;
	lines: Omit<OrderLine, "id">[];
	tipCents: number;
	payment: PaymentMethod;
};

/**
 * The sittings of the day. Minutes after the local midnight that starts the business day; a value above 1440 is after midnight.
 * The terrace and the bar open at 6:30 for coffee. The dining room opens for lunch and closes after dinner.
 * The late bar seats on the terrace and at the bar until 0:30. A zone takes guests only inside its sittings.
 * `idleChance` is the chance that a table stays empty for a while before its next guests.
 */
const SERVICES: {
	service: Service;
	start: number;
	lastSeating: number;
	zones: readonly Zone[];
	idleChance: number;
}[] = [
	{
		service: "coffee",
		start: 6 * 60 + 30,
		lastSeating: 11 * 60 + 30,
		zones: ["terrace", "bar"],
		idleChance: 0.3,
	},
	{
		service: "lunch",
		start: 11 * 60 + 30,
		lastSeating: 14 * 60 + 30,
		zones: ["dining", "terrace", "bar"],
		idleChance: 0.15,
	},
	{
		service: "afternoon",
		start: 14 * 60 + 30,
		lastSeating: 18 * 60 + 30,
		zones: ["dining", "terrace", "bar"],
		idleChance: 0.35,
	},
	{
		service: "dinner",
		start: 18 * 60 + 30,
		lastSeating: 22 * 60 + 30,
		zones: ["dining", "terrace", "bar"],
		idleChance: 0.12,
	},
	{
		service: "late",
		start: 22 * 60 + 30,
		lastSeating: 24 * 60 + 30,
		zones: ["terrace", "bar"],
		idleChance: 0.25,
	},
];

// The last check closes at 1:30 after midnight, before the first coffee of the next business day.
const LAST_CLOSE_MINUTE = 25 * 60 + 30;

const MINUTE_MS = 60_000;

// The check counter of the till does not restart each day. This is the first number of today.
const FIRST_CHECK_NUMBER = 4781;

// The fixed seed gives the same day on every load.
const ORDERS_SEED = 7310;

// The planned checks at these places (in opening order) become voids, with their reason.
const VOIDS: { index: number; reason: VoidReason }[] = [
	{ index: 23, reason: "duplicate" },
	{ index: 88, reason: "guests_left" },
];

// A booking shows on its table in the hour before the guests arrive.
const BOOKING_LEAD_MINUTES = 60;

// Names in the booking book. Fictional, written as a host writes them: the last name only.
const BOOKING_NAMES = [
	"Delacroix",
	"Haddad",
	"Lindqvist",
	"Moreau",
	"Okonkwo",
	"Brennan",
	"Varga",
	"Castell",
	"Ibarra",
	"Novak",
	"Takeda",
	"Fairbanks",
	"Rossignol",
	"Achebe",
	"Kowalczyk",
	"Duval",
] as const;

// Kitchen notes that servers write. Steak gets a doneness note more often.
const LINE_NOTES = [
	"No onions",
	"Sauce on the side",
	"Allergy: nuts",
	"Gluten free bread",
	"No dairy",
] as const;
const STEAK_NOTES = ["Medium rare", "Medium", "Rare", "Well done"] as const;

/**
 * The checks that exist at `now` (milliseconds since 1970), newest first.
 * A check exists from the minute its lines go to the kitchen. Before that, its guests are a seating.
 * A void never gets a bill: its bill and its payment stay null.
 */
export function listOrders(now: number): Order[] {
	const { start: dayStart, minute: nowMinute } = businessDay(now);
	const servers = listServers();
	return planDay()
		.filter((check) => check.sentMinute <= nowMinute)
		.map((check) => {
			const at = (minute: number) =>
				new Date(atMinute(dayStart, minute)).toISOString();
			const reached = (minute: number) =>
				minute <= nowMinute ? at(minute) : null;
			// A check that a manager voids later in the day looks like any other check until then.
			const voided =
				check.voided && check.voided.minute <= nowMinute ? check.voided : null;
			const isPaid = !check.voided && check.closedMinute <= nowMinute;
			const status: OrderStatus = voided
				? "void"
				: isPaid
					? "paid"
					: check.billMinute <= nowMinute
						? "bill"
						: check.servedMinute <= nowMinute
							? "served"
							: "in_kitchen";
			// Desserts and coffees go to the kitchen after the mains, so an open meal shows them only on the bill.
			const isMealInProgress =
				isMeal(check.service) &&
				(status === "in_kitchen" || status === "served");
			const lines = isMealInProgress
				? check.lines.filter(
						(line) =>
							line.category !== "desserts" &&
							!["b8", "b9", "b10"].includes(line.menuItemId),
					)
				: check.lines;
			return {
				id: String(check.number),
				number: check.number,
				tableId: check.table.id,
				tableName: check.table.name,
				zone: check.table.zone,
				serverId: check.table.serverId,
				serverName:
					servers.find((server) => server.id === check.table.serverId)?.name ??
					check.table.serverId,
				covers: check.covers,
				openedAt: at(check.openedMinute),
				sentAt: at(check.sentMinute),
				servedAt: voided ? null : reached(check.servedMinute),
				billAt: check.voided ? null : reached(check.billMinute),
				paidAt: isPaid ? at(check.closedMinute) : null,
				voidedAt: voided ? at(voided.minute) : null,
				voidReason: voided?.reason ?? null,
				status,
				lines: lines.map((line, index) => ({
					...line,
					id: `${check.number}-${index + 1}`,
				})),
				tipCents: isPaid && check.payment === "card" ? check.tipCents : 0,
				payment: isPaid ? check.payment : null,
			};
		})
		.reverse();
}

/** Guests who sit at a table and have not ordered yet, at `now` (milliseconds since 1970). */
export function listSeatings(now: number): Seating[] {
	const { start: dayStart, minute: nowMinute } = businessDay(now);
	return planDay()
		.filter(
			(check) =>
				check.openedMinute <= nowMinute && nowMinute < check.sentMinute,
		)
		.map((check) => ({
			tableId: check.table.id,
			covers: check.covers,
			seatedAt: new Date(atMinute(dayStart, check.openedMinute)).toISOString(),
		}));
}

/** The bookings of the next hour at `now` (milliseconds since 1970). Each one holds its table. */
export function listReservations(now: number): Reservation[] {
	return bookingsAfter(now).filter(
		(booking) =>
			Date.parse(booking.startsAt) <= now + BOOKING_LEAD_MINUTES * MINUTE_MS,
	);
}

/** The bookings after the next hour, the earliest first. After the last sitting, they are the bookings of the next day. */
export function listUpcomingBookings(now: number): Reservation[] {
	return bookingsAfter(now).filter(
		(booking) =>
			Date.parse(booking.startsAt) > now + BOOKING_LEAD_MINUTES * MINUTE_MS,
	);
}

/** The zones that take no new guests at `now` (milliseconds since 1970), each with the start of its next service. */
export function listClosedZones(now: number): ClosedZone[] {
	const { start: dayStart, minute: nowMinute } = businessDay(now);
	return ZONES.flatMap((zone) => {
		const sittings = SERVICES.filter((sitting) => sitting.zones.includes(zone));
		const isOpen = sittings.some(
			(sitting) =>
				sitting.start <= nowMinute && nowMinute <= sitting.lastSeating,
		);
		// The next sitting of today, else the first sitting of the next business day.
		const later = sittings.find((sitting) => sitting.start > nowMinute);
		const next = later ?? sittings[0];
		if (isOpen || !next) {
			return [];
		}
		const opensAt = atMinute(
			later ? dayStart : nextDayStart(dayStart),
			next.start,
		);
		return [
			{
				zone,
				opensAt: new Date(opensAt).toISOString(),
				service: next.service,
			},
		];
	});
}

/**
 * The business day that the pages show at `now` (milliseconds since 1970): its local midnight in milliseconds,
 * and the minutes from that midnight to now. Before the first check of today, it is still the day before.
 * So the late bar after midnight stays in its evening, and the early morning shows the last full day.
 */
export function businessDay(now: number): { start: number; minute: number } {
	const midnight = new Date(now).setHours(0, 0, 0, 0);
	const firstSentMinute = Math.min(
		...planDay().map((check) => check.sentMinute),
	);
	const start =
		(now - midnight) / MINUTE_MS >= firstSentMinute
			? midnight
			: new Date(midnight).setDate(new Date(midnight).getDate() - 1);
	return { start, minute: (now - start) / MINUTE_MS };
}

/** Checks, covers, and sales of the whole planned day, voids excluded. The history scales from it. */
export function plannedDayTotals(): TodayTotals {
	return totalsOf(planDay().filter((check) => !check.voided));
}

// The totals of some planned checks. Sales are in cents, VAT included, tips excluded.
function totalsOf(checks: PlannedCheck[]): TodayTotals {
	return {
		checks: checks.length,
		covers: checks.reduce((sum, check) => sum + check.covers, 0),
		salesCents: checks.reduce((sum, check) => sum + linesTotal(check.lines), 0),
	};
}

// The plan of the day, in opening order. It depends on the seed only, so every call returns the same checks.
function planDay(): PlannedCheck[] {
	const random = createSeededRandom(ORDERS_SEED);
	const menu = listMenuItems();
	const drafts: (Omit<PlannedCheck, "number" | "voided" | "bookedName"> & {
		isBooked: boolean;
	})[] = [];
	for (const table of listTables()) {
		// The table is free from this minute on. It carries over from one sitting to the next.
		let cursor = 0;
		for (const sitting of SERVICES) {
			if (!sitting.zones.includes(table.zone)) {
				continue;
			}
			// Guests of a meal arrive over the first 100 minutes, so the tables do not all move in step.
			const arrivalSpread = isMeal(sitting.service) ? 100 : 25;
			cursor = Math.max(
				cursor,
				sitting.start + randomInt(random, 0, arrivalSpread),
			);
			while (cursor <= sitting.lastSeating) {
				// Some tables stay empty for a while between two sittings.
				if (random() < sitting.idleChance) {
					cursor += randomInt(random, 15, 40);
					continue;
				}
				const timing = timingFor(random, sitting.service, table.zone);
				const closedMinute = cursor + timing.duration;
				if (closedMinute > LAST_CLOSE_MINUTE) {
					break;
				}
				const covers = coversFor(random, table, sitting.service);
				const lines = buildLines(
					random,
					menu,
					covers,
					table.zone,
					sitting.service,
					cursor,
				);
				const payment: PaymentMethod = random() < 0.78 ? "card" : "cash";
				drafts.push({
					table,
					service: sitting.service,
					covers,
					openedMinute: cursor,
					sentMinute: cursor + timing.sent,
					servedMinute: cursor + timing.sent + timing.served,
					billMinute: closedMinute - timing.bill,
					closedMinute,
					// A party of 3 or more at a meal books 4 times in 10.
					isBooked: isMeal(sitting.service) && covers >= 3 && random() < 0.4,
					lines,
					tipCents: payment === "card" ? tipFor(random, lines) : 0,
					payment,
				});
				cursor = closedMinute + randomInt(random, 6, 25);
			}
		}
	}
	// The till numbers the checks in the order they opened.
	let bookingCount = 0;
	return drafts
		.sort((first, second) => first.openedMinute - second.openedMinute)
		.map(({ isBooked, ...draft }, index) => {
			const voidEntry = VOIDS.find((entry) => entry.index === index);
			// Each booking takes the next name of the book, so no name repeats. After the last name, guests walk in.
			const bookedName = isBooked
				? (BOOKING_NAMES[bookingCount] ?? null)
				: null;
			if (isBooked) {
				bookingCount += 1;
			}
			return {
				...draft,
				bookedName,
				number: FIRST_CHECK_NUMBER + index,
				voided: voidEntry
					? {
							minute: draft.sentMinute + randomInt(random, 2, 6),
							reason: voidEntry.reason,
						}
					: null,
			};
		});
}

// Minutes from the opening of a check to each step. The sum of sent, served, and bill stays under the duration.
function timingFor(
	random: () => number,
	service: Service,
	zone: Zone,
): { sent: number; served: number; bill: number; duration: number } {
	if (service === "coffee") {
		return {
			sent: randomInt(random, 1, 3),
			served: randomInt(random, 3, 6),
			bill: randomInt(random, 2, 4),
			duration: randomInt(random, 35, 65),
		};
	}
	// The afternoon and the late bar are drinks and small plates.
	if (service === "afternoon" || service === "late") {
		return {
			sent: randomInt(random, 2, 5),
			served: randomInt(random, 4, 8),
			bill: randomInt(random, 3, 6),
			duration: randomInt(random, 55, 100),
		};
	}
	return {
		sent: randomInt(random, 4, 11),
		served: randomInt(random, 16, 24),
		bill: randomInt(random, 6, 14),
		duration:
			zone === "bar" ? randomInt(random, 50, 75) : randomInt(random, 60, 120),
	};
}

// Guests per check. A meal fills the table or leaves one chair free. Coffee and drinks come in ones and twos.
function coversFor(
	random: () => number,
	table: DiningTable,
	service: Service,
): number {
	if (!isMeal(service) || table.seats <= 2) {
		return Math.min(table.seats, random() < 0.6 ? 2 : random() < 0.7 ? 1 : 3);
	}
	return Math.max(1, table.seats - randomInt(random, 0, 2));
}

// Tips on a card are 5 to 10 % of the check, in steps of 50 cents. 4 card checks in 10 leave none.
function tipFor(random: () => number, lines: Omit<OrderLine, "id">[]): number {
	if (random() < 0.4) {
		return 0;
	}
	return (
		Math.round((linesTotal(lines) * randomInt(random, 5, 10)) / 100 / 50) * 50
	);
}

// The sum of the lines in cents, VAT included.
function linesTotal(lines: Omit<OrderLine, "id">[]): number {
	return lines.reduce(
		(sum, line) => sum + line.quantity * line.unitPriceCents,
		0,
	);
}

/**
 * The lines of one check. Coffee is one hot drink or a juice per guest. The afternoon and the late bar are drinks
 * and some small plates. Lunch and dinner are full meals. Equal items merge into one line with a quantity.
 */
function buildLines(
	random: () => number,
	allItems: MenuItem[],
	covers: number,
	zone: Zone,
	service: Service,
	openedMinute: number,
): Omit<OrderLine, "id">[] {
	// A check takes only the dishes that the kitchen still has when the guests sit down.
	const menu = allItems.filter(
		(item) => item.isAvailable && isOnMenuAt(item.id, openedMinute),
	);
	const byCategory = (category: MenuItem["category"]) =>
		menu.filter((item) => item.category === category);
	const byIds = (ids: string[]) => menu.filter((item) => ids.includes(item.id));
	const pick = (items: MenuItem[]) => {
		const [first, ...rest] = items;
		return first ? pickOne(random, [first, ...rest]) : undefined;
	};
	const picked: { item: MenuItem; note: string | null }[] = [];
	const add = (item: MenuItem | undefined, note: string | null = null) => {
		if (item) {
			picked.push({ item, note });
		}
	};
	const glasses = byIds(["b1", "b2"]);
	const softs = byIds(["b6", "b7", "b11"]);
	// Espresso leads the hot drinks of a bistro, then cappuccino. Mint tea is a distant third.
	const pickHotDrink = () => {
		const roll = random();
		return menu.find(
			(item) => item.id === (roll < 0.55 ? "b8" : roll < 0.88 ? "b9" : "b10"),
		);
	};
	const isBar = zone === "bar";

	if (service === "coffee") {
		for (let cover = 0; cover < covers; cover += 1) {
			add(random() < 0.8 ? pickHotDrink() : pick(byIds(["b11"])));
			// A second coffee, 3 times in 10.
			if (random() < 0.3) {
				add(pickHotDrink());
			}
		}
	} else if (service === "afternoon" || service === "late") {
		for (let cover = 0; cover < covers; cover += 1) {
			add(pick([...glasses, ...byIds(["b4", "b5", "b7"])]));
			if (random() < 0.25) {
				add(pick(byCategory("desserts")));
			}
		}
		// A shared small plate, 3 checks in 10.
		if (random() < 0.3) {
			add(pick(byCategory("starters")));
		}
	} else {
		// A bottle replaces the glasses at a table of 3 or more, 4 times in 10.
		const hasBottle = covers >= 3 && random() < 0.4;
		if (hasBottle) {
			add(menu.find((item) => item.id === "b3"));
		}
		for (let cover = 0; cover < covers; cover += 1) {
			// The bar serves drinks and small plates more than full meals.
			if (random() < (isBar ? 0.35 : 0.5)) {
				add(pick(byCategory("starters")));
			}
			if (random() < (isBar ? 0.6 : 0.95)) {
				const main = pick(byCategory("mains"));
				const steakNote =
					main?.id === "m1" ? pickOne(random, STEAK_NOTES) : null;
				const note =
					steakNote ?? (random() < 0.08 ? pickOne(random, LINE_NOTES) : null);
				add(main, note);
				if (random() < 0.2) {
					add(pick(byCategory("sides")));
				}
			}
			if (!hasBottle) {
				const drinkRoll = random();
				if (drinkRoll < 0.5) {
					add(pick(glasses));
				} else if (drinkRoll < 0.65) {
					add(menu.find((item) => item.id === (isBar ? "b5" : "b4")));
				} else {
					add(pick(softs));
				}
			}
			if (random() < 0.38) {
				add(pick(byCategory("desserts")));
			}
			if (random() < 0.42) {
				add(pickHotDrink());
			}
		}
	}
	// A check never stays empty: a lone guest still has a drink.
	if (picked.length === 0) {
		add(service === "coffee" ? pickHotDrink() : pick(glasses));
	}

	const lines: Omit<OrderLine, "id">[] = [];
	for (const { item, note } of picked) {
		const same = lines.find(
			(line) => line.menuItemId === item.id && line.note === note,
		);
		if (same) {
			same.quantity += 1;
		} else {
			lines.push({
				menuItemId: item.id,
				name: item.name,
				category: item.category,
				station: item.station,
				quantity: 1,
				unitPriceCents: item.priceCents,
				vatRate: item.vatRate,
				note,
			});
		}
	}
	// The ticket order: the meal order of the categories, then the menu order.
	return lines.sort(
		(first, second) =>
			allItems.findIndex((item) => item.id === first.menuItemId) -
			allItems.findIndex((item) => item.id === second.menuItemId),
	);
}

// The bookings that start after `now`, in this business day and the next one, the earliest first.
// The plan is the same each day, so the next day has the same bookings one day later.
function bookingsAfter(now: number): Reservation[] {
	const { start } = businessDay(now);
	const plan = planDay();
	return [start, nextDayStart(start)].flatMap((dayStart) =>
		plan.flatMap((check) => {
			const startsAt = atMinute(dayStart, check.openedMinute);
			return check.bookedName !== null && startsAt > now
				? [
						{
							id: `r-${dayStart}-${check.number}`,
							tableId: check.table.id,
							guestName: check.bookedName,
							covers: check.covers,
							startsAt: new Date(startsAt).toISOString(),
						},
					]
				: [];
		}),
	);
}

// True for a full meal. A meal can have a booking, lasts longer, and sends its desserts after the mains.
function isMeal(service: Service): boolean {
	return service === "lunch" || service === "dinner";
}

// Local midnight of the day after `dayStart`. setDate keeps midnight right on a clock-change day.
function nextDayStart(dayStart: number): number {
	const date = new Date(dayStart);
	date.setDate(date.getDate() + 1);
	return date.getTime();
}

// `minute` minutes after local midnight `dayStart`, in milliseconds. setHours keeps the clock right on a clock-change day.
function atMinute(dayStart: number, minute: number): number {
	return new Date(dayStart).setHours(0, minute, 0, 0);
}
