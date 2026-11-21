// The sample tables of the support desk: agents, customers, contacts, tickets, messages, ticket events, and articles.
// Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every time counts from the start of today, so the rows stay the same for the whole day.
// LIMIT: the history moves by one day at midnight, and today's tickets appear when their time passes. Upgrade: real tables (STARTER.md).
import { DAY_MS, HOUR_MS, MINUTE_MS, startOfLocalDay } from "./relative-time";
import {
	ARTICLE_TEXTS,
	type ArticleText,
	TICKET_SCRIPTS,
	type TicketScript,
} from "./sample-texts";
import {
	type CustomerPlan,
	FIRST_REPLY_TARGET_MINUTES,
	RESOLUTION_TARGET_MINUTES,
	type TicketChannel,
	type TicketPriority,
	type TicketStatus,
	type TicketTopic,
} from "./ticket-rules";

/** One person of the support team. Agents own tickets and write replies and notes. */
export type AgentRow = {
	id: string;
	name: string;
	/** The job title, for example "Support lead". */
	role: string;
};

/** One customer company that pays for the product. */
export type CustomerRow = {
	id: string;
	name: string;
	city: string;
	plan: CustomerPlan;
	/** Paid seats. MRR is seats times PLAN_SEAT_PRICE of the plan. */
	seats: number;
	/** The day the company started to pay, as ISO. */
	customerSince: string;
};

/** One person at a customer company who writes to support. */
export type ContactRow = {
	id: string;
	customerId: string;
	name: string;
	/** The job title, for example "Office manager". */
	title: string;
	email: string;
};

/** A customer rating of a solved ticket. Most solved tickets get no rating. */
export type TicketRating = "good" | "bad";

/** One support ticket. The times are ISO texts. */
export type TicketRow = {
	/** The ticket number as text, for example "4127". It is also the `$ticketId` of the detail route. */
	id: string;
	subject: string;
	customerId: string;
	/** The contact who opened the ticket. A person of `customerId`. */
	requesterId: string;
	/** The agent who owns the ticket. null while nobody took it. */
	assigneeId: string | null;
	status: TicketStatus;
	priority: TicketPriority;
	channel: TicketChannel;
	topic: TicketTopic;
	/** The help article that the first reply links, or null. */
	articleId: string | null;
	createdAt: string;
	/** The first agent reply. null on a new ticket. */
	firstReplyAt: string | null;
	/** null while the ticket is open. */
	solvedAt: string | null;
	rating: TicketRating | null;
};

/** One message of a ticket conversation. A note is internal: the customer never sees it. */
export type MessageRow = {
	id: string;
	ticketId: string;
	kind: "customer" | "agent" | "note";
	authorName: string;
	body: string;
	sentAt: string;
};

/** One change of a ticket that the conversation shows as a line: an assignment or a status change. */
export type TicketEventRow = {
	id: string;
	ticketId: string;
	type: "assigned" | "pending" | "solved" | "closed";
	/** The agent of the change. null for the nightly job that closes solved tickets. */
	agentId: string | null;
	occurredAt: string;
};

/** One help article, with the numbers of the help center. */
export type ArticleRow = ArticleText & {
	/** The agent who wrote the last version. */
	authorId: string;
	updatedAt: string;
	/** Page views in the last 30 days. 0 for a draft. */
	views30d: number;
	/** "Was this helpful?" answers in the last 30 days. */
	helpfulYes: number;
	helpfulNo: number;
	/** Page views of the 30 days before those 30 days. The articles page compares the two periods. */
	viewsBefore30d: number;
	/** "Was this helpful?" answers of the 30 days before. */
	helpfulYesBefore: number;
	helpfulNoBefore: number;
};

/** Every sample table. Each list is in creation order; the query files sort and join them. */
export type SampleTables = {
	agents: AgentRow[];
	customers: CustomerRow[];
	contacts: ContactRow[];
	tickets: TicketRow[];
	messages: MessageRow[];
	events: TicketEventRow[];
	articles: ArticleRow[];
};

const AGENTS: AgentRow[] = [
	{ id: "agent-1", name: "Ines Moreau", role: "Support lead" },
	{ id: "agent-2", name: "Theo Brandt", role: "Support engineer" },
	{ id: "agent-3", name: "Mariam Okafor", role: "Support agent" },
	{ id: "agent-4", name: "Lukas Varga", role: "Support agent" },
	{ id: "agent-5", name: "Selin Arslan", role: "Support agent" },
	{ id: "agent-6", name: "Ruben Castillo", role: "Support engineer" },
];

