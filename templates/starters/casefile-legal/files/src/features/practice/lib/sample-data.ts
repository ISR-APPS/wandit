// The sample tables of the practice: attorneys, clients, matters, stage changes, deadlines, time entries,
// invoices, and payments. Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every date counts from the start of the current local day. A seeded generator makes the same rows all day.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import type { InvoiceStatus } from "./invoice-status";
import {
	type MatterStage,
	type PracticeArea,
	STAGE_PATH,
} from "./matter-stage";
import {
	addLocalDays,
	DAY_MS,
	dayKeyOf,
	HOUR_MS,
	startOfLocalDay,
} from "./time";

/** The role of a person of the firm. The label is the message key `roles.<role>`. */
export type AttorneyRole =
	| "partner"
	| "senior_associate"
	| "associate"
	| "paralegal";

/** One person of the firm who logs time. */
export type AttorneyRow = {
	id: string;
	name: string;
	role: AttorneyRole;
	/** Hourly rate in whole USD. Every rate is a multiple of 10, so an entry of 0.1 hour is a whole amount. */
	rate: number;
};

/** One client of the firm: a company or a person. */
export type ClientRow = {
	id: string;
	name: string;
	kind: "organization" | "individual";
	/** The person the firm speaks to at an organization. null for an individual client. */
	contactName: string | null;
	email: string;
	phone: string;
	city: string;
};

/** How the client pays for a matter. A flat fee is one invoice at the start; hourly is billed every 30 days. */
export type FeeArrangement = "hourly" | "flat";

/** One matter: a case or a piece of legal work for one client. The times are ISO texts. */
export type MatterRow = {
	id: string;
	/** The file number of the firm: year of opening and a counter, for example "2026-0071". */
	number: string;
	name: string;
	clientId: string;
	area: PracticeArea;
	stage: MatterStage;
	/** The attorney responsible for the matter. */
	leadId: string;
	/** The other side, a company or a person. null for advisory work. */
	opposingParty: string | null;
	/** The court or agency of a dispute. null for transactional work. */
	venue: string | null;
	fee: FeeArrangement;
	/** The whole fee of a flat matter, in USD. null on an hourly matter. */
	flatFee: number | null;
	/** The fee estimate agreed with the client, in USD. null on a flat matter. */
	budget: number | null;
	openedAt: string;
	/** When the matter entered its current stage. The board counts the age in the stage from it. */
	stageChangedAt: string;
	/** When the matter was closed or declined. null while it is open. */
	closedAt: string | null;
};

/** One move of a matter into a stage. The stage path of the detail page reads these rows. */
export type StageChangeRow = {
	matterId: string;
	stage: MatterStage;
	changedAt: string;
};

/** The kind of a dated event of a matter. The label is the message key `deadlineKinds.<kind>`. */
export type DeadlineKind =
	| "hearing"
	| "filing"
	| "meeting"
	| "closing"
	| "signing";

/** One future court date, filing deadline, or meeting of an open matter. */
export type DeadlineRow = {
	id: string;
	matterId: string;
	kind: DeadlineKind;
	title: string;
	/** Always in the future. A filing deadline is at 23:59 of its day. */
	dueAt: string;
};

/** One block of work that a person logs on a matter. */
export type TimeEntryRow = {
	id: string;
	matterId: string;
	attorneyId: string;
	/** The local day of the work, YYYY-MM-DD. An entry has no time of day. */
	day: string;
	/** In tenths of an hour, for example 1.5. */
	hours: number;
	description: string;
	/** False on a flat-fee matter and on a declined matter: the time is recorded but not charged. */
	billable: boolean;
	/** The rate of the person on the day, in USD. */
	rate: number;
	/** hours times rate, in whole USD. 0 when the entry is not billable. */
	amount: number;
	/** The invoice that charges the entry. null for unbilled time. */
	invoiceId: string | null;
};

/** One invoice of a matter. */
export type InvoiceRow = {
	id: string;
	/** For example "INV-1204". The numbers follow the issue dates. */
	number: string;
	matterId: string;
	clientId: string;
	/** "time" charges the time entries of one 30-day period; "flat" charges the flat fee. */
	kind: "time" | "flat";
	issuedAt: string;
	/** 30 days after the issue date, at 23:59. */
	dueAt: string;
	/** In whole USD. A time invoice is the sum of its entries. */
	amount: number;
	/** The sum of the payments so far. Never above `amount`. */
	paidAmount: number;
	status: InvoiceStatus;
};

/** One payment of a client on one invoice. */
export type PaymentRow = {
	id: string;
	invoiceId: string;
	/** In whole USD. */
	amount: number;
	paidAt: string;
};

/** Every sample table. The query files filter, join, and sort them. */
export type SampleTables = {
	attorneys: AttorneyRow[];
	clients: ClientRow[];
	matters: MatterRow[];
	stageChanges: StageChangeRow[];
	deadlines: DeadlineRow[];
	timeEntries: TimeEntryRow[];
	invoices: InvoiceRow[];
	payments: PaymentRow[];
};

// Time entries reach this many days back, so a 90-day chart has a full previous period.
const HISTORY_DAYS = 180;
// Time is billed in 30-day periods. Each client has its own billing day, so invoices leave on many days.
const BILLING_PERIOD_DAYS = 30;
// An invoice leaves 2 days after its period ends and is due 30 days later (net 30).
const ISSUE_DELAY_DAYS = 2;
const PAYMENT_TERM_DAYS = 30;

