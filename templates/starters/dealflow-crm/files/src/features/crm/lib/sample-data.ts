// The sample tables of the CRM: reps, companies, contacts, deals, stage changes, activities, and tasks.
// Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every date is relative to the current day. A seeded generator makes the same rows for the whole day.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import { ACTIVITY_TYPES, type ActivityType } from "./activity-type";
import {
	DEAL_SOURCES,
	type DealSource,
	type DealStage,
	LOST_REASONS,
	type LostReason,
	OPEN_STAGES,
} from "./deal-stage";
import { DAY_MS, HOUR_MS, MINUTE_MS, startOfLocalDay } from "./relative-time";
import type { TaskPriority } from "./task";

/** One sales rep of the team. A rep owns deals, logs activities, and gets tasks. */
export type RepRow = { id: string; name: string };

/** One customer company. */
export type CompanyRow = {
	id: string;
	name: string;
	/** Free text, for example "Logistics". */
	industry: string;
	city: string;
	/** Head count of the company. */
	employees: number;
};

/** One person at a company. */
export type ContactRow = {
	id: string;
	companyId: string;
	name: string;
	/** The job title, for example "Operations Director". */
	title: string;
	email: string;
	phone: string;
};

/** One deal. The times are ISO texts. */
export type DealRow = {
	id: string;
	/** What the customer buys, for example "Multi-site rollout". */
	name: string;
	companyId: string;
	/** The main contact of the deal. A person of `companyId`. */
	contactId: string;
	/** The rep that owns the deal. */
	ownerId: string;
	stage: DealStage;
	/** Whole units of CURRENCY (lib/format.ts). */
	amount: number;
	source: DealSource;
	createdAt: string;
	/** When the deal entered its current stage. The board computes the age in the stage from it. */
	stageChangedAt: string;
	/** The day the rep expects to close. A past day on an open deal needs attention. */
	expectedCloseAt: string;
	/** When the deal was won or lost. null while it is open. */
	closedAt: string | null;
	/** Set only on a lost deal. */
	lostReason: LostReason | null;
};

/** One move of a deal into a stage. The stage path of the detail page reads these rows. */
export type StageChangeRow = {
	dealId: string;
	stage: DealStage;
	changedAt: string;
};

/** One logged call, email, meeting, or note. The activity charts count these rows per day. */
export type ActivityRow = {
	id: string;
	/** The person that the rep spoke or wrote to. */
	contactId: string;
	/** null for prospecting work before a deal exists. */
	dealId: string | null;
	/** The rep that logged it. */
	repId: string;
	type: ActivityType;
	subject: string;
	/** One or two sentences of the rep. */
	note: string;
	occurredAt: string;
};

/** One open follow-up task of a deal. */
export type TaskRow = {
	id: string;
	dealId: string;
	assigneeId: string;
	title: string;
	dueAt: string;
	/** How urgent the task is for the deal. The follow-up lists show it as a badge. */
	priority: TaskPriority;
};

/** Every sample table. Each list is in creation order; the query files sort and join them. */
export type SampleTables = {
	reps: RepRow[];
	companies: CompanyRow[];
	contacts: ContactRow[];
	deals: DealRow[];
	stageChanges: StageChangeRow[];
	activities: ActivityRow[];
	tasks: TaskRow[];
};

const REPS: RepRow[] = [
	{ id: "rep-1", name: "Amara Lindqvist" },
	{ id: "rep-2", name: "Jonas Petrov" },
	{ id: "rep-3", name: "Leila Haddad" },
	{ id: "rep-4", name: "Marcus Bell" },
	{ id: "rep-5", name: "Sofia Marin" },
];