// The lead takes fewer tickets than the agents. One weight per agent, in the order of AGENTS.
const AGENT_WEIGHTS = [0.5, 1, 1.2, 1.2, 1.1, 0.9];

/** A customer before the generator adds its id and its start date. */
type CustomerSeed = Omit<CustomerRow, "id" | "customerSince">;

const CUSTOMERS: CustomerSeed[] = [
	{ name: "Brightwell Studio", city: "Lisbon", plan: "growth", seats: 18 },
	{ name: "Northgate Freight", city: "Rotterdam", plan: "scale", seats: 64 },
	{ name: "Copperleaf Clinics", city: "Leeds", plan: "scale", seats: 52 },
	{ name: "Halcyon Events", city: "Barcelona", plan: "starter", seats: 8 },
	{
		name: "Mosswood Architects",
		city: "Copenhagen",
		plan: "growth",
		seats: 22,
	},
	{ name: "Quarry Lane Bakery", city: "Dublin", plan: "starter", seats: 6 },
	{
		name: "Tallpine Logistics",
		city: "Gdansk",
		plan: "enterprise",
		seats: 140,
	},
	{ name: "Bluefin Travel", city: "Valencia", plan: "growth", seats: 26 },
	{ name: "Redstone Legal", city: "Edinburgh", plan: "scale", seats: 40 },
	{
		name: "Larkfield Schools",
		city: "Manchester",
		plan: "enterprise",
		seats: 210,
	},
	{
		name: "Orchard & Vine Catering",
		city: "Porto",
		plan: "starter",
		seats: 10,
	},
	{ name: "Kilnworks Pottery", city: "Ghent", plan: "starter", seats: 5 },
	{ name: "Fairhaven Dental", city: "Cork", plan: "growth", seats: 15 },
	{ name: "Silverline Media", city: "Berlin", plan: "scale", seats: 48 },
	{ name: "Wildmere Outdoor", city: "Innsbruck", plan: "growth", seats: 20 },
	{ name: "Beacon Hill Property", city: "Bristol", plan: "scale", seats: 36 },
	{ name: "Marlowe Consulting", city: "Brussels", plan: "growth", seats: 28 },
	{ name: "Juniper Health", city: "Utrecht", plan: "enterprise", seats: 120 },
	{ name: "Stonebridge Builders", city: "Antwerp", plan: "growth", seats: 30 },
	{ name: "Tidewater Marine", city: "Bergen", plan: "scale", seats: 44 },
	{ name: "Ashgrove Accounting", city: "Glasgow", plan: "starter", seats: 9 },
	{ name: "Cobalt Gearworks Lab", city: "Eindhoven", plan: "scale", seats: 58 },
	{
		name: "Pebble & Pine Interiors",
		city: "Nantes",
		plan: "starter",
		seats: 7,
	},
	{ name: "Riverbend Veterinary", city: "Aarhus", plan: "growth", seats: 16 },
	{ name: "Summit Peak Fitness", city: "Graz", plan: "growth", seats: 24 },
	{ name: "Hollowtree Publishing", city: "Oxford", plan: "starter", seats: 11 },
	{ name: "Greyfriars Hotels", city: "York", plan: "enterprise", seats: 96 },
	{ name: "Lumen Optics", city: "Turin", plan: "scale", seats: 38 },
	{ name: "Meadowlark Farms", city: "Bordeaux", plan: "growth", seats: 19 },
	{ name: "Ironside Security", city: "Hamburg", plan: "scale", seats: 46 },
	{
		name: "Featherstone Insurance",
		city: "Luxembourg",
		plan: "enterprise",
		seats: 160,
	},
	{ name: "Oakridge Recruitment", city: "Cardiff", plan: "growth", seats: 21 },
	{ name: "Saltwind Analytics", city: "Malmö", plan: "growth", seats: 17 },
	{ name: "Crescent Moon Yoga", city: "Bologna", plan: "starter", seats: 6 },
	{
		name: "Thistledown Charity",
		city: "Inverness",
		plan: "starter",
		seats: 12,
	},
	{ name: "Vantage Point Surveys", city: "Lyon", plan: "growth", seats: 23 },
	{ name: "Westbrook Pharmacy", city: "Galway", plan: "growth", seats: 14 },
	{ name: "Amberly Furniture", city: "Leuven", plan: "scale", seats: 34 },
	{ name: "Kestrel Air Charter", city: "Faro", plan: "growth", seats: 13 },
	{ name: "Driftwood Coworking", city: "Tallinn", plan: "starter", seats: 9 },
];