/** Days since the last invoice run of a client: 1 to 30. Time of the last ISSUE_DELAY_DAYS + this many days is unbilled. */
function lastBillingRunDaysAgo(clientId: string): number {
	// 7 and 30 have no common factor, so 30 clients get 30 different billing days.
	return 1 + ((Number(clientId.slice(4)) * 7) % BILLING_PERIOD_DAYS);
}

const ATTORNEYS: AttorneyRow[] = [
	{ id: "att-1", name: "Helena Okafor", role: "partner", rate: 450 },
	{ id: "att-2", name: "Tobias Lindgren", role: "partner", rate: 420 },
	{ id: "att-3", name: "Priya Raman", role: "senior_associate", rate: 340 },
	{ id: "att-4", name: "Mateo Silva", role: "associate", rate: 280 },
	{ id: "att-5", name: "Grace Whitfield", role: "associate", rate: 260 },
	{ id: "att-6", name: "Noor Haddad", role: "paralegal", rate: 140 },
];

// The areas where each person works most, by attorney index. Their time goes there first.
const ATTORNEY_AREAS: PracticeArea[][] = [
	["litigation"],
	["corporate", "estates"],
	["ip", "employment"],
	["real_estate", "litigation"],
	["family", "estates"],
	["litigation", "real_estate", "family", "employment"],
];

// How fast a client pays. "late" pays only old invoices, so its recent invoices go overdue.
type PaySpeed = "fast" | "normal" | "slow" | "late";

type ClientSeed = Omit<ClientRow, "id"> & { pays: PaySpeed };

const CLIENTS: ClientSeed[] = [
	{
		name: "Brightwater Freight Co.",
		kind: "organization",
		contactName: "Dana Whitcombe",
		email: "dana.whitcombe@brightwater.example",
		phone: "555-0101",
		city: "Kingsbridge",
		pays: "normal",
	},
	{
		name: "Alder & Finch Bakery",
		kind: "organization",
		contactName: "Ruth Alder",
		email: "ruth@alderfinch.example",
		phone: "555-0102",
		city: "Aldermoor",
		pays: "fast",
	},
	{
		name: "Northgate Housing Cooperative",
		kind: "organization",
		contactName: "Marcus Oyelaran",
		email: "board@northgate-coop.example",
		phone: "555-0103",
		city: "Kingsbridge",
		pays: "normal",
	},
	{
		name: "Kestrel Ridge Vineyards",
		kind: "organization",
		contactName: "Celine Marchetti",
		email: "celine@kestrelridge.example",
		phone: "555-0104",
		city: "Westvale",
		pays: "fast",
	},
	{
		name: "Pemberton Dental Group",
		kind: "organization",
		contactName: "Alan Pemberton",
		email: "alan.pemberton@pembertondental.example",
		phone: "555-0105",
		city: "Fenwick",
		pays: "fast",
	},
	{
		name: "Sablewood Studios",
		kind: "organization",
		contactName: "Jun Nakamura",
		email: "jun@sablewood.example",
		phone: "555-0106",
		city: "Harrow Bay",
		pays: "slow",
	},
	{
		name: "Calder Point Marina",
		kind: "organization",
		contactName: "Fiona Calder",
		email: "office@calderpoint.example",
		phone: "555-0107",
		city: "Harrow Bay",
		pays: "normal",
	},
	{
		name: "Harrow Lane Builders",
		kind: "organization",
		contactName: "Desmond Achebe",
		email: "desmond@harrowlane.example",
		phone: "555-0108",
		city: "Kingsbridge",
		pays: "late",
	},
	{
		name: "Tidewell Software",
		kind: "organization",
		contactName: "Riya Kapoor",
		email: "legal@tidewell.example",
		phone: "555-0109",
		city: "Kingsbridge",
		pays: "fast",
	},
	{
		name: "Quayside Coffee Roasters",
		kind: "organization",
		contactName: "Leo Brandt",
		email: "leo@quayside.example",
		phone: "555-0110",
		city: "Harrow Bay",
		pays: "normal",
	},
	{
		name: "Oakmere Senior Living",
		kind: "organization",
		contactName: "Patricia Vance",
		email: "pvance@oakmere.example",
		phone: "555-0111",
		city: "Fenwick",
		pays: "slow",
	},
	{
		name: "Ironvale Machine Works",
		kind: "organization",
		contactName: "Gunnar Holt",
		email: "gunnar.holt@ironvale.example",
		phone: "555-0112",
		city: "Millbrook",
		pays: "normal",
	},
	{
		name: "Fernhill Organic Farms",
		kind: "organization",
		contactName: "Abigail Rowe",
		email: "abigail@fernhill.example",
		phone: "555-0113",
		city: "Millbrook",
		pays: "normal",
	},
	{
		name: "Marlow Street Gallery",
		kind: "organization",
		contactName: "Sebastien Duval",
		email: "sebastien@marlowgallery.example",
		phone: "555-0114",
		city: "Aldermoor",
		pays: "normal",
	},
	{
		name: "Lumen Pediatrics",
		kind: "organization",
		contactName: "Naomi Etienne",
		email: "naomi.etienne@lumenpeds.example",
		phone: "555-0115",
		city: "Westvale",
		pays: "fast",
	},
	{
		name: "Rookwood Textiles",
		kind: "organization",
		contactName: "Hamid Karimi",
		email: "hamid@rookwood.example",
		phone: "555-0116",
		city: "Millbrook",
		pays: "normal",
	},
	{
		name: "Amelia Hart",
		kind: "individual",
		contactName: null,
		email: "amelia.hart@mail.example",
		phone: "555-0117",
		city: "Kingsbridge",
		pays: "normal",
	},
	{
		name: "Jonah Whitaker",
		kind: "individual",
		contactName: null,
		email: "jonah.whitaker@mail.example",
		phone: "555-0118",
		city: "Aldermoor",
		pays: "normal",
	},
	{
		name: "Rosa Delgado",
		kind: "individual",
		contactName: null,
		email: "rosa.delgado@mail.example",
		phone: "555-0119",
		city: "Fenwick",
		pays: "fast",
	},
	{
		name: "Samuel Okonkwo",
		kind: "individual",
		contactName: null,
		email: "samuel.okonkwo@mail.example",
		phone: "555-0120",
		city: "Kingsbridge",
		pays: "normal",
	},
	{
		name: "Ingrid Solberg",
		kind: "individual",
		contactName: null,
		email: "ingrid.solberg@mail.example",
		phone: "555-0121",
		city: "Westvale",
		pays: "fast",
	},
	{
		name: "Victor Laine",
		kind: "individual",
		contactName: null,
		email: "victor.laine@mail.example",
		phone: "555-0122",
		city: "Harrow Bay",
		pays: "late",
	},
	{
		name: "Mei Tanaka",
		kind: "individual",
		contactName: null,
		email: "mei.tanaka@mail.example",
		phone: "555-0123",
		city: "Kingsbridge",
		pays: "normal",
	},
	{
		name: "Farah Benali",
		kind: "individual",
		contactName: null,
		email: "farah.benali@mail.example",
		phone: "555-0124",
		city: "Aldermoor",
		pays: "normal",
	},
	{
		name: "Elliot Crane",
		kind: "individual",
		contactName: null,
		email: "elliot.crane@mail.example",
		phone: "555-0125",
		city: "Fenwick",
		pays: "slow",
	},
	{
		name: "Lucia Romano",
		kind: "individual",
		contactName: null,
		email: "lucia.romano@mail.example",
		phone: "555-0126",
		city: "Westvale",
		pays: "fast",
	},
	{
		name: "Theo Mansfield",
		kind: "individual",
		contactName: null,
		email: "theo.mansfield@mail.example",
		phone: "555-0127",
		city: "Millbrook",
		pays: "normal",
	},
	{
		name: "Hana Kowalski",
		kind: "individual",
		contactName: null,
		email: "hana.kowalski@mail.example",
		phone: "555-0128",
		city: "Kingsbridge",
		pays: "normal",
	},
	{
		name: "Omar Siddiqui",
		kind: "individual",
		contactName: null,
		email: "omar.siddiqui@mail.example",
		phone: "555-0129",
		city: "Harrow Bay",
		pays: "normal",
	},
	{
		name: "Clara Bennett",
		kind: "individual",
		contactName: null,
		email: "clara.bennett@mail.example",
		phone: "555-0130",
		city: "Fenwick",
		pays: "normal",
	},
];