const COMPANIES: Omit<CompanyRow, "id">[] = [
	{
		name: "Alderbrook Logistics",
		industry: "Logistics",
		city: "Portland",
		employees: 420,
	},
	{
		name: "Brightwater Dental Group",
		industry: "Healthcare",
		city: "Denver",
		employees: 180,
	},
	{
		name: "Cinderpeak Outfitters",
		industry: "Retail",
		city: "Boise",
		employees: 95,
	},
	{
		name: "Dunmore & Hale Architects",
		industry: "Architecture",
		city: "Chicago",
		employees: 60,
	},
	{
		name: "Elmfield Veterinary",
		industry: "Healthcare",
		city: "Austin",
		employees: 140,
	},
	{
		name: "Fernhollow Foods",
		industry: "Food production",
		city: "Madison",
		employees: 310,
	},
	{
		name: "Greyharbor Marine",
		industry: "Manufacturing",
		city: "Seattle",
		employees: 520,
	},
	{
		name: "Highmeadow Schools",
		industry: "Education",
		city: "Columbus",
		employees: 760,
	},
	{
		name: "Ironbridge Fabrication",
		industry: "Manufacturing",
		city: "Pittsburgh",
		employees: 280,
	},
	{
		name: "Juniper Lane Hotels",
		industry: "Hospitality",
		city: "Savannah",
		employees: 640,
	},
	{
		name: "Kestrel Ridge Energy",
		industry: "Energy",
		city: "Tulsa",
		employees: 350,
	},
	{
		name: "Larkspur Insurance Partners",
		industry: "Insurance",
		city: "Hartford",
		employees: 210,
	},
	{
		name: "Marrowstone Brewing",
		industry: "Food production",
		city: "Asheville",
		employees: 75,
	},
	{
		name: "Nettlebank Credit Union",
		industry: "Finance",
		city: "Omaha",
		employees: 160,
	},
	{
		name: "Oakhaven Property Group",
		industry: "Real estate",
		city: "Charlotte",
		employees: 130,
	},
	{
		name: "Pinecrest Robotics",
		industry: "Technology",
		city: "San Jose",
		employees: 240,
	},
	{
		name: "Quillfeather Publishing",
		industry: "Media",
		city: "Boston",
		employees: 85,
	},
	{
		name: "Redfern Mobility",
		industry: "Transport",
		city: "Minneapolis",
		employees: 390,
	},
	{
		name: "Saltmarsh Analytics",
		industry: "Technology",
		city: "Raleigh",
		employees: 110,
	},
	{
		name: "Thornbury Legal",
		industry: "Legal",
		city: "Philadelphia",
		employees: 70,
	},
	{
		name: "Umberfield Textiles",
		industry: "Manufacturing",
		city: "Greenville",
		employees: 450,
	},
	{
		name: "Valewood Clinics",
		industry: "Healthcare",
		city: "Phoenix",
		employees: 330,
	},
	{
		name: "Westmere Construction",
		industry: "Construction",
		city: "Nashville",
		employees: 570,
	},
	{
		name: "Yarrowgate Travel",
		industry: "Travel",
		city: "Orlando",
		employees: 120,
	},
];

// 60 first names and 60 last names for the 60 contacts: each name occurs one time.
const FIRST_NAMES = [
	"Maya",
	"Daniel",
	"Priya",
	"Tomas",
	"Hannah",
	"Omar",
	"Elena",
	"Victor",
	"Nadia",
	"Samuel",
	"Ingrid",
	"Rafael",
	"Chloe",
	"Kwame",
	"Astrid",
	"Mateo",
	"Yuki",
	"Gabriel",
	"Farah",
	"Lucas",
	"Zofia",
	"Andre",
	"Mina",
	"Oscar",
	"Tessa",
	"Idris",
	"Clara",
	"Hugo",
	"Leona",
	"Emil",
	"Naomi",
	"Ravi",
	"Sienna",
	"Kofi",
	"Beatriz",
	"Dmitri",
	"Aiko",
	"Nolan",
	"Imani",
	"Stefan",
	"Camille",
	"Tariq",
	"Freya",
	"Javier",
	"Anika",
	"Callum",
	"Rosa",
	"Henrik",
	"Mei",
	"Dario",
	"Selma",
	"Wendell",
	"Noor",
	"Elias",
	"Thandi",
	"Pablo",
	"Greta",
	"Malik",
	"Vera",
	"Quentin",
];