// 60 first names and 60 last names for the 60 contacts: each name occurs one time.
// No first name of an agent occurs here, so a reader never mixes a customer with an agent.
const FIRST_NAMES = [
	"Amelia",
	"Jonah",
	"Priya",
	"Mateo",
	"Hana",
	"Felix",
	"Zara",
	"Oliver",
	"Leah",
	"Tobias",
	"Nora",
	"Kenji",
	"Elif",
	"Gareth",
	"Sofia",
	"Dmitri",
	"Aisha",
	"Bruno",
	"Clara",
	"Malik",
	"Freya",
	"Hugo",
	"Ingrid",
	"Jamal",
	"Kira",
	"Lorenzo",
	"Maeve",
	"Nikhil",
	"Olga",
	"Pablo",
	"Quinn",
	"Rosa",
	"Samir",
	"Tessa",
	"Umar",
	"Vera",
	"Wren",
	"Yusuf",
	"Anya",
	"Bastian",
	"Celine",
	"Dario",
	"Esme",
	"Farid",
	"Greta",
	"Hector",
	"Isla",
	"Joaquin",
	"Katya",
	"Leon",
	"Mira",
	"Nils",
	"Odile",
	"Pietro",
	"Rania",
	"Stellan",
	"Talia",
	"Viktor",
	"Yara",
	"Zane",
];

const LAST_NAMES = [
	"Whitfield",
	"Okonkwo",
	"Raman",
	"Lindgren",
	"Castellanos",
	"Haddad",
	"Brennan",
	"Kowalski",
	"Nakamura",
	"Delacroix",
	"Ferreira",
	"Halloran",
	"Ivanova",
	"Jaramillo",
	"Kerrigan",
	"Laurent",
	"Mbeki",
	"Novak",
	"Ostrowski",
	"Pellegrini",
	"Quintero",
	"Rasmussen",
	"Sandoval",
	"Takeda",
	"Underhill",
	"Vasquez",
	"Wexler",
	"Yilmaz",
	"Zielinski",
	"Abernathy",
	"Bergstrom",
	"Carvalho",
	"Dunleavy",
	"Eriksen",
	"Fontaine",
	"Galloway",
	"Hartmann",
	"Iqbal",
	"Jovanovic",
	"Kaplan",
	"Lombardi",
	"Moreno",
	"Nkemelu",
	"Oyelaran",
	"Petrakis",
	"Rinaldi",
	"Sorensen",
	"Thorne",
	"Ulrich",
	"Valdez",
	"Winslow",
	"Achterberg",
	"Byrne",
	"Cormier",
	"Dahl",
	"Esposito",
	"Falk",
	"Gutierrez",
	"Holm",
	"Ishikawa",
];

const JOB_TITLES = [
	"Operations manager",
	"Office manager",
	"IT administrator",
	"Finance lead",
	"Founder",
	"Head of operations",
	"Practice manager",
	"Product owner",
	"Team lead",
	"Project coordinator",
];

/** One value and its weight for a weighted pick. */
type Weighted<Value> = { value: Value; weight: number };

const PRIORITY_WEIGHTS: Weighted<TicketPriority>[] = [
	{ value: "urgent", weight: 0.06 },
	{ value: "high", weight: 0.2 },
	{ value: "normal", weight: 0.52 },
	{ value: "low", weight: 0.22 },
];

const CHANNEL_WEIGHTS: Weighted<TicketChannel>[] = [
	{ value: "email", weight: 0.45 },
	{ value: "chat", weight: 0.3 },
	{ value: "web_form", weight: 0.17 },
	{ value: "phone", weight: 0.08 },
];

const TOPIC_WEIGHTS: Weighted<TicketTopic>[] = [
	{ value: "billing", weight: 0.19 },
	{ value: "access", weight: 0.18 },
	{ value: "integrations", weight: 0.16 },
	{ value: "bug", weight: 0.17 },
	{ value: "how_to", weight: 0.22 },
	{ value: "other", weight: 0.08 },
];

// New tickets on a normal day of each weekday, Sunday first. The desk is quiet at the weekend.
const WEEKDAY_TICKETS = [1.5, 8, 7.5, 7, 6.5, 6, 2];