// One matter: name, client index, area, stage, days in the stage, days since opening, lead attorney index,
// the other side, and the flat fee in USD (absent on an hourly matter).
type MatterSeed = [
	name: string,
	client: number,
	area: PracticeArea,
	stage: MatterStage,
	daysInStage: number,
	daysOpen: number,
	lead: number,
	opposing: string | null,
	flatFee?: number,
];

const MATTERS: MatterSeed[] = [
	// Intake: new matters. The conflict check and the engagement letter come first.
	[
		"Harlow v. Brightwater Freight",
		0,
		"litigation",
		"intake",
		3,
		3,
		0,
		"Peter Harlow",
	],
	["Trademark clearance, house blends", 9, "ip", "intake", 2, 2, 2, null, 2400],
	["Prenuptial agreement", 25, "family", "intake", 5, 5, 4, null, 4000],
	[
		"Commercial lease review, Unit 4B",
		1,
		"real_estate",
		"intake",
		8,
		8,
		3,
		"Millbrook Retail Partners",
	],
	[
		"Wage claim, warehouse staff",
		11,
		"employment",
		"intake",
		11,
		11,
		2,
		"State Labor Board",
	],
	["Will and living trust", 27, "estates", "intake", 1, 1, 4, null, 3800],
	[
		"Software licensing dispute",
		8,
		"litigation",
		"intake",
		6,
		6,
		0,
		"Corvane Systems",
	],
	// Research: fact-finding and due diligence.
	[
		"Okonkwo v. Lakeshore Transit",
		19,
		"litigation",
		"research",
		14,
		41,
		0,
		"Lakeshore Transit Authority",
	],
	[
		"Acquisition of Copperleaf Café",
		1,
		"corporate",
		"research",
		9,
		30,
		1,
		"Copperleaf Café LLC",
	],
	[
		"Zoning variance, Lot 12",
		7,
		"real_estate",
		"research",
		22,
		64,
		3,
		"Westvale Planning Commission",
	],
	[
		"Wrongful termination claim",
		22,
		"employment",
		"research",
		6,
		25,
		2,
		"Halvorsen Logistics",
	],
	["Patent assignment audit", 8, "ip", "research", 17, 45, 2, null],
	["Custody modification", 17, "family", "research", 4, 19, 4, "Erin Whitaker"],
	["Probate of the Solberg estate", 20, "estates", "research", 27, 58, 1, null],
	[
		"Supplier contract breach",
		15,
		"litigation",
		"research",
		11,
		37,
		0,
		"Delmar Fibers Inc.",
	],
	["Employee handbook overhaul", 14, "employment", "research", 3, 15, 3, null],
	[
		"Due diligence, Pier 9 warehouse",
		6,
		"real_estate",
		"research",
		19,
		33,
		1,
		"Pier 9 Holdings",
	],
	[
		"Copyright registration, film catalog",
		5,
		"ip",
		"research",
		8,
		22,
		2,
		null,
		2800,
	],
	// Drafting: pleadings, agreements, and wills.
	[
		"Delgado v. Summit Mutual",
		18,
		"litigation",
		"drafting",
		12,
		96,
		0,
		"Summit Mutual Insurance",
	],
	[
		"Series A financing",
		8,
		"corporate",
		"drafting",
		7,
		52,
		1,
		"Lattice Ventures",
	],
	["Shareholder agreement update", 3, "corporate", "drafting", 16, 70, 1, null],
	[
		"Ground lease, Northgate Block C",
		2,
		"real_estate",
		"drafting",
		23,
		88,
		3,
		"Kingsbridge Land Trust",
	],
	[
		"Divorce and asset division",
		29,
		"family",
		"drafting",
		9,
		77,
		4,
		"Graham Bennett",
	],
	[
		"Non-compete enforcement",
		4,
		"employment",
		"drafting",
		5,
		40,
		2,
		"Lena Vos",
	],
	["Special needs trust", 23, "estates", "drafting", 13, 34, 4, null, 5200],
	[
		"Construction defect claim",
		10,
		"litigation",
		"drafting",
		31,
		120,
		0,
		"Granitefield Contractors",
	],
	[
		"Franchise agreement, second site",
		9,
		"corporate",
		"drafting",
		4,
		28,
		3,
		"Bluewick Franchising",
	],
	[
		"Trademark opposition, Kestrel mark",
		3,
		"ip",
		"drafting",
		18,
		61,
		2,
		"Kestrel Outdoor Gear",
	],
	[
		"Estate plan for a blended family",
		26,
		"estates",
		"drafting",
		6,
		27,
		4,
		null,
		6500,
	],
	["Harassment investigation", 12, "employment", "drafting", 10, 36, 2, null],
	[
		"Security deposit dispute",
		16,
		"litigation",
		"drafting",
		2,
		14,
		3,
		"Elmstead Property Management",
	],
	// Negotiation: settlement talks and deal terms.
	[
		"Merger with Westvale Dental",
		4,
		"corporate",
		"negotiation",
		21,
		140,
		1,
		"Westvale Dental Partners",
	],
	[
		"Crane v. Fairhaven Motors",
		24,
		"litigation",
		"negotiation",
		15,
		150,
		0,
		"Fairhaven Motors",
	],
	[
		"Distribution agreement, Nordic markets",
		15,
		"corporate",
		"negotiation",
		8,
		66,
		1,
		"Norrland Trading",
	],
	[
		"Retail lease renewal",
		13,
		"real_estate",
		"negotiation",
		12,
		49,
		3,
		"Harbourline Estates",
	],
	[
		"Severance negotiation",
		21,
		"employment",
		"negotiation",
		26,
		81,
		2,
		"Orrin Analytics",
	],
	[
		"Child support review",
		28,
		"family",
		"negotiation",
		5,
		59,
		4,
		"Leila Siddiqui",
	],
	[
		"Character licensing deal",
		5,
		"ip",
		"negotiation",
		34,
		102,
		2,
		"Pinecone Toys",
	],
	[
		"Insurance coverage dispute",
		7,
		"litigation",
		"negotiation",
		19,
		133,
		0,
		"Crestline Casualty",
	],
	[
		"Easement settlement",
		12,
		"real_estate",
		"negotiation",
		7,
		92,
		3,
		"Bramley Water District",
	],
	// Closed in the last 30 days.
	[
		"Asset purchase, roastery",
		9,
		"corporate",
		"closed",
		2,
		118,
		1,
		"Ember Hill Roasting",
	],
	["Power of attorney and will", 22, "estates", "closed", 3, 31, 4, null, 2900],
	[
		"Collection of unpaid invoices",
		11,
		"litigation",
		"closed",
		3,
		84,
		0,
		"Tallow Metals",
	],
	[
		"Lease termination, Dock 3",
		6,
		"real_estate",
		"closed",
		9,
		57,
		3,
		"Harbor Dock Authority",
	],
	[
		"Annual filings and board minutes",
		3,
		"corporate",
		"closed",
		10,
		40,
		1,
		null,
	],
	[
		"Employment contracts, new clinic",
		14,
		"employment",
		"closed",
		10,
		46,
		2,
		null,
	],
	["Guardianship petition", 17, "family", "closed", 10, 74, 4, null],
	["Trademark registration, bakery", 1, "ip", "closed", 17, 140, 2, null, 2400],
	[
		"Slip and fall defense",
		10,
		"litigation",
		"closed",
		17,
		190,
		0,
		"Gloria Pettit",
	],
	[
		"Refinancing documents",
		2,
		"real_estate",
		"closed",
		24,
		63,
		3,
		"Kingsbridge Savings Bank",
	],
	[
		"Trust administration, Mansfield",
		26,
		"estates",
		"closed",
		27,
		210,
		1,
		null,
	],
	// Closed earlier.
	["Estate plan, Crane family", 24, "estates", "closed", 35, 95, 4, null, 4200],
	[
		"Independent contractor review",
		8,
		"employment",
		"closed",
		39,
		160,
		2,
		null,
	],
	["Fence line dispute", 27, "litigation", "closed", 44, 120, 3, "Arthur Pell"],
	[
		"Operating agreement, holding company",
		0,
		"corporate",
		"closed",
		52,
		190,
		1,
		null,
	],
	[
		"Lease negotiation, cold storage",
		0,
		"real_estate",
		"closed",
		58,
		90,
		3,
		"Fenwick Cold Storage",
	],
	["Uncontested divorce", 18, "family", "closed", 63, 210, 4, "Marco Delgado"],
	[
		"Software escrow agreement",
		8,
		"ip",
		"closed",
		71,
		110,
		2,
		"Vaultline Escrow",
	],
	["Partner buyout", 4, "corporate", "closed", 86, 260, 1, null],
	[
		"Wrongful eviction defense",
		23,
		"litigation",
		"closed",
		104,
		230,
		0,
		"Coldridge Rentals",
	],
	[
		"Grant deed and title transfer",
		13,
		"real_estate",
		"closed",
		131,
		250,
		3,
		null,
	],
	[
		"Contract dispute, Harbor Logistics",
		0,
		"litigation",
		"closed",
		118,
		330,
		0,
		"Harbor Logistics Group",
	],
	[
		"Office lease, headquarters",
		8,
		"real_estate",
		"closed",
		142,
		240,
		3,
		"Lindqvist Towers",
	],
	[
		"Vineyard land purchase",
		3,
		"real_estate",
		"closed",
		149,
		280,
		3,
		"Okanagan Acres",
	],
	[
		"Malpractice defense",
		4,
		"litigation",
		"closed",
		167,
		360,
		0,
		"Teresa Lomax",
	],
	["Estate of Harold Hart", 16, "estates", "closed", 125, 270, 1, null],
	// Declined at intake: a conflict of interest, or the firm cannot take the work.
	[
		"Defamation claim",
		20,
		"litigation",
		"declined",
		3,
		7,
		0,
		"Coastline Herald",
	],
	["Joint venture review", 10, "corporate", "declined", 12, 15, 1, null],
	[
		"Noise complaint against a neighbor",
		16,
		"litigation",
		"declined",
		26,
		28,
		3,
		"Ralph Gunderson",
	],
	[
		"Patent litigation inquiry",
		9,
		"ip",
		"declined",
		49,
		52,
		2,
		"Brewcraft Machines",
	],
	["Tenant eviction inquiry", 13, "real_estate", "declined", 88, 92, 3, null],
];