const LAST_NAMES = [
	"Okafor",
	"Reyes",
	"Nakamura",
	"Fitzgerald",
	"Kowalski",
	"Delgado",
	"Brennan",
	"Sorensen",
	"Mbeki",
	"Castellano",
	"Whitlock",
	"Vasquez",
	"Hartmann",
	"Achebe",
	"Lindgren",
	"Moreau",
	"Tanaka",
	"Driscoll",
	"Petrakis",
	"Osei",
	"Calloway",
	"Novak",
	"Ferreira",
	"Haldane",
	"Rasmussen",
	"Bianchi",
	"Thackeray",
	"Zielinski",
	"Marchetti",
	"Abernathy",
	"Adeyemi",
	"Bergstrom",
	"Chaudhry",
	"Dubois",
	"Eriksen",
	"Fontaine",
	"Gallagher",
	"Ivanova",
	"Jimenez",
	"Kaplan",
	"Lachance",
	"Mwangi",
	"Nilsson",
	"Oyelaran",
	"Pereira",
	"Quigley",
	"Rahimi",
	"Santoro",
	"Thibault",
	"Ueda",
	"Varga",
	"Winslow",
	"Yilmaz",
	"Zamora",
	"Ashworth",
	"Barros",
	"Corrigan",
	"Demir",
	"Engel",
	"Farrow",
];

const JOB_TITLES = [
	"Operations Director",
	"Head of Procurement",
	"IT Manager",
	"Chief Financial Officer",
	"Managing Director",
	"Head of Customer Service",
	"Finance Manager",
	"Chief Operating Officer",
	"Project Lead",
	"Purchasing Manager",
	"Head of Digital",
	"General Manager",
];

/** What a customer buys, and the price band of that offer. */
type Offer = {
	name: string;
	/** The lowest and the highest amount of a deal for this offer, in thousands of CURRENCY. */
	minThousands: number;
	maxThousands: number;
	/** The smallest head count of a company that buys this offer. No value: every company. */
	minEmployees?: number;
	/** The `industry` values of the companies that buy this offer. No value: every industry. */
	industries?: readonly string[];
};

const OFFERS: Offer[] = [
	{ name: "Annual platform license", minThousands: 24, maxThousands: 60 },
	{ name: "Team plan, 25 seats", minThousands: 9, maxThousands: 15 },
	{
		name: "Team plan, 60 seats",
		minThousands: 20,
		maxThousands: 32,
		minEmployees: 100,
	},
	{
		name: "Enterprise plan, 150 seats",
		minThousands: 70,
		maxThousands: 110,
		minEmployees: 300,
	},
	{ name: "Onboarding and training", minThousands: 6, maxThousands: 14 },
	{
		name: "Multi-site rollout",
		minThousands: 55,
		maxThousands: 105,
		minEmployees: 300,
	},
	{ name: "Support contract renewal", minThousands: 10, maxThousands: 24 },
	{ name: "Pilot program", minThousands: 6, maxThousands: 12 },
	{ name: "Data migration project", minThousands: 15, maxThousands: 40 },
	{ name: "Custom integration", minThousands: 20, maxThousands: 55 },
	{ name: "Analytics add-on", minThousands: 8, maxThousands: 20 },
	{ name: "Premium support upgrade", minThousands: 9, maxThousands: 22 },
	{ name: "Field app licenses", minThousands: 14, maxThousands: 38 },
	{ name: "Reporting package", minThousands: 8, maxThousands: 18 },
	{ name: "Single sign-on setup", minThousands: 6, maxThousands: 12 },
	{
		name: "Regional expansion",
		minThousands: 60,
		maxThousands: 110,
		minEmployees: 300,
	},
	{ name: "Workflow automation", minThousands: 18, maxThousands: 46 },
	{ name: "API access tier", minThousands: 10, maxThousands: 26 },
	{
		name: "Three-year renewal",
		minThousands: 65,
		maxThousands: 108,
		minEmployees: 200,
	},
	{
		name: "Warehouse module",
		minThousands: 28,
		maxThousands: 64,
		industries: [
			"Logistics",
			"Retail",
			"Manufacturing",
			"Food production",
			"Transport",
			"Construction",
		],
	},
	{ name: "Customer portal", minThousands: 22, maxThousands: 52 },
	{ name: "Compliance pack", minThousands: 12, maxThousands: 30 },
	{ name: "Mobile add-on", minThousands: 7, maxThousands: 16 },
	{ name: "Advanced permissions", minThousands: 6, maxThousands: 13 },
];