// Two periods of 90 days: the longest period of a trend, and the one before it.
const HISTORY_DAYS = 180;

// Days after the solve day when the nightly job closes a solved ticket.
const CLOSE_AFTER_DAYS = 4;

// 2:00: the hour of the nightly job that closes solved tickets.
const CLOSE_JOB_HOUR = 2;

/** One open ticket of the backlog: created before today, still in the queue. */
type BacklogPlan = {
	status: "new" | "open" | "pending";
	priority: TicketPriority;
	topic: TicketTopic;
	channel: TicketChannel;
	/** Calendar days before today. */
	daysAgo: number;
	/** The local time of the creation, "HH:MM". */
	at: string;
};

// The open tickets from before today. Fixed, so the queue has a clear shape: a few late, most on time.
const BACKLOG: BacklogPlan[] = [
	{
		status: "new",
		priority: "normal",
		topic: "billing",
		channel: "email",
		daysAgo: 1,
		at: "22:25",
	},
	{
		status: "new",
		priority: "low",
		topic: "how_to",
		channel: "web_form",
		daysAgo: 1,
		at: "20:40",
	},
	{
		status: "new",
		priority: "normal",
		topic: "other",
		channel: "email",
		daysAgo: 1,
		at: "17:10",
	},
	{
		status: "open",
		priority: "high",
		topic: "integrations",
		channel: "chat",
		daysAgo: 1,
		at: "16:30",
	},
	{
		status: "open",
		priority: "urgent",
		topic: "bug",
		channel: "email",
		daysAgo: 1,
		at: "14:05",
	},
	{
		status: "open",
		priority: "normal",
		topic: "billing",
		channel: "email",
		daysAgo: 1,
		at: "11:20",
	},
	{
		status: "open",
		priority: "high",
		topic: "access",
		channel: "chat",
		daysAgo: 1,
		at: "09:15",
	},
	{
		status: "open",
		priority: "normal",
		topic: "bug",
		channel: "email",
		daysAgo: 1,
		at: "15:40",
	},
	{
		status: "open",
		priority: "normal",
		topic: "access",
		channel: "web_form",
		daysAgo: 1,
		at: "10:05",
	},
	{
		status: "open",
		priority: "low",
		topic: "how_to",
		channel: "email",
		daysAgo: 3,
		at: "13:30",
	},
	{
		status: "open",
		priority: "normal",
		topic: "integrations",
		channel: "email",
		daysAgo: 1,
		at: "08:50",
	},
	{
		status: "open",
		priority: "low",
		topic: "other",
		channel: "email",
		daysAgo: 3,
		at: "11:00",
	},
	{
		status: "pending",
		priority: "normal",
		topic: "billing",
		channel: "email",
		daysAgo: 1,
		at: "15:00",
	},
	{
		status: "pending",
		priority: "high",
		topic: "integrations",
		channel: "email",
		daysAgo: 2,
		at: "12:30",
	},
	{
		status: "pending",
		priority: "normal",
		topic: "how_to",
		channel: "chat",
		daysAgo: 2,
		at: "09:40",
	},
	{
		status: "pending",
		priority: "low",
		topic: "other",
		channel: "web_form",
		daysAgo: 3,
		at: "16:20",
	},
	{
		status: "pending",
		priority: "normal",
		topic: "access",
		channel: "email",
		daysAgo: 3,
		at: "10:10",
	},
	{
		status: "pending",
		priority: "normal",
		topic: "bug",
		channel: "email",
		daysAgo: 4,
		at: "14:45",
	},
	{
		status: "pending",
		priority: "low",
		topic: "billing",
		channel: "email",
		daysAgo: 5,
		at: "09:30",
	},
	{
		status: "pending",
		priority: "normal",
		topic: "integrations",
		channel: "email",
		daysAgo: 6,
		at: "11:15",
	},
];

/** One ticket of today. It exists once its time passes; its status follows the clock. */
type ArrivalPlan = {
	priority: TicketPriority;
	topic: TicketTopic;
	channel: TicketChannel;
	/** The local time of the creation, "HH:MM". */
	at: string;
	/** Minutes from the creation to the first reply. null: nobody replied yet. */
	replyAfter: number | null;
	/** Minutes from the creation to the solve. null: the ticket stays open today. */
	solveAfter: number | null;
};