// The court or agency of a dispute, per area. A transactional area has none.
const VENUES: Partial<Record<PracticeArea, string[]>> = {
	litigation: ["Kingsbridge County Superior Court", "Aldermoor District Court"],
	employment: ["State Labor Board, Kingsbridge office"],
	family: ["Kingsbridge County Family Court"],
};

// The dated events of an open matter after intake, per area: kind and title.
const DEADLINES: Record<PracticeArea, [DeadlineKind, string][]> = {
	litigation: [
		["hearing", "Case management conference"],
		["filing", "Answer to complaint due"],
		["meeting", "Deposition of key witness"],
		["filing", "Expert disclosures due"],
		["meeting", "Mediation session"],
		["hearing", "Motion hearing"],
	],
	corporate: [
		["meeting", "Board approval meeting"],
		["filing", "Disclosure schedules due"],
		["closing", "Closing call"],
		["signing", "Signing of final agreement"],
	],
	employment: [
		["filing", "Response to agency charge due"],
		["meeting", "Witness interview"],
		["meeting", "Mediation session"],
		["filing", "Position statement due"],
	],
	real_estate: [
		["filing", "Title objection deadline"],
		["meeting", "Site inspection"],
		["closing", "Closing"],
		["signing", "Lease signing"],
	],
	family: [
		["hearing", "Temporary orders hearing"],
		["filing", "Financial disclosures due"],
		["meeting", "Mediation session"],
		["filing", "Parenting plan due"],
	],
	estates: [
		["signing", "Will signing"],
		["filing", "Probate inventory due"],
		["meeting", "Beneficiary meeting"],
		["filing", "Trust funding deadline"],
	],
	ip: [
		["filing", "Office action response due"],
		["filing", "Opposition brief due"],
		["meeting", "Licensing call"],
		["signing", "License signing"],
	],
};