/** The part of the sales work that a text fits: before the proposal, from the proposal on, or both. */
type SalesPhase = "early" | "late";

/** A subject and the note that goes with it. */
type ActivityText = {
	subject: string;
	note: string;
	/** "any" fits each stage. "early" fits lead and qualified. "late" fits proposal and negotiation. */
	phase: SalesPhase | "any";
};

// Each type has 3 texts or more for each phase, so a deal can vary its subjects.
const ACTIVITY_TEXTS: Record<ActivityType, ActivityText[]> = {
	call: [
		{
			subject: "Discovery call",
			note: "Walked through the current process. Two teams still work from spreadsheets.",
			phase: "early",
		},
		{
			subject: "Intro call",
			note: "Short first call. They compare three vendors this quarter.",
			phase: "early",
		},
		{
			subject: "Qualification call",
			note: "Checked the budget, the timeline, and who signs. All three are clear.",
			phase: "early",
		},
		{
			subject: "Follow-up call",
			note: "Left a voicemail, then sent a short email with two time slots.",
			phase: "any",
		},
		{
			subject: "Check-in call",
			note: "Good call. They want a short recap in writing before the next step.",
			phase: "any",
		},
		{
			subject: "Pricing call",
			note: "Procurement asks for a multi-year discount. I will send two options.",
			phase: "late",
		},
		{
			subject: "Call with procurement",
			note: "They need our supplier form and a signed data agreement first.",
			phase: "late",
		},
	],
	email: [
		{
			subject: "Sent the product overview",
			note: "Sent the overview and the questions for the first workshop.",
			phase: "early",
		},
		{
			subject: "Shared a case study",
			note: "Sent the case study of a customer in the same industry.",
			phase: "early",
		},
		{
			subject: "Meeting recap",
			note: "Recap sent with the open points and the owners.",
			phase: "any",
		},
		{
			subject: "Sent the workshop agenda",
			note: "Agenda sent for the process workshop, with the list of people to invite.",
			phase: "early",
		},
		{
			subject: "Introduced the solution engineer",
			note: "Introduced our solution engineer for the technical questions.",
			phase: "early",
		},
		{
			subject: "Answered security questions",
			note: "Sent the answers to the security questionnaire.",
			phase: "late",
		},
		{
			subject: "Sent the proposal",
			note: "Proposal sent with two pricing options and the rollout plan.",
			phase: "late",
		},
		{
			subject: "Sent pricing details",
			note: "Shared the price per seat and the volume steps.",
			phase: "late",
		},
		{
			subject: "Follow-up email",
			note: "Asked for feedback on the proposal. No answer yet.",
			phase: "late",
		},
		{
			subject: "Sent the contract draft",
			note: "Contract draft sent to their legal team for review.",
			phase: "late",
		},
	],
	meeting: [
		{
			subject: "Product walkthrough",
			note: "Walkthrough for six people. The reporting module got the most questions.",
			phase: "early",
		},
		{
			subject: "On-site visit",
			note: "Visited the main site. The floor team wants the mobile app first.",
			phase: "early",
		},
		{
			subject: "Stakeholder workshop",
			note: "Mapped the current process with the team leads.",
			phase: "early",
		},
		{
			subject: "Technical deep dive",
			note: "Their IT team checked the integration points. No blocker.",
			phase: "any",
		},
		{
			subject: "Pricing review",
			note: "Went through the two pricing options with finance. They prefer the annual plan.",
			phase: "late",
		},
		{
			subject: "Contract review",
			note: "Reviewed the terms with their legal team. One clause is still open.",
			phase: "late",
		},
		{
			subject: "Kickoff planning",
			note: "Agreed on a phased start with one site in the first month.",
			phase: "late",
		},
	],
	note: [
		{
			subject: "Decision maker identified",
			note: "The finance director signs. Our contact prepares the case.",
			phase: "early",
		},
		{
			subject: "Current tools mapped",
			note: "They use two tools and a shared spreadsheet. The contract of one tool ends this year.",
			phase: "early",
		},
		{
			subject: "Budget confirmed",
			note: "The budget is approved for this quarter.",
			phase: "any",
		},
		{
			subject: "Competitor mentioned",
			note: "A competitor offer is on the table. Price is the main point.",
			phase: "any",
		},
		{
			subject: "Timeline moved",
			note: "The start moves by two weeks because of an internal audit.",
			phase: "any",
		},
		{
			subject: "Champion changed role",
			note: "Our main contact moves to another team. A new contact joins the next call.",
			phase: "any",
		},
		{
			subject: "Legal review started",
			note: "Their legal team started the review. They expect one week.",
			phase: "late",
		},
	],
};