// Today's tickets, in the order of their time. Before 08:05 the queue holds only the backlog.
const ARRIVALS: ArrivalPlan[] = [
	{
		priority: "normal",
		topic: "how_to",
		channel: "chat",
		at: "08:05",
		replyAfter: 20,
		solveAfter: 55,
	},
	{
		priority: "high",
		topic: "billing",
		channel: "email",
		at: "08:40",
		replyAfter: 35,
		solveAfter: null,
	},
	{
		priority: "normal",
		topic: "access",
		channel: "web_form",
		at: "09:10",
		replyAfter: 50,
		solveAfter: 180,
	},
	{
		priority: "urgent",
		topic: "integrations",
		channel: "phone",
		at: "09:55",
		replyAfter: 12,
		solveAfter: null,
	},
	{
		priority: "normal",
		topic: "bug",
		channel: "email",
		at: "10:30",
		replyAfter: 95,
		solveAfter: null,
	},
	{
		priority: "low",
		topic: "other",
		channel: "email",
		at: "11:20",
		replyAfter: null,
		solveAfter: null,
	},
	{
		priority: "normal",
		topic: "how_to",
		channel: "chat",
		at: "12:10",
		replyAfter: 8,
		solveAfter: 40,
	},
	{
		priority: "high",
		topic: "access",
		channel: "chat",
		at: "13:25",
		replyAfter: 15,
		solveAfter: null,
	},
	{
		priority: "normal",
		topic: "billing",
		channel: "email",
		at: "14:30",
		replyAfter: null,
		solveAfter: null,
	},
	{
		priority: "urgent",
		topic: "bug",
		channel: "web_form",
		at: "15:15",
		replyAfter: 25,
		solveAfter: null,
	},
	{
		priority: "normal",
		topic: "integrations",
		channel: "email",
		at: "16:05",
		replyAfter: null,
		solveAfter: null,
	},
	{
		priority: "low",
		topic: "how_to",
		channel: "web_form",
		at: "16:50",
		replyAfter: null,
		solveAfter: null,
	},
	{
		priority: "normal",
		topic: "other",
		channel: "email",
		at: "17:40",
		replyAfter: null,
		solveAfter: null,
	},
];

// A fixed seed gives the same rows for the whole day, so the numbers do not jump between loads.
const SEED = 7_331;

// The number of the oldest ticket. Numbers grow with the creation time.
const FIRST_TICKET_NUMBER = 3_100;

// mulberry32: a small generator with a 32-bit state. It returns a number from 0 to 1, 1 not included.
function createRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

// The item at `index`, counted in a circle. Every list of this file has items, so an empty list is a code error.
function cycle<Item>(items: readonly Item[], index: number): Item {
	const item = items[index % items.length];
	if (item === undefined) {
		throw new Error("sample-data: the list is empty");
	}
	return item;
}

// "Orchard & Vine Catering" gives "orchard": the mail domain of the company.
function slugOf(companyName: string): string {
	return (companyName.split(" ")[0] ?? "").toLowerCase();
}

// "14:05" gives 845: minutes after midnight.
function minutesOf(time: string): number {
	const [hours = "0", minutes = "0"] = time.split(":");
	return Number(hours) * 60 + Number(minutes);
}

/** A ticket before it gets its number. `exists` is false for a ticket of today whose time did not pass yet. */
type TicketDraft = Omit<TicketRow, "id" | "subject" | "articleId"> & {
	script: TicketScript;
	isBacklog: boolean;
};