// The one dated event of a matter at intake. Court dates and filings come only after the firm takes the matter.
const INTAKE_DEADLINES: [DeadlineKind, string][] = [
	["meeting", "Initial consultation"],
	["filing", "Engagement letter due"],
	["meeting", "Conflict check review"],
];

// The clock hour of each kind of event. A filing deadline ends the day.
const DEADLINE_HOUR: Record<DeadlineKind, number> = {
	hearing: 9.5,
	filing: 23.98,
	meeting: 14,
	closing: 11,
	signing: 15,
};

// The work of an entry, per area and per stage of the matter on that day. Intake work is the same in every area.
const INTAKE_WORK = [
	"Conflict check and intake call",
	"Draft engagement letter",
	"Review documents sent by the client",
	"Initial strategy memo",
];

const WORK: Record<
	PracticeArea,
	Record<"research" | "drafting" | "negotiation", string[]>
> = {
	litigation: {
		research: [
			"Review discovery production",
			"Research on the limitation period",
			"Interview witness",
			"Summarize deposition transcript",
		],
		drafting: [
			"Draft motion to compel",
			"Revise answer and defenses",
			"Prepare exhibit list",
			"Draft discovery requests",
		],
		negotiation: [
			"Call with opposing counsel on settlement",
			"Prepare mediation statement",
			"Attend mediation",
			"Review settlement offer",
		],
	},
	corporate: {
		research: [
			"Due diligence review of contracts",
			"Review cap table and charter",
			"Call with client finance lead",
		],
		drafting: [
			"Draft purchase agreement",
			"Revise term sheet",
			"Draft board resolutions",
			"Mark up disclosure schedules",
		],
		negotiation: [
			"Negotiation call on key terms",
			"Revise agreement after markup",
			"Prepare signing checklist",
		],
	},
	employment: {
		research: [
			"Review personnel file",
			"Research wage and hour rules",
			"Interview HR manager",
		],
		drafting: [
			"Draft position statement",
			"Draft severance agreement",
			"Revise employee handbook",
		],
		negotiation: ["Negotiate severance terms", "Call with opposing counsel"],
	},
	real_estate: {
		research: [
			"Title search review",
			"Review survey and easements",
			"Zoning code research",
		],
		drafting: [
			"Draft lease amendment",
			"Revise purchase agreement",
			"Prepare closing checklist",
		],
		negotiation: [
			"Negotiate rent and term",
			"Call with landlord counsel",
			"Revise lease after comments",
		],
	},
	family: {
		research: [
			"Review financial statements",
			"Client meeting on parenting schedule",
			"Research support guidelines",
		],
		drafting: [
			"Draft settlement agreement",
			"Prepare financial affidavit",
			"Draft parenting plan",
		],
		negotiation: ["Settlement conference", "Revise settlement proposal"],
	},
	estates: {
		research: [
			"Review asset inventory",
			"Research trust options",
			"Meeting with beneficiaries",
		],
		drafting: ["Draft will", "Draft trust instrument", "Prepare funding memo"],
		negotiation: [
			"Meeting to sign documents",
			"Coordinate with financial advisor",
		],
	},
	ip: {
		research: [
			"Trademark search report",
			"Review prior registrations",
			"Chain of title review",
		],
		drafting: [
			"Draft office action response",
			"Draft license agreement",
			"Prepare opposition brief",
		],
		negotiation: ["Negotiate royalty terms", "Call with licensee counsel"],
	},
};