// The follow-up tasks of a deal before its proposal, and from its proposal on.
const TASK_TITLES: Record<SalesPhase, string[]> = {
	early: [
		"Book the product walkthrough",
		"Call the decision maker",
		"Share a customer reference",
		"Send the meeting recap",
		"Schedule the discovery workshop",
		"Send the product overview",
		"Confirm the budget owner",
	],
	late: [
		"Send the revised quote",
		"Follow up on the proposal",
		"Send the contract draft",
		"Confirm the security review",
		"Prepare the pricing options",
		"Schedule the kickoff call",
		"Check the procurement status",
		"Confirm the start date",
	],
};

// Activities on a normal day of each weekday, Sunday first. The team is closed at the weekend.
const WEEKDAY_ACTIVITIES = [1, 11, 14, 13, 12, 8, 1];

// The days of activity history. Two periods of 90 days: the longest period of a trend, and the one before it.
const HISTORY_DAYS = 180;

// The most activities of one deal. In the oldest months few deals are open, and they would get every activity.
const MAX_DEAL_ACTIVITIES = 24;

// A deal does not repeat one of its last 6 subjects. Each type has fewer texts, so a timeline stays varied.
const SUBJECT_MEMORY = 6;

/** How many deals sit in a stage, and how long ago they got there. */
type DealPlan = {
	stage: DealStage;
	count: number;
	/** Calendar days since the deal entered the stage, or since it closed: the lowest and the highest value. */
	minDays: number;
	maxDays: number;
};

// 34 open deals, then the won and the lost deals of three windows of 30 days.
// The team wins about one closed deal in two. No deal changes stage today: its time could be in the future.
// The won counts differ per window, so the average deal of the home also changes between periods.
const DEAL_PLANS: DealPlan[] = [
	{ stage: "lead", count: 11, minDays: 1, maxDays: 15 },
	{ stage: "qualified", count: 9, minDays: 1, maxDays: 17 },
	{ stage: "proposal", count: 8, minDays: 2, maxDays: 18 },
	{ stage: "negotiation", count: 6, minDays: 1, maxDays: 15 },
	{ stage: "won", count: 11, minDays: 1, maxDays: 28 },
	{ stage: "won", count: 8, minDays: 31, maxDays: 58 },
	{ stage: "won", count: 6, minDays: 61, maxDays: 88 },
	{ stage: "lost", count: 10, minDays: 2, maxDays: 28 },
	{ stage: "lost", count: 9, minDays: 31, maxDays: 58 },
	{ stage: "lost", count: 7, minDays: 61, maxDays: 88 },
];