function buildSampleTables(now: number): SampleTables {
	const random = createRandom(SEED);
	const between = (min: number, max: number) =>
		min + Math.floor(random() * (max - min + 1));
	const pickWeighted = <Value>(options: readonly Weighted<Value>[]): Value => {
		const total = options.reduce((sum, option) => sum + option.weight, 0);
		let roll = random() * total;
		for (const option of options) {
			roll -= option.weight;
			if (roll < 0) {
				return option.value;
			}
		}
		return cycle(options, options.length - 1).value;
	};
	const iso = (ms: number) => new Date(ms).toISOString();
	// Every time counts from the start of today, not from `now`. So each load of one day builds the same rows.
	const today = startOfLocalDay(now);

	const customers: CustomerRow[] = CUSTOMERS.map((customer, index) => ({
		id: `cus-${String(index + 1).padStart(2, "0")}`,
		...customer,
		customerSince: iso(today - between(90, 1_400) * DAY_MS),
	}));

	const contacts: ContactRow[] = [];
	customers.forEach((customer, customerIndex) => {
		// One person at one company, two at the next: 60 contacts for 40 companies.
		const peopleCount = 1 + (customerIndex % 2);
		for (let person = 0; person < peopleCount; person += 1) {
			const index = contacts.length;
			// The steps 7 and 11 share no factor with 60, so the 60 contacts use each name one time, in a mixed order.
			const firstName = cycle(FIRST_NAMES, index * 7);
			const lastName = cycle(LAST_NAMES, index * 11 + 3);
			contacts.push({
				id: `con-${String(index + 1).padStart(3, "0")}`,
				customerId: customer.id,
				name: `${firstName} ${lastName}`,
				title: cycle(JOB_TITLES, index * 3 + person),
				// .example is a reserved domain: no real person has these addresses.
				email:
					`${firstName}.${lastName}@${slugOf(customer.name)}.example`.toLowerCase(),
			});
		}
	});

	// Larger companies write more often. The square root keeps the small ones in the list.
	const customerWeights: Weighted<CustomerRow>[] = customers.map(
		(customer) => ({ value: customer, weight: Math.sqrt(customer.seats) }),
	);
	const agentWeights: Weighted<AgentRow>[] = AGENTS.map((agent, index) => ({
		value: agent,
		weight: cycle(AGENT_WEIGHTS, index),
	}));
	const requesterOf = (customer: CustomerRow) =>
		cycle(
			contacts.filter((contact) => contact.customerId === customer.id),
			between(0, 1),
		);

	const drafts: TicketDraft[] = [];

	// History: tickets created on the 180 days before today. All of them are solved, or closed after the solve.
	for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
		const dayStart = today - daysAgo * DAY_MS;
		const weekday = new Date(dayStart).getDay();
		// The customer base grows, so the oldest days get about 20 % fewer tickets than the last days.
		const trend = 0.82 + 0.22 * (1 - daysAgo / HISTORY_DAYS);
		const count = Math.round(
			cycle(WEEKDAY_TICKETS, weekday) * trend * (0.7 + random() * 0.6),
		);
		const isWeekend = weekday === 0 || weekday === 6;
		for (let index = 0; index < count; index += 1) {
			// Office hours: 7:30 to 18:30 on weekdays, 9:00 to 16:00 at the weekend.
			const created =
				dayStart +
				(isWeekend ? between(540, 960) : between(450, 1_110)) * MINUTE_MS;
			const priority = pickWeighted(PRIORITY_WEIGHTS);
			const topic = pickWeighted(TOPIC_WEIGHTS);
			const customer = pickWeighted(customerWeights);
			// About 9 tickets in 10 meet the resolution target: the factor stays under 1 most of the time.
			let solveMinutes =
				RESOLUTION_TARGET_MINUTES[priority] * (0.08 + random() ** 1.7 * 1.05);
			// A ticket of yesterday is solved before midnight: no solve time sits in the future.
			const latestSolve = today - 15 * MINUTE_MS;
			if (created + solveMinutes * MINUTE_MS > latestSolve) {
				solveMinutes =
					((latestSolve - created) / MINUTE_MS) * (0.4 + random() * 0.5);
			}
			const replyMinutes = Math.min(
				FIRST_REPLY_TARGET_MINUTES[priority] * (0.05 + random() ** 1.5 * 1.1),
				solveMinutes * 0.5,
			);
			const solved = created + solveMinutes * MINUTE_MS;
			// The nightly job closes a solved ticket at 2:00, CLOSE_AFTER_DAYS days after the solve day.
			const closedAt =
				startOfLocalDay(solved) +
				(CLOSE_AFTER_DAYS + 1) * DAY_MS +
				CLOSE_JOB_HOUR * HOUR_MS;
			const isRated = random() < 0.42;
			const isGood = random() < 0.91;
			drafts.push({
				customerId: customer.id,
				requesterId: requesterOf(customer).id,
				assigneeId: pickWeighted(agentWeights).id,
				status: closedAt <= today ? "closed" : "solved",
				priority,
				channel: pickWeighted(CHANNEL_WEIGHTS),
				topic,
				script: cycle(TICKET_SCRIPTS[topic], between(0, 5)),
				createdAt: iso(created),
				firstReplyAt: iso(created + replyMinutes * MINUTE_MS),
				solvedAt: iso(solved),
				rating: isRated ? (isGood ? "good" : "bad") : null,
				isBacklog: false,
			});
		}
	}

	// The open tickets use each script of a topic at most one time, so the queue shows no twin subjects.
	const scriptCursor = new Map<TicketTopic, number>();
	const nextScript = (topic: TicketTopic) => {
		const index = scriptCursor.get(topic) ?? 0;
		scriptCursor.set(topic, index + 1);
		return cycle(TICKET_SCRIPTS[topic], index);
	};
	// The lead (agent-1) takes no open ticket: the five other agents share them in turn, by plan position.
	const agentOfPlan = (position: number) =>
		cycle(AGENTS, 1 + (position % 5)).id;

	for (const [position, plan] of BACKLOG.entries()) {
		const customer = pickWeighted(customerWeights);
		const created =
			today - plan.daysAgo * DAY_MS + minutesOf(plan.at) * MINUTE_MS;
		const replyMinutes =
			plan.status === "new"
				? null
				: FIRST_REPLY_TARGET_MINUTES[plan.priority] * (0.15 + random() * 0.6);
		drafts.push({
			customerId: customer.id,
			requesterId: requesterOf(customer).id,
			assigneeId: plan.status === "new" ? null : agentOfPlan(position),
			status: plan.status,
			priority: plan.priority,
			channel: plan.channel,
			topic: plan.topic,
			script: nextScript(plan.topic),
			createdAt: iso(created),
			firstReplyAt:
				replyMinutes === null ? null : iso(created + replyMinutes * MINUTE_MS),
			solvedAt: null,
			rating: null,
			isBacklog: true,
		});
	}

	for (const [position, plan] of ARRIVALS.entries()) {
		const customer = pickWeighted(customerWeights);
		const created = today + minutesOf(plan.at) * MINUTE_MS;
		const replied =
			plan.replyAfter === null ? null : created + plan.replyAfter * MINUTE_MS;
		const solved =
			plan.solveAfter === null ? null : created + plan.solveAfter * MINUTE_MS;
		// The status follows the clock: a reply or a solve counts only once its time passed.
		const hasReply = replied !== null && replied <= now;
		const isSolved = solved !== null && solved <= now;
		const isRatedGood = random() < 0.5;
		drafts.push({
			customerId: customer.id,
			requesterId: requesterOf(customer).id,
			assigneeId: hasReply ? agentOfPlan(BACKLOG.length + position) : null,
			status: isSolved ? "solved" : hasReply ? "open" : "new",
			priority: plan.priority,
			channel: plan.channel,
			topic: plan.topic,
			script: nextScript(plan.topic),
			createdAt: iso(created),
			firstReplyAt: hasReply ? iso(replied) : null,
			solvedAt: isSolved ? iso(solved) : null,
			rating: isSolved && isRatedGood ? "good" : null,
			isBacklog: false,
		});
	}

	// Numbers follow the creation time. Today's later tickets get their numbers now, so no number moves.
	drafts.sort(
		(first, second) =>
			Date.parse(first.createdAt) - Date.parse(second.createdAt),
	);
	const numbered = drafts.map((draft, index) => ({
		...draft,
		id: String(FIRST_TICKET_NUMBER + index),
	}));
	const existing = numbered.filter(
		(draft) => Date.parse(draft.createdAt) <= now,
	);

	const articles: ArticleRow[] = ARTICLE_TEXTS.map((article, index) => {
		const views = article.isDraft ? 0 : between(60, 940);
		// About 1 reader in 12 answers "Was this helpful?". Most answers are yes.
		const votes = Math.round(views / 12);
		const helpfulYes = Math.round(votes * (0.62 + random() * 0.34));
		// The earlier period comes from the index, not from the generator, so the ticket rows stay the same.
		// It gives 78 % to 110 % of the current views, so the help center grows a little.
		const viewsBefore = Math.round(views * (0.78 + (index % 5) * 0.08));
		const votesBefore = Math.round(viewsBefore / 12);
		const helpfulYesBefore = Math.round(
			votesBefore * (0.6 + (index % 7) * 0.05),
		);
		return {
			...article,
			authorId: cycle(AGENTS, index * 5 + 1).id,
			updatedAt: iso(
				today - between(2, 140) * DAY_MS + between(9, 17) * HOUR_MS,
			),
			views30d: views,
			helpfulYes,
			helpfulNo: votes - helpfulYes,
			viewsBefore30d: viewsBefore,
			helpfulYesBefore,
			helpfulNoBefore: votesBefore - helpfulYesBefore,
		};
	});

	const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
	const agentById = new Map(AGENTS.map((agent) => [agent.id, agent]));
	const tickets: TicketRow[] = [];
	const messages: MessageRow[] = [];
	const events: TicketEventRow[] = [];

	for (const draft of existing) {
		const { script, isBacklog, ...row } = draft;
		tickets.push({
			...row,
			subject: cycle(script.subjects, Number(draft.id)),
			// Only the first reply links an article, so a new ticket has none.
			articleId: draft.firstReplyAt ? script.articleId : null,
		});
		const requester = contactById.get(draft.requesterId);
		const agent = draft.assigneeId
			? agentById.get(draft.assigneeId)
			: undefined;
		const firstName = requester?.name.split(" ")[0] ?? "";
		const fill = (text: string) => text.replaceAll("{first}", firstName);
		const created = Date.parse(draft.createdAt);
		let count = 0;
		const addMessage = (kind: MessageRow["kind"], body: string, at: number) => {
			count += 1;
			messages.push({
				id: `${draft.id}-m${count}`,
				ticketId: draft.id,
				kind,
				authorName:
					kind === "customer" ? (requester?.name ?? "") : (agent?.name ?? ""),
				body: fill(body),
				sentAt: iso(at),
			});
		};
		const addEvent = (
			type: TicketEventRow["type"],
			at: number,
			agentId: string | null,
		) => {
			events.push({
				id: `${draft.id}-e${events.length + 1}`,
				ticketId: draft.id,
				type,
				agentId,
				occurredAt: iso(at),
			});
		};

		addMessage("customer", script.opening, created);
		if (!draft.firstReplyAt || !agent) {
			continue;
		}
		const replied = Date.parse(draft.firstReplyAt);
		// The agent takes the ticket a few minutes before the first reply.
		addEvent("assigned", created + (replied - created) * 0.4, agent.id);
		addMessage("agent", script.reply, replied);

		if (draft.status === "pending") {
			addEvent("pending", replied + MINUTE_MS, agent.id);
			continue;
		}
		if (draft.status === "open") {
			// The customer answers the reply: the ticket waits for the agent again.
			// The delay comes from the ticket number, not from the generator: today's tickets change the count of draws.
			// A backlog ticket answers before today. A ticket of today answers 20 to 80 minutes after the reply.
			const followUp = isBacklog
				? replied + (today - replied) * (0.3 + (Number(draft.id) % 7) / 20)
				: replied + (20 + (Number(draft.id) % 7) * 10) * MINUTE_MS;
			// A follow-up of today exists only once its time passes, so it never moves with the clock.
			if (followUp > now) {
				continue;
			}
			addMessage("customer", script.followUp, followUp);
			// Urgent and high tickets of the backlog get a note: the agent explains the case to the team.
			if (
				isBacklog &&
				(draft.priority === "urgent" || draft.priority === "high")
			) {
				addMessage("note", script.note, followUp + (today - followUp) * 0.5);
			}
			continue;
		}
		const solved = Date.parse(draft.solvedAt ?? draft.firstReplyAt);
		addMessage(
			"customer",
			script.followUp,
			replied + (solved - replied) * 0.45,
		);
		addMessage("note", script.note, replied + (solved - replied) * 0.7);
		addMessage("agent", script.closing, solved);
		addEvent("solved", solved + MINUTE_MS, agent.id);
		if (draft.status === "closed") {
			addEvent(
				"closed",
				startOfLocalDay(solved) +
					(CLOSE_AFTER_DAYS + 1) * DAY_MS +
					CLOSE_JOB_HOUR * HOUR_MS,
				null,
			);
		}
	}

	return {
		agents: AGENTS,
		customers,
		contacts,
		tickets,
		messages,
		events,
		articles,
	};
}

// The tables of the current minute. A new minute can add a ticket of today, so the cache follows the minute.
let cached: { minute: number; tables: SampleTables } | null = null;

/** The sample tables at the current time. Every query file reads its rows from here. */
export function getSampleTables(): SampleTables {
	const now = Date.now();
	const minute = Math.floor(now / MINUTE_MS);
	if (cached?.minute !== minute) {
		cached = { minute, tables: buildSampleTables(now) };
	}
	return cached.tables;
}