// A paralegal does support work in every area.
const PARALEGAL_WORK = [
	"Organize exhibits",
	"Prepare filing package",
	"Update case calendar",
	"Index client documents",
];

// Fee estimate of an hourly matter, as a multiple of its logged billable time.
const BUDGET_MARGIN = { open: [0.9, 1.8], closed: [1, 1.3] } as const;

/** A random number generator with a fixed seed (mulberry32). The same seed gives the same rows. */
function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

// A whole number from min to max, both included.
function between(random: () => number, min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(random: () => number, list: readonly T[]): T {
	// SAFETY: every list in this file has at least one item, so the index is in range.
	return list[Math.floor(random() * list.length)] as T;
}

// The local time `daysAgo` days before today, at `hour` (a decimal hour of the day).
function atDay(today: number, daysAgo: number, hour: number): number {
	return addLocalDays(today, -daysAgo) + hour * HOUR_MS;
}

const iso = (ms: number) => new Date(ms).toISOString();

type MatterWindow = {
	row: MatterRow;
	/** Days ago of the first and the last day of work. */
	firstDay: number;
	lastDay: number;
	/** The stage of the matter on each day of work, by days ago. */
	stageOn: (daysAgo: number) => MatterStage;
};

function buildMatters(today: number, random: () => number) {
	const windows: MatterWindow[] = [];
	const stageChanges: StageChangeRow[] = [];
	MATTERS.forEach((seed, index) => {
		const [
			name,
			client,
			area,
			stage,
			daysInStage,
			daysOpen,
			lead,
			opposing,
			flatFee,
		] = seed;
		const id = `mat-${String(index + 1).padStart(3, "0")}`;
		const openedAt = atDay(today, daysOpen, between(random, 9, 16) + 0.25);
		// The stages before the current one, spread evenly between the opening and the last change.
		const path: MatterStage[] =
			stage === "declined"
				? ["intake", "declined"]
				: STAGE_PATH.slice(0, STAGE_PATH.indexOf(stage) + 1);
		const changeDays = path.map((_, step) =>
			step === 0
				? daysOpen
				: step === path.length - 1
					? daysInStage
					: Math.round(
							daysOpen - ((daysOpen - daysInStage) * step) / (path.length - 1),
						),
		);
		const changeTimes = changeDays.map((daysAgo, step) =>
			step === 0 ? openedAt : atDay(today, daysAgo, between(random, 10, 17)),
		);
		path.forEach((pathStage, step) => {
			stageChanges.push({
				matterId: id,
				stage: pathStage,
				// SAFETY: changeTimes has one time per step of path.
				changedAt: iso(changeTimes[step] as number),
			});
		});
		const isEnded = stage === "closed" || stage === "declined";
		// SAFETY: path is never empty, so changeTimes has a last item.
		const lastChange = changeTimes.at(-1) as number;
		const venues = VENUES[area];
		const row: MatterRow = {
			id,
			// The loop after this one sets the number from the opening order.
			number: "",
			name,
			clientId: `cli-${String(client + 1).padStart(2, "0")}`,
			area,
			stage,
			leadId: `att-${lead + 1}`,
			opposingParty: opposing,
			venue: venues && opposing ? pick(random, venues) : null,
			fee: flatFee ? "flat" : "hourly",
			flatFee: flatFee ?? null,
			budget: null,
			openedAt: iso(openedAt),
			stageChangedAt: iso(lastChange),
			closedAt: isEnded ? iso(lastChange) : null,
		};
		windows.push({
			row,
			firstDay: daysOpen,
			lastDay: isEnded ? daysInStage : 0,
			stageOn: (daysAgo) => {
				// The last stage that started on or before the day. changeDays counts down, so search from the end.
				for (let step = changeDays.length - 1; step >= 0; step -= 1) {
					if ((changeDays[step] ?? 0) >= daysAgo) {
						return path[step] ?? "intake";
					}
				}
				return "intake";
			},
		});
	});
	// Numbers follow the exact opening time, per year of opening, so a newer matter always has a higher number.
	const countPerYear = new Map<number, number>();
	const byOpening = [...windows].sort(
		(first, second) =>
			first.row.openedAt.localeCompare(second.row.openedAt) ||
			first.row.id.localeCompare(second.row.id),
	);
	for (const { row } of byOpening) {
		const year = new Date(row.openedAt).getFullYear();
		const count = (countPerYear.get(year) ?? 0) + 1;
		countPerYear.set(year, count);
		// The firm opened about 60 matters in the year before the first sample matter.
		row.number = `${year}-${String(60 + count).padStart(4, "0")}`;
	}
	return { windows, stageChanges };
}

function buildDeadlines(
	today: number,
	random: () => number,
	matters: MatterRow[],
): DeadlineRow[] {
	const deadlines: DeadlineRow[] = [];
	for (const matter of matters) {
		if (matter.closedAt) {
			continue;
		}
		const templates =
			matter.stage === "intake" ? INTAKE_DEADLINES : DEADLINES[matter.area];
		const count = matter.stage === "intake" ? 1 : between(random, 2, 3);
		// Spread over four weeks, so only about one matter in four has a deadline in the next 7 days.
		let daysAhead = between(random, 0, 28);
		const firstTemplate = between(random, 0, templates.length - 1);
		for (let step = 0; step < count; step += 1) {
			// SAFETY: the modulo keeps the index inside the list.
			const [kind, title] = templates[
				(firstTemplate + step) % templates.length
			] as [DeadlineKind, string];
			// Only a filing deadline (23:59) can fall today: a hearing at 9:30 today can already be over.
			const day = kind === "filing" ? daysAhead : Math.max(1, daysAhead);
			deadlines.push({
				id: `dl-${deadlines.length + 1}`,
				matterId: matter.id,
				kind,
				title,
				dueAt: iso(atDay(today, -day, DEADLINE_HOUR[kind])),
			});
			daysAhead += between(random, 8, 24);
		}
	}
	return deadlines;
}

function buildTimeEntries(
	today: number,
	random: () => number,
	windows: MatterWindow[],
): TimeEntryRow[] {
	const entries: TimeEntryRow[] = [];
	for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
		const weekday = new Date(addLocalDays(today, -daysAgo)).getDay();
		// Most work happens on weekdays, a little on Saturday. Today is half logged.
		const dayFactor =
			(weekday === 0 ? 0 : weekday === 6 ? 0.15 : weekday === 5 ? 0.85 : 1) *
			(daysAgo === 0 ? 0.5 : 1);
		// The firm grows slowly: about 25 % more time now than six months ago.
		const growth = 0.88 + 0.22 * (1 - daysAgo / HISTORY_DAYS);
		const active = windows.filter(
			(window) => window.firstDay >= daysAgo && window.lastDay <= daysAgo,
		);
		ATTORNEYS.forEach((attorney, attorneyIndex) => {
			const base =
				attorney.role === "paralegal"
					? 4
					: attorney.role === "partner"
						? 2.4
						: 3.3;
			const count = Math.floor(base * growth * dayFactor + random());
			// SAFETY: ATTORNEY_AREAS has one list per attorney.
			const areas = ATTORNEY_AREAS[attorneyIndex] as PracticeArea[];
			const own = active.filter(
				(window) =>
					window.row.leadId === attorney.id || areas.includes(window.row.area),
			);
			const candidates = own.length > 0 ? own : active;
			for (let step = 0; step < count && candidates.length > 0; step += 1) {
				// A matter that the person leads gets three chances.
				const weighted = candidates.flatMap((window) =>
					window.row.leadId === attorney.id
						? [window, window, window]
						: [window],
				);
				const window = pick(random, weighted);
				const stage = window.stageOn(daysAgo);
				const description =
					attorney.role === "paralegal"
						? pick(random, PARALEGAL_WORK)
						: stage === "research" ||
								stage === "drafting" ||
								stage === "negotiation"
							? pick(random, WORK[window.row.area][stage])
							: pick(random, INTAKE_WORK);
				// Tenths of an hour, mostly short blocks, sometimes a long one.
				const hours = Math.round((0.2 + random() ** 1.6 * 3.6) * 10) / 10;
				const billable =
					window.row.fee === "hourly" && window.row.stage !== "declined";
				entries.push({
					id: `te-${entries.length + 1}`,
					matterId: window.row.id,
					attorneyId: attorney.id,
					day: dayKeyOf(addLocalDays(today, -daysAgo)),
					hours,
					description,
					billable,
					rate: attorney.rate,
					// Whole dollars: the rate is a multiple of 10 and the hours have one decimal.
					amount: billable ? Math.round(hours * attorney.rate) : 0,
					invoiceId: null,
				});
			}
		});
	}
	return entries;
}