// Days from today to the expected close of an open deal, per stage: the lowest and the highest value.
// A negative value is a close date in the past.
const CLOSE_IN_DAYS = {
	lead: [14, 75],
	qualified: [7, 60],
	proposal: [-5, 40],
	negotiation: [-4, 21],
} as const;

// A fixed seed gives the same rows for the whole day, so the numbers do not jump between loads.
const SEED = 4_207;

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

// "Alderbrook Logistics" gives "alderbrook": the mail domain of the company.
function slugOf(companyName: string): string {
	return (companyName.split(" ")[0] ?? "").toLowerCase();
}

function buildSampleTables(now: number): SampleTables {
	const random = createRandom(SEED);
	const between = (min: number, max: number) =>
		min + Math.floor(random() * (max - min + 1));
	const pick = <Item>(items: readonly Item[]) =>
		cycle(items, Math.floor(random() * items.length));
	const iso = (ms: number) => new Date(ms).toISOString();
	// Every time counts from the start of today, not from `now`. So each load of one day builds the same rows.
	const today = startOfLocalDay(now);
	// A time in office hours, `daysAgo` calendar days before today.
	const officeTime = (daysAgo: number) =>
		today - daysAgo * DAY_MS + between(9, 17) * HOUR_MS;

	const companies: CompanyRow[] = COMPANIES.map((company, index) => ({
		id: `company-${String(index + 1).padStart(2, "0")}`,
		...company,
	}));

	const contacts: ContactRow[] = [];
	companies.forEach((company, companyIndex) => {
		// Two people at one company, three at the next.
		const peopleCount = 2 + (companyIndex % 2);
		for (let person = 0; person < peopleCount; person += 1) {
			const index = contacts.length;
			// The steps 7 and 11 share no factor with 60, so the 60 contacts use each name one time, in a mixed order.
			const firstName = cycle(FIRST_NAMES, index * 7);
			const lastName = cycle(LAST_NAMES, index * 11 + 3);
			contacts.push({
				id: `contact-${String(index + 1).padStart(3, "0")}`,
				companyId: company.id,
				name: `${firstName} ${lastName}`,
				title: cycle(JOB_TITLES, index * 5 + person),
				// .example is a reserved domain, and 555-01xx is a reserved phone range: no real person has them.
				email:
					`${firstName}.${lastName}@${slugOf(company.name)}.example`.toLowerCase(),
				phone: `(555) 555-01${String(index).padStart(2, "0")}`,
			});
		}
	});

	const deals: DealRow[] = [];
	const stageChanges: StageChangeRow[] = [];
	// The wide type lets indexOf take any stage of a plan.
	const openStages: readonly DealStage[] = OPEN_STAGES;
	for (const plan of DEAL_PLANS) {
		for (let count = 0; count < plan.count; count += 1) {
			const id = `deal-${String(deals.length + 1).padStart(3, "0")}`;
			const company = pick(companies);
			const contact = pick(
				contacts.filter((person) => person.companyId === company.id),
			);
			const takenOffers = deals
				.filter((deal) => deal.companyId === company.id)
				.map((deal) => deal.name);
			const firstOffer = deals.length * 7;
			// A step of 7 through the 24 offers mixes the price bands. The first offer that fits the company wins.
			// A company does not buy one offer two times, and a small company does not buy a large plan.
			// Each company fits 18 offers or more and has fewer deals, so the fallback after ?? never runs.
			const offer =
				OFFERS.map((_, offset) => cycle(OFFERS, firstOffer + offset)).find(
					(option) =>
						company.employees >= (option.minEmployees ?? 0) &&
						(option.industries?.includes(company.industry) ?? true) &&
						!takenOffers.includes(option.name),
				) ?? cycle(OFFERS, firstOffer);
			const isClosed = plan.stage === "won" || plan.stage === "lost";
			let daysAgo = between(plan.minDays, plan.maxDays);
			const stageChangedAt = officeTime(daysAgo);
			// A won deal passed every open stage. A lost deal stopped at any of them.
			const lastOpenIndex =
				plan.stage === "won"
					? OPEN_STAGES.length - 1
					: plan.stage === "lost"
						? between(0, OPEN_STAGES.length - 1)
						: openStages.indexOf(plan.stage);
			// Walk back in time from the newest stage change to the first one.
			let cursor = stageChangedAt;
			if (isClosed) {
				stageChanges.push({
					dealId: id,
					stage: plan.stage,
					changedAt: iso(cursor),
				});
				daysAgo += between(3, 12);
				cursor = officeTime(daysAgo);
			}
			for (let index = lastOpenIndex; index >= 0; index -= 1) {
				stageChanges.push({
					dealId: id,
					stage: cycle(OPEN_STAGES, index),
					changedAt: iso(cursor),
				});
				if (index > 0) {
					daysAgo += between(3, 12);
					cursor = officeTime(daysAgo);
				}
			}
			const closeRange = isClosed
				? null
				: CLOSE_IN_DAYS[cycle(OPEN_STAGES, lastOpenIndex)];
			deals.push({
				id,
				name: offer.name,
				companyId: company.id,
				contactId: contact.id,
				ownerId: pick(REPS).id,
				stage: plan.stage,
				amount: between(offer.minThousands, offer.maxThousands) * 1_000,
				source: pick(DEAL_SOURCES),
				createdAt: iso(cursor),
				stageChangedAt: iso(stageChangedAt),
				expectedCloseAt: iso(
					closeRange
						? today +
								between(closeRange[0], closeRange[1]) * DAY_MS +
								12 * HOUR_MS
						: stageChangedAt + between(-6, 6) * DAY_MS,
				),
				closedAt: isClosed ? iso(stageChangedAt) : null,
				lostReason: plan.stage === "lost" ? pick(LOST_REASONS) : null,
			});
		}
	}

	// The time span in which each deal was open. An activity of a day goes to a deal that was open on that day.
	const dealSpans = deals.map((deal) => {
		const proposal = stageChanges.find(
			(change) => change.dealId === deal.id && change.stage === "proposal",
		);
		return {
			deal,
			from: Date.parse(deal.createdAt),
			// An open deal stays open until the end of today.
			to: deal.closedAt ? Date.parse(deal.closedAt) : today + DAY_MS,
			// The time from which the late texts fit. Never, when the deal did not reach the proposal stage.
			lateFrom: proposal
				? Date.parse(proposal.changedAt)
				: Number.POSITIVE_INFINITY,
		};
	});
	const activities: ActivityRow[] = [];
	// The type and the subject of the last SUBJECT_MEMORY activities of each deal, oldest first.
	const recentByDeal = new Map<
		string,
		{ type: ActivityType; subject: string }[]
	>();
	const countByDeal = new Map<string, number>();
	for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
		const dayStart = today - daysAgo * DAY_MS;
		// Noon is on the same calendar day in every clock change.
		const weekday = new Date(dayStart + 12 * HOUR_MS).getDay();
		// The team grows: the newest days have about 1.3 times the base, the oldest about 0.7 times.
		const trend = 1.3 - (daysAgo / HISTORY_DAYS) * 0.6;
		const dayCount = Math.round(
			cycle(WEEKDAY_ACTIVITIES, weekday) * trend * (0.7 + random() * 0.6),
		);
		// The times of the day in order, so the activity list is in time order. Office hours: 08:00 to 18:00.
		const times = Array.from(
			{ length: dayCount },
			() => dayStart + between(8 * 60, 18 * 60) * MINUTE_MS,
		).sort((first, second) => first - second);
		for (const occurredAt of times) {
			const openThen = dealSpans.filter(
				(span) =>
					span.from <= occurredAt &&
					occurredAt <= span.to &&
					(countByDeal.get(span.deal.id) ?? 0) < MAX_DEAL_ACTIVITIES,
			);
			// About one activity in seven is prospecting with no deal yet.
			const span =
				openThen.length > 0 && random() > 0.15 ? pick(openThen) : null;
			const deal = span ? span.deal : null;
			// Prospecting is early work. A deal gets the late texts from its proposal on.
			const phase: SalesPhase =
				span && occurredAt >= span.lateFrom ? "late" : "early";
			const recent = deal ? (recentByDeal.get(deal.id) ?? []) : [];
			const roll = random();
			const rolledType: ActivityType =
				roll < 0.4
					? "email"
					: roll < 0.7
						? "call"
						: roll < 0.88
							? "meeting"
							: "note";
			// Two activities of one type in a row on a deal are rare: most of the time the second one takes the next type.
			const type =
				recent.at(-1)?.type === rolledType && random() < 0.7
					? cycle(ACTIVITY_TYPES, ACTIVITY_TYPES.indexOf(rolledType) + 1)
					: rolledType;
			const texts = ACTIVITY_TEXTS[type].filter(
				(option) => option.phase === phase || option.phase === "any",
			);
			const firstIndex = between(0, texts.length - 1);
			// The first text of the type that is not in the memory of the deal wins.
			const text =
				texts
					.map((_, offset) => cycle(texts, firstIndex + offset))
					.find((option) =>
						recent.every((entry) => entry.subject !== option.subject),
					) ?? cycle(texts, firstIndex);
			const contactId = deal ? deal.contactId : pick(contacts).id;
			// The owner logs most of the work on a deal. A colleague helps now and then.
			const repId = deal && random() > 0.2 ? deal.ownerId : pick(REPS).id;
			if (deal) {
				recentByDeal.set(
					deal.id,
					[...recent, { type, subject: text.subject }].slice(-SUBJECT_MEMORY),
				);
				countByDeal.set(deal.id, (countByDeal.get(deal.id) ?? 0) + 1);
			}
			// The rest of today has not happened yet. All the work of the row ran above,
			// so the hour of the load changes no other row: the rows of today only show one by one.
			if (occurredAt > now) {
				continue;
			}
			activities.push({
				id: `activity-${String(activities.length + 1).padStart(4, "0")}`,
				contactId,
				dealId: deal ? deal.id : null,
				repId,
				type,
				subject: text.subject,
				note: text.note,
				occurredAt: iso(occurredAt),
			});
		}
	}

	const openDeals = deals.filter((deal) => deal.closedAt === null);
	const tasks: TaskRow[] = Array.from({ length: 24 }, (_, index) => {
		const deal = cycle(openDeals, index * 3);
		// The first 6 tasks are overdue, the next 4 are due today, and the rest are due in the next 2 weeks.
		const dueInDays =
			index < 6 ? -between(1, 6) : index < 10 ? 0 : between(1, 14);
		return {
			id: `task-${String(index + 1).padStart(3, "0")}`,
			dealId: deal.id,
			assigneeId: deal.ownerId,
			// A deal in proposal or negotiation gets the late tasks.
			title: cycle(
				TASK_TITLES[
					deal.stage === "proposal" || deal.stage === "negotiation"
						? "late"
						: "early"
				],
				index,
			),
			dueAt: iso(today + dueInDays * DAY_MS + between(9, 17) * HOUR_MS),
			// A late or a large deal gets the urgent tasks. No random call here, so the other rows stay the same.
			priority:
				deal.stage === "negotiation" || deal.amount >= 50_000
					? "high"
					: deal.stage === "proposal" || deal.amount >= 20_000
						? "medium"
						: "low",
		};
	});

	return {
		reps: REPS,
		companies,
		contacts,
		deals,
		stageChanges,
		activities,
		tasks,
	};
}

// Built on the first read, then kept for the page load. A reload on the same day builds the same rows.
let cachedTables: SampleTables | null = null;

/** The sample tables. Every query file calls it, so all pages see the same rows. */
export function getSampleTables(): SampleTables {
	cachedTables ??= buildSampleTables(Date.now());
	return cachedTables;
}