function buildInvoices(
	today: number,
	random: () => number,
	matters: MatterRow[],
	entries: TimeEntryRow[],
): { invoices: InvoiceRow[]; payments: PaymentRow[] } {
	type Draft = {
		matter: MatterRow;
		kind: InvoiceRow["kind"];
		issuedDaysAgo: number;
		amount: number;
		entries: TimeEntryRow[];
	};
	const drafts = new Map<string, Draft>();
	const matterById = new Map(matters.map((matter) => [matter.id, matter]));
	for (const entry of entries) {
		const daysAgo = Math.round(
			(today - startOfLocalDay(Date.parse(`${entry.day}T12:00:00`))) / DAY_MS,
		);
		// SAFETY: every entry points to a matter of the same tables.
		const matter = matterById.get(entry.matterId) as MatterRow;
		// Period 0 ends 2 days before the last run of the client; each older period is 30 days earlier.
		const periodEndDaysAgo =
			lastBillingRunDaysAgo(matter.clientId) + ISSUE_DELAY_DAYS;
		if (!entry.billable || daysAgo < periodEndDaysAgo) {
			continue;
		}
		const period = Math.floor(
			(daysAgo - periodEndDaysAgo) / BILLING_PERIOD_DAYS,
		);
		const key = `${entry.matterId}:${period}`;
		const draft = drafts.get(key) ?? {
			matter,
			kind: "time",
			issuedDaysAgo:
				periodEndDaysAgo + period * BILLING_PERIOD_DAYS - ISSUE_DELAY_DAYS,
			amount: 0,
			entries: [],
		};
		draft.amount += entry.amount;
		draft.entries.push(entry);
		drafts.set(key, draft);
	}
	for (const matter of matters) {
		const daysOpen = Math.round(
			(today - startOfLocalDay(Date.parse(matter.openedAt))) / DAY_MS,
		);
		// A flat fee is billed 3 days after the opening. A very new matter has no invoice yet.
		if (matter.flatFee && matter.stage !== "declined" && daysOpen - 3 >= 1) {
			drafts.set(`${matter.id}:flat`, {
				matter,
				kind: "flat",
				issuedDaysAgo: daysOpen - 3,
				amount: matter.flatFee,
				entries: [],
			});
		}
	}

	const sorted = [...drafts.values()].sort(
		(first, second) =>
			second.issuedDaysAgo - first.issuedDaysAgo ||
			first.matter.number.localeCompare(second.matter.number),
	);
	const invoices: InvoiceRow[] = [];
	const payments: PaymentRow[] = [];
	const paysOf = (clientId: string): PaySpeed =>
		CLIENTS[Number(clientId.slice(4)) - 1]?.pays ?? "normal";
	sorted.forEach((draft, index) => {
		const id = `inv-${index + 1}`;
		const dueDaysAgo = draft.issuedDaysAgo - PAYMENT_TERM_DAYS;
		const pays = paysOf(draft.matter.clientId);
		// Each payment: days after the issue date, and the share of the amount.
		const plan: [number, number][] =
			pays === "fast"
				? [[between(random, 8, 18), 1]]
				: pays === "normal"
					? [[between(random, 18, 38), 1]]
					: pays === "slow"
						? [
								[6, 0.5],
								[between(random, 42, 66), 0.5],
							]
						: draft.issuedDaysAgo > 100
							? [[between(random, 45, 70), 1]]
							: [];
		let paidAmount = 0;
		plan.forEach(([afterDays, share], step) => {
			const paidDaysAgo = draft.issuedDaysAgo - afterDays;
			// A payment of today or later has not happened yet.
			if (paidDaysAgo < 1) {
				return;
			}
			const amount =
				step === plan.length - 1
					? draft.amount - paidAmount
					: Math.round(draft.amount * share);
			paidAmount += amount;
			payments.push({
				id: `pay-${payments.length + 1}`,
				invoiceId: id,
				amount,
				paidAt: iso(atDay(today, paidDaysAgo, between(random, 9, 16))),
			});
		});
		const status: InvoiceStatus =
			paidAmount >= draft.amount
				? "paid"
				: dueDaysAgo > 0
					? "overdue"
					: paidAmount > 0
						? "partial"
						: "sent";
		invoices.push({
			id,
			number: `INV-${1180 + index}`,
			matterId: draft.matter.id,
			clientId: draft.matter.clientId,
			kind: draft.kind,
			issuedAt: iso(atDay(today, draft.issuedDaysAgo, 10)),
			dueAt: iso(atDay(today, dueDaysAgo, 23.98)),
			amount: draft.amount,
			paidAmount,
			status,
		});
		for (const entry of draft.entries) {
			entry.invoiceId = id;
		}
	});
	return { invoices, payments };
}

function buildSampleTables(today: number): SampleTables {
	const random = createRandom(20_240_611);
	const { windows, stageChanges } = buildMatters(today, random);
	const matters = windows.map((window) => window.row);
	const deadlines = buildDeadlines(today, random, matters);
	const timeEntries = buildTimeEntries(today, random, windows);
	const { invoices, payments } = buildInvoices(
		today,
		random,
		matters,
		timeEntries,
	);
	// The fee estimate of an hourly matter follows its logged time, so some matters run close to it.
	for (const matter of matters) {
		if (matter.fee !== "hourly" || matter.stage === "declined") {
			continue;
		}
		const logged = timeEntries
			.filter((entry) => entry.matterId === matter.id)
			.reduce((sum, entry) => sum + entry.amount, 0);
		const [low, high] = matter.closedAt
			? BUDGET_MARGIN.closed
			: BUDGET_MARGIN.open;
		// Round up to the next 2,500 USD, the step a firm quotes in. At least one step.
		matter.budget = Math.max(
			2500,
			Math.ceil((logged * (low + random() * (high - low))) / 2500) * 2500,
		);
	}
	return {
		attorneys: ATTORNEYS,
		clients: CLIENTS.map(({ pays: _pays, ...client }, index) => ({
			id: `cli-${String(index + 1).padStart(2, "0")}`,
			...client,
		})),
		matters,
		stageChanges,
		deadlines,
		timeEntries,
		invoices,
		payments,
	};
}

let cache: { today: number; tables: SampleTables } | null = null;

/** Every sample table, built once per local day. `now` is in milliseconds since 1970. */
export function getSampleTables(now: number = Date.now()): SampleTables {
	const today = startOfLocalDay(now);
	// A cache per day: the rows are stable all day, and a page does not rebuild them on each query.
	if (cache?.today !== today) {
		cache = { today, tables: buildSampleTables(today) };
	}
	return cache.tables;
}
