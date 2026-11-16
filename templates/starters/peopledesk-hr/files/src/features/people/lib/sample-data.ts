// The sample tables of the HR desk: 80 employees, their career events, their time-off requests,
// the open positions, and the candidates. Only the query files (api/*.queries.ts) read them, through readPeopleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every date is an offset in days from the midnight that starts today. A seeded generator makes the same rows all day.
// LIMIT: the window moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import type {
	Contract,
	Department,
	EmployeeStatus,
	PositionStatus,
	Source,
	Stage,
	TimeOffStatus,
	TimeOffType,
	WorkLocation,
} from "./codes";
import {
	HOUR_MS,
	isWeekend,
	MINUTE_MS,
	shiftDays,
	startOfLocalDay,
	toDayKey,
} from "./time";

/** One employee. Days are YYYY-MM-DD in the browser time zone. */
export type EmployeeRow = {
	/** The employee number, for example "PD-1042". Also the `$employeeId` of the profile route. */
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	title: string;
	department: Department;
	/** The id of the line manager. null only for the chief executive. */
	managerId: string | null;
	location: WorkLocation;
	contract: Contract;
	/** Contract hours per week. 40 is full time. */
	weeklyHours: number;
	/** The first working day. */
	startDate: string;
	/** The last working day: the end of a fixed contract, or the last day of a leaver. null when open-ended. */
	endDate: string | null;
	status: EmployeeStatus;
	/** Paid vacation days per calendar year, before the pro rata of a first year. */
	annualAllowance: number;
};

/** The kinds of career event on the timeline of a profile. Labels: `careerEvents.<kind>`. */
export type CareerEventKind =
	| "joined"
	| "probation_passed"
	| "promoted"
	| "notice_given"
	| "leave_started";

/** One event of the career of an employee. */
export type CareerEventRow = {
	id: string;
	employeeId: string;
	kind: CareerEventKind;
	/** The day of the event, YYYY-MM-DD. */
	day: string;
	/** The job title after the event, for "joined" and "promoted". null for the other kinds. */
	title: string | null;
	/** The job title before a promotion. null for the other kinds. */
	previousTitle: string | null;
};

/** One time-off request. A request covers whole working days from `startDate` to `endDate`. */
export type TimeOffRequestRow = {
	/** The request number, for example "TO-4127". Also the `?request=` value of the time-off page. */
	id: string;
	employeeId: string;
	type: TimeOffType;
	status: TimeOffStatus;
	/** The first day off, YYYY-MM-DD. */
	startDate: string;
	/** The last day off, YYYY-MM-DD. */
	endDate: string;
	/** Working days off, Monday to Friday, between the two days. */
	days: number;
	/** The time of the request, as ISO. Always before today. */
	submittedAt: string;
	/** The time of the approval, the refusal, or the cancellation, as ISO. null while pending. */
	decidedAt: string | null;
	/** The person who decided: the manager, or the employee for a cancellation. null while pending. */
	decidedById: string | null;
	/** The message of the employee, or null. */
	note: string | null;
	/** The reason of a refusal, or null. */
	decisionNote: string | null;
};

/** One position that the company hires for. */
export type PositionRow = {
	/** The requisition number, for example "REQ-118". Also the `?position=` value of the hiring page. */
	id: string;
	title: string;
	department: Department;
	/** The employee who decides the hire. */
	hiringManagerId: string;
	location: WorkLocation;
	status: PositionStatus;
	/** The day the position opened, YYYY-MM-DD. */
	openedAt: string;
	/** The day of the hire (filled) or of the pause (on hold), YYYY-MM-DD. null while open. */
	closedAt: string | null;
};

/** One move of a candidate to a stage, with its time as ISO. */
export type StageChange = { stage: Stage; at: string };

/** One candidate: one application to one position. */
export type CandidateRow = {
	/** The application number, for example "CA-5120". Also the `?candidate=` value of the hiring page. */
	id: string;
	name: string;
	positionId: string;
	source: Source;
	/** The time of the application, as ISO. */
	appliedAt: string;
	/** The current stage. It equals the stage of the last change. */
	stage: Stage;
	/** Every stage of the application, oldest first. The first entry is "applied". */
	stageChanges: StageChange[];
	/** The score of the last interviewer, 1 to 5. null before the screening. */
	rating: number | null;
	/** The next interview, as ISO, for a candidate at the interview stage of an open position. Else null. */
	interviewAt: string | null;
	/** Years of work in the field, from the application. */
	experienceYears: number;
	/** The current job, from the application. */
	currentRole: string;
};

/** Every sample table. The query files sort, filter, and join them. */
export type PeopleTables = {
	/** The midnight that starts today, in milliseconds since 1970. */
	dayStart: number;
	employees: EmployeeRow[];
	careerEvents: CareerEventRow[];
	requests: TimeOffRequestRow[];
	positions: PositionRow[];
	candidates: CandidateRow[];
};

// History of time off, in days before today. One calendar year back, plus a margin, so a yearly balance is complete.
const HISTORY_DAYS = 400;
// People book time off up to two months ahead. Later vacations do not exist yet.
const BOOKING_HORIZON_DAYS = 60;
// A new employee is on probation for six months.
const PROBATION_DAYS = 182;
// The fictional mail domain of the company. The .example top-level domain never resolves.
const MAIL_DOMAIN = "larkfield.example";

// One job of the org chart. `count` people hold it. `reportsTo` names the role of their managers.
type RoleSpec = {
	key: string;
	title: string;
	department: Department;
	count: number;
	reportsTo: string | null;
	/** Gives the range of tenure and the vacation lead time. */
	level: "lead" | "senior" | "mid" | "junior" | "intern";
	/** The title before a promotion into this role. A long tenure in the role makes the promotion likely. */
	promotedFrom?: string;
};

// The org chart of the 80 people, managers first. A role reports to a role listed above it.
const ROLES: RoleSpec[] = [
	{
		key: "ceo",
		title: "Chief Executive Officer",
		department: "operations",
		count: 1,
		reportsTo: null,
		level: "lead",
	},
	{
		key: "head_people",
		title: "Head of People",
		department: "people_finance",
		count: 1,
		reportsTo: "ceo",
		level: "lead",
	},
	{
		key: "head_eng",
		title: "Head of Engineering",
		department: "engineering",
		count: 1,
		reportsTo: "ceo",
		level: "lead",
		promotedFrom: "Engineering Manager",
	},
	{
		key: "head_product",
		title: "Head of Product",
		department: "product",
		count: 1,
		reportsTo: "ceo",
		level: "lead",
		promotedFrom: "Senior Product Manager",
	},
	{
		key: "head_sales",
		title: "Head of Sales",
		department: "sales",
		count: 1,
		reportsTo: "ceo",
		level: "lead",
	},
	{
		key: "head_cs",
		title: "Head of Customer Success",
		department: "customer_success",
		count: 1,
		reportsTo: "ceo",
		level: "lead",
		promotedFrom: "Customer Success Manager",
	},
	{
		key: "head_ops",
		title: "Head of Operations",
		department: "operations",
		count: 1,
		reportsTo: "ceo",
		level: "lead",
	},
	{
		key: "finance_manager",
		title: "Finance Manager",
		department: "people_finance",
		count: 1,
		reportsTo: "ceo",
		level: "lead",
		promotedFrom: "Accountant",
	},
	{
		key: "em",
		title: "Engineering Manager",
		department: "engineering",
		count: 2,
		reportsTo: "head_eng",
		level: "lead",
		promotedFrom: "Senior Software Engineer",
	},
	{
		key: "staff",
		title: "Staff Engineer",
		department: "engineering",
		count: 1,
		reportsTo: "head_eng",
		level: "senior",
		promotedFrom: "Senior Software Engineer",
	},
	{
		key: "devops",
		title: "DevOps Engineer",
		department: "engineering",
		count: 2,
		reportsTo: "head_eng",
		level: "mid",
	},
	{
		key: "senior_swe",
		title: "Senior Software Engineer",
		department: "engineering",
		count: 6,
		reportsTo: "em",
		level: "senior",
		promotedFrom: "Software Engineer",
	},
	{
		key: "swe",
		title: "Software Engineer",
		department: "engineering",
		count: 8,
		reportsTo: "em",
		level: "mid",
		promotedFrom: "Junior Software Engineer",
	},
	{
		key: "qa",
		title: "QA Engineer",
		department: "engineering",
		count: 2,
		reportsTo: "em",
		level: "mid",
	},
	{
		key: "junior_swe",
		title: "Junior Software Engineer",
		department: "engineering",
		count: 2,
		reportsTo: "em",
		level: "junior",
	},
	{
		key: "pm",
		title: "Product Manager",
		department: "product",
		count: 3,
		reportsTo: "head_product",
		level: "senior",
	},
	{
		key: "designer",
		title: "Product Designer",
		department: "product",
		count: 3,
		reportsTo: "head_product",
		level: "mid",
	},
	{
		key: "researcher",
		title: "UX Researcher",
		department: "product",
		count: 1,
		reportsTo: "head_product",
		level: "mid",
	},
	{
		key: "content",
		title: "Content Designer",
		department: "product",
		count: 1,
		reportsTo: "head_product",
		level: "mid",
	},
	{
		key: "design_intern",
		title: "Design Intern",
		department: "product",
		count: 1,
		reportsTo: "designer",
		level: "intern",
	},
	{
		key: "sales_manager",
		title: "Sales Manager",
		department: "sales",
		count: 1,
		reportsTo: "head_sales",
		level: "lead",
		promotedFrom: "Account Executive",
	},
	{
		key: "ae",
		title: "Account Executive",
		department: "sales",
		count: 6,
		reportsTo: "sales_manager",
		level: "mid",
		promotedFrom: "Sales Development Representative",
	},
	{
		key: "sdr",
		title: "Sales Development Representative",
		department: "sales",
		count: 4,
		reportsTo: "sales_manager",
		level: "junior",
	},
	{
		key: "sales_ops",
		title: "Sales Operations Analyst",
		department: "sales",
		count: 1,
		reportsTo: "head_sales",
		level: "mid",
	},
	{
		key: "sales_intern",
		title: "Sales Intern",
		department: "sales",
		count: 1,
		reportsTo: "sales_manager",
		level: "intern",
	},
	{
		key: "support_lead",
		title: "Support Team Lead",
		department: "customer_success",
		count: 1,
		reportsTo: "head_cs",
		level: "lead",
		promotedFrom: "Support Specialist",
	},
	{
		key: "csm",
		title: "Customer Success Manager",
		department: "customer_success",
		count: 5,
		reportsTo: "head_cs",
		level: "mid",
	},
	{
		key: "support",
		title: "Support Specialist",
		department: "customer_success",
		count: 5,
		reportsTo: "support_lead",
		level: "junior",
	},
	{
		key: "onboarding",
		title: "Onboarding Specialist",
		department: "customer_success",
		count: 1,
		reportsTo: "head_cs",
		level: "mid",
	},
	{
		key: "office",
		title: "Office Manager",
		department: "operations",
		count: 2,
		reportsTo: "head_ops",
		level: "mid",
	},
	{
		key: "analyst",
		title: "Data Analyst",
		department: "operations",
		count: 2,
		reportsTo: "head_ops",
		level: "mid",
	},
	{
		key: "it",
		title: "IT Administrator",
		department: "operations",
		count: 2,
		reportsTo: "head_ops",
		level: "mid",
	},
	{
		key: "ea",
		title: "Executive Assistant",
		department: "operations",
		count: 1,
		reportsTo: "ceo",
		level: "mid",
	},
	{
		key: "legal",
		title: "Legal Counsel",
		department: "operations",
		count: 1,
		reportsTo: "ceo",
		level: "senior",
	},
	{
		key: "procurement",
		title: "Procurement Specialist",
		department: "operations",
		count: 1,
		reportsTo: "head_ops",
		level: "mid",
	},
	{
		key: "hr",
		title: "HR Generalist",
		department: "people_finance",
		count: 2,
		reportsTo: "head_people",
		level: "mid",
	},
	{
		key: "recruiter",
		title: "Recruiter",
		department: "people_finance",
		count: 2,
		reportsTo: "head_people",
		level: "mid",
	},
	{
		key: "accountant",
		title: "Accountant",
		department: "people_finance",
		count: 1,
		reportsTo: "finance_manager",
		level: "mid",
	},
	{
		key: "payroll",
		title: "Payroll Specialist",
		department: "people_finance",
		count: 1,
		reportsTo: "finance_manager",
		level: "mid",
	},
];

// Tenure range per level, in days before today. The chief executive founded the company.
const TENURE_DAYS: Record<RoleSpec["level"], [number, number]> = {
	lead: [900, 3100],
	senior: [420, 2600],
	mid: [70, 2100],
	junior: [20, 720],
	intern: [25, 140],
};

// Fictional first names. Employees take 80 different ones; candidates draw from the rest and repeat.
const FIRST_NAMES = [
	"Amara",
	"Jonas",
	"Ines",
	"Mateo",
	"Priya",
	"Lukas",
	"Sofia",
	"Kwame",
	"Hana",
	"Elias",
	"Noor",
	"Tomas",
	"Leila",
	"Oskar",
	"Yara",
	"Rafael",
	"Mei",
	"Anton",
	"Zara",
	"Felix",
	"Chiara",
	"Idris",
	"Maren",
	"Diego",
	"Aiko",
	"Henrik",
	"Lucia",
	"Samir",
	"Freya",
	"Bruno",
	"Nadia",
	"Emil",
	"Rosa",
	"Kenji",
	"Alma",
	"Viktor",
	"Selin",
	"Joao",
	"Ingrid",
	"Omar",
	"Clara",
	"Arjun",
	"Elif",
	"Marek",
	"Tessa",
	"Malik",
	"Greta",
	"Nikolai",
	"Imani",
	"Pablo",
	"Astrid",
	"Dario",
	"Lina",
	"Tobias",
	"Femi",
	"Carmen",
	"Hugo",
	"Sana",
	"Milan",
	"Paula",
	"Rui",
	"Elena",
	"Kofi",
	"Vera",
	"Anders",
	"Leah",
	"Ravi",
	"Julia",
	"Stefan",
	"Ayla",
	"Teodor",
	"Beatriz",
	"Nils",
	"Dalia",
	"Marco",
	"Hedda",
	"Yusuf",
	"Marta",
	"Linus",
	"Esme",
	"Adrian",
	"Mila",
	"Caio",
	"Nora",
	"Ilias",
	"Petra",
	"Ruben",
	"Saskia",
	"Tariq",
	"Ada",
	"Gustav",
	"Lorena",
	"Haruto",
	"Wanda",
	"Emre",
	"Livia",
	"Soren",
	"Dina",
	"Fabio",
	"Rina",
	"Kai",
	"Olga",
	"Mattias",
	"Zainab",
	"Leon",
	"Irene",
	"Bastian",
	"Amina",
	"Vasco",
	"Thea",
	"Andrei",
	"Lea",
	"Nico",
	"Farah",
	"Jakob",
	"Celia",
	"Ivo",
	"Maya",
	"Otto",
	"Sara",
	"Ewan",
	"Lucie",
	"Danilo",
	"Hanne",
	"Rowan",
	"Aurora",
	"Iker",
	"Selma",
	"Theo",
	"Naomi",
];

// Fictional last names. A full name never repeats in the tables.
const LAST_NAMES = [
	"Okafor",
	"Brandt",
	"Carvalho",
	"Ferreira",
	"Raman",
	"Hoffmann",
	"Marchetti",
	"Mensah",
	"Sato",
	"Lindqvist",
	"Haddad",
	"Novak",
	"Bergström",
	"Alves",
	"Kowalski",
	"Moreau",
	"Nakamura",
	"Petrov",
	"Rahman",
	"Schulz",
	"Costa",
	"Adeyemi",
	"Fischer",
	"Santos",
	"Ivanova",
	"Keller",
	"Lopes",
	"Chen",
	"Dubois",
	"Eriksen",
	"Ghosh",
	"Horvat",
	"Jansen",
	"Kaya",
	"Lemaire",
	"Mendes",
	"Nilsson",
	"Oliveira",
	"Popescu",
	"Quintero",
	"Rossi",
	"Silva",
	"Takahashi",
	"Urban",
	"Vidal",
	"Weber",
	"Yilmaz",
	"Zielinski",
	"Abiodun",
	"Bauer",
	"Castillo",
	"Demir",
	"Esposito",
	"Falk",
	"Gomes",
	"Hartmann",
	"Iqbal",
	"Jovanovic",
	"Kruger",
	"Larsen",
	"Mazur",
	"Nunes",
	"Ortega",
	"Pereira",
	"Ramos",
	"Sorensen",
	"Torres",
	"Ueda",
	"Varga",
	"Wagner",
	"Andersen",
	"Barbosa",
	"Cardoso",
	"Dahl",
	"Engel",
	"Fontaine",
	"Gallo",
	"Holm",
	"Ibrahim",
	"Jensen",
	"Kaur",
	"Lund",
	"Molina",
	"Nowak",
	"Osei",
	"Pinto",
	"Ribeiro",
	"Strand",
	"Teixeira",
	"Vogel",
	"Winter",
	"Aksoy",
	"Brennan",
	"Coelho",
	"Duarte",
	"Engstrom",
	"Farouk",
	"Galvao",
	"Hayes",
	"Ilic",
	"Jaramillo",
	"Kimura",
	"Lowe",
	"Moretti",
	"Nascimento",
	"Oyelaran",
	"Pacheco",
	"Reyes",
	"Sandoval",
	"Tamura",
];

// The notes that employees add to some vacation requests.
const VACATION_NOTES = [
	"Family trip, booked last month.",
	"Wedding of my sister.",
	"Moving to a new flat.",
	"School holidays of the kids.",
	"Hiking week in the mountains.",
	"Visiting my parents.",
	"Handover notes are in the team folder.",
];

// The notes of other request types, by type. Sick and parental leave keep no note.
const PERSONAL_NOTES = [
	"Appointment at the city hall.",
	"Funeral of a relative.",
	"Driving test.",
	"Closing day at the notary.",
];

// The reasons of a manager who declines a vacation request.
const DECLINE_REASONS = [
	"Two people of the team are already out that week.",
	"It overlaps the quarter close. Can you move it by one week?",
	"Release week: please pick other days.",
	"The customer workshop is on these days.",
];

/** Seeded generator (mulberry32): the same seed gives the same numbers, so the rows stay stable. */
function createRandom(seed: number) {
	let state = seed >>> 0;
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
	return {
		next,
		/** An integer from `min` to `max`, both included. */
		int: (min: number, max: number) =>
			min + Math.floor(next() * (max - min + 1)),
		chance: (probability: number) => next() < probability,
		pick: <Item>(list: readonly Item[]): Item => {
			const item = list[Math.floor(next() * list.length)];
			if (item === undefined) {
				throw new Error("pick() needs a list with at least one item.");
			}
			return item;
		},
	};
}

type Random = ReturnType<typeof createRandom>;

/** The builder of one table set: the generator, today, and the date helpers bound to today. */
type Context = {
	random: Random;
	dayStart: number;
	/** The YYYY-MM-DD key of a day offset (0 is today, -1 yesterday). */
	day: (offset: number) => string;
	/** The ISO time of a day offset plus minutes after midnight. */
	at: (offset: number, minutes: number) => string;
	/** True for Saturday and Sunday. */
	weekend: (offset: number) => boolean;
	/** The month (0 to 11) of a day offset. */
	month: (offset: number) => number;
};

function createContext(dayStart: number): Context {
	return {
		random: createRandom(20_261_114),
		dayStart,
		day: (offset) => toDayKey(shiftDays(dayStart, offset)),
		at: (offset, minutes) =>
			new Date(
				shiftDays(dayStart, offset).getTime() + minutes * MINUTE_MS,
			).toISOString(),
		weekend: (offset) => isWeekend(shiftDays(dayStart, offset)),
		month: (offset) => shiftDays(dayStart, offset).getMonth(),
	};
}

// The first weekday at or after `offset`.
function nextWeekday(context: Context, offset: number): number {
	let day = offset;
	while (context.weekend(day)) {
		day += 1;
	}
	return day;
}

// The offsets of `count` working days from `start` (a weekday). Weekends inside the block are skipped.
function workingDays(context: Context, start: number, count: number): number[] {
	const days: number[] = [];
	for (let day = start; days.length < count; day += 1) {
		if (!context.weekend(day)) {
			days.push(day);
		}
	}
	return days;
}

// Minutes after midnight in a range of hours, with a random minute.
function minutesBetween(
	random: Random,
	fromHour: number,
	toHour: number,
): number {
	return random.int(fromHour * 60, toHour * 60 - 1);
}

// Unique full names, assigned in order. A first name never repeats in the last `gap` names.
function createNamePicker(random: Random) {
	const used = new Set<string>();
	const recent: string[] = [];
	return (firstNames: readonly string[], gap: number) => {
		for (;;) {
			const first = random.pick(firstNames);
			const last = random.pick(LAST_NAMES);
			const full = `${first} ${last}`;
			if (used.has(full) || recent.includes(first)) {
				continue;
			}
			used.add(full);
			recent.push(first);
			if (recent.length > gap) {
				recent.shift();
			}
			return { first, last };
		}
	};
}

// The mail address of a person: "first.last" in plain Latin letters.
function mailOf(first: string, last: string): string {
	const local = `${first}.${last}`
		.normalize("NFD")
		.replace(/[^A-Za-z.]/g, "")
		.toLowerCase();
	return `${local}@${MAIL_DOMAIN}`;
}

/** One employee before the status pass, with the role that placed it. */
type EmployeeDraft = EmployeeRow & { role: RoleSpec; startOffset: number };

function buildEmployees(
	context: Context,
	pickName: ReturnType<typeof createNamePicker>,
): EmployeeDraft[] {
	const { random } = context;
	const employees: EmployeeDraft[] = [];
	// Each employee takes a first name of its own, so no list shows the same first name twice.
	const freeFirstNames = [...FIRST_NAMES];
	const byRole = new Map<string, EmployeeDraft[]>();
	let number = 1001;
	let officeIndex = 0;
	for (const role of ROLES) {
		const holders: EmployeeDraft[] = [];
		const managers = role.reportsTo ? (byRole.get(role.reportsTo) ?? []) : [];
		for (let index = 0; index < role.count; index += 1) {
			const firstIndex = random.int(0, freeFirstNames.length - 1);
			const [first] = freeFirstNames.splice(firstIndex, 1);
			if (first === undefined) {
				throw new Error("The first name pool is smaller than the org chart.");
			}
			const { last } = pickName([first], 0);
			const [minTenure, maxTenure] = TENURE_DAYS[role.level];
			// The founder joined first; everyone else joined on a Monday.
			const tenure =
				role.key === "ceo" ? 3400 : random.int(minTenure, maxTenure);
			const startOffset = nextWeekday(context, -tenure);
			const isPartTime = role.level !== "intern" && random.chance(0.1);
			const weeklyHours = isPartTime ? 32 : 40;
			// An intern stays six months. A recent junior can have a one-year contract.
			const contract: Contract =
				role.level === "intern"
					? "intern"
					: role.level === "junior" && tenure < 300 && random.chance(0.5)
						? "fixed_term"
						: "permanent";
			const endDate =
				contract === "intern"
					? context.day(startOffset + 182)
					: contract === "fixed_term"
						? context.day(startOffset + 365)
						: null;
			// The two office managers run one office each.
			const location: WorkLocation =
				role.key === "office"
					? officeIndex++ === 0
						? "lisbon"
						: "berlin"
					: random.chance(0.5)
						? "lisbon"
						: random.chance(0.6)
							? "berlin"
							: "remote";
			const manager = managers[index % Math.max(1, managers.length)];
			const employee: EmployeeDraft = {
				id: `PD-${number}`,
				firstName: first,
				lastName: last,
				email: mailOf(first, last),
				title: role.title,
				department: role.department,
				managerId: manager?.id ?? null,
				location,
				contract,
				weeklyHours,
				startDate: context.day(startOffset),
				endDate,
				status: "active",
				// 25 days for full time, pro rata for part time.
				annualAllowance: Math.round((25 * weeklyHours) / 40),
				role,
				startOffset,
			};
			number += 1;
			holders.push(employee);
			employees.push(employee);
		}
		byRole.set(role.key, holders);
	}
	return employees;
}

/** One block of days off before it becomes a request. */
type LeaveBlock = {
	type: TimeOffType;
	/** The offsets of the working days off. */
	days: number[];
	/** Days since a request that waits for its manager. Absent: the lead time and the decision lag decide. */
	askedDaysAgo?: number;
};

// Vacation weight per month (0 is January): summer and the year end are busy, spring is a little busy.
const VACATION_MONTH_WEIGHT = [
	0.6, 0.6, 0.8, 1.2, 1.2, 1.4, 2.6, 3, 1, 0.8, 0.7, 2.2,
];
// Sick weight per month: the winter months have more colds.
const SICK_MONTH_WEIGHT = [
	2, 2, 1.4, 1, 0.8, 0.6, 0.5, 0.5, 0.8, 1.2, 1.5, 1.8,
];

// A weekday in [from, to] that the month weights favor. Rejection sampling keeps the code short.
function weightedDay(
	context: Context,
	from: number,
	to: number,
	weights: readonly number[],
): number {
	const top = Math.max(...weights);
	for (;;) {
		const offset = context.random.int(from, to);
		const weight = weights[context.month(offset)] ?? 1;
		if (context.random.next() * top < weight) {
			return nextWeekday(context, offset);
		}
	}
}

// Adds a block when none of its days is taken. Returns false when it overlaps.
function tryAddBlock(
	taken: Set<number>,
	blocks: LeaveBlock[],
	block: LeaveBlock,
): boolean {
	if (block.days.some((day) => taken.has(day))) {
		return false;
	}
	for (const day of block.days) {
		taken.add(day);
	}
	blocks.push(block);
	return true;
}

// The calendar offsets of 1 January and 31 December of the year of `offset`.
function yearBounds(context: Context, offset: number): [number, number] {
	const year = shiftDays(context.dayStart, offset).getFullYear();
	const toOffset = (date: Date) =>
		Math.round((date.getTime() - context.dayStart) / (24 * HOUR_MS));
	return [toOffset(new Date(year, 0, 1)), toOffset(new Date(year, 11, 31))];
}

// The leave blocks of one employee: parental leave, vacations per calendar year, sick days, personal days.
function buildLeaveBlocks(
	context: Context,
	employee: EmployeeDraft,
	isOnParentalLeave: boolean,
): LeaveBlock[] {
	const { random } = context;
	const taken = new Set<number>();
	const blocks: LeaveBlock[] = [];
	const lastOffset = employee.endDate
		? Math.round(
				(new Date(`${employee.endDate}T12:00:00`).getTime() -
					context.dayStart) /
					(24 * HOUR_MS),
			)
		: BOOKING_HORIZON_DAYS;
	const from = Math.max(-HISTORY_DAYS, employee.startOffset + 14);
	const to = Math.min(BOOKING_HORIZON_DAYS, lastOffset);
	if (from >= to) {
		return blocks;
	}
	if (isOnParentalLeave) {
		const start = nextWeekday(context, -random.int(30, 70));
		tryAddBlock(taken, blocks, {
			type: "parental",
			days: workingDays(context, start, random.int(80, 110)),
		});
	}
	// Vacations: each calendar year gets about its allowance, pro rata from the start date.
	for (let yearStart = yearBounds(context, from)[0]; yearStart <= to; ) {
		const [, yearEnd] = yearBounds(context, yearStart);
		const employedFrom = Math.max(yearStart, employee.startOffset + 14);
		const share = (yearEnd - employedFrom + 1) / (yearEnd - yearStart + 1);
		let remaining = Math.max(
			0,
			Math.round(employee.annualAllowance * share) - random.int(0, 3),
		);
		for (let attempt = 0; remaining > 0 && attempt < 40; attempt += 1) {
			const length = Math.min(
				remaining,
				random.pick([10, 5, 5, 4, 3, 3, 2, 1]),
			);
			const start = weightedDay(
				context,
				employedFrom,
				yearEnd,
				VACATION_MONTH_WEIGHT,
			);
			const days = workingDays(context, start, length);
			const last = days[days.length - 1] ?? start;
			// A block outside the window is in the past history or not booked yet: it uses the allowance, but no row.
			if (start >= from && last <= to) {
				if (tryAddBlock(taken, blocks, { type: "vacation", days })) {
					remaining -= length;
				}
			} else {
				remaining -= length;
			}
		}
		yearStart = yearEnd + 1;
	}
	// Sick days: one to five episodes in the history. A sick day starts yesterday at the latest.
	const sickTo = Math.min(-1, to);
	for (
		let episode = random.int(1, 5);
		episode > 0 && from < sickTo;
		episode -= 1
	) {
		const start = weightedDay(context, from, sickTo, SICK_MONTH_WEIGHT);
		if (start > sickTo) {
			continue;
		}
		tryAddBlock(taken, blocks, {
			type: "sick",
			days: workingDays(context, start, random.pick([1, 1, 1, 2, 2, 3, 5])),
		});
	}
	// Personal days: an appointment, a move, a funeral.
	for (let count = random.int(0, 3); count > 0; count -= 1) {
		tryAddBlock(taken, blocks, {
			type: "personal",
			days: [nextWeekday(context, random.int(from, Math.max(from, to - 3)))],
		});
	}
	// About one person in twenty asked for days off this week, and the manager has not answered yet.
	if (to > 20 && random.chance(0.05)) {
		const start = nextWeekday(context, random.int(7, Math.min(45, to - 5)));
		tryAddBlock(taken, blocks, {
			type: random.chance(0.8) ? "vacation" : "personal",
			days: workingDays(context, start, random.pick([1, 2, 3, 5])),
			askedDaysAgo: random.int(1, 4),
		});
	}
	// Unpaid leave is rare: about one person in twenty takes a few days.
	if (random.chance(0.06)) {
		const start = nextWeekday(
			context,
			random.int(from, Math.max(from, to - 7)),
		);
		tryAddBlock(taken, blocks, {
			type: "unpaid",
			days: workingDays(context, start, random.int(3, 5)),
		});
	}
	// A leaver takes no leave after the last day. A long leave of a stayer can end after the booking horizon.
	return blocks.filter((block) => {
		const last = block.days[block.days.length - 1] ?? 0;
		return employee.endDate === null || last <= lastOffset;
	});
}

// Days between the request and the first day off, per type and length.
function leadDays(context: Context, block: LeaveBlock): number {
	const { random } = context;
	switch (block.type) {
		case "vacation": {
			// Summer and the year end are booked early, before the team calendar fills.
			const month = context.month(block.days[0] ?? 0);
			const isPeak = month === 6 || month === 7 || month === 11 || month === 0;
			return isPeak
				? random.int(30, 90)
				: block.days.length >= 5
					? random.int(15, 60)
					: random.int(4, 30);
		}
		case "personal":
			return random.int(1, 10);
		case "unpaid":
			return random.int(10, 40);
		case "parental":
			return random.int(45, 90);
		case "sick":
			return 0;
	}
}

function buildRequests(
	context: Context,
	employees: EmployeeDraft[],
	onParentalLeave: Set<string>,
): TimeOffRequestRow[] {
	const { random } = context;
	// The chief executive has no manager: the Head of People decides those requests.
	const headOfPeople = employees.find(
		(employee) => employee.role.key === "head_people",
	);
	const drafts: Omit<TimeOffRequestRow, "id">[] = [];
	for (const employee of employees) {
		const approverId = employee.managerId ?? headOfPeople?.id ?? employee.id;
		for (const block of buildLeaveBlocks(
			context,
			employee,
			onParentalLeave.has(employee.id),
		)) {
			const start = block.days[0] ?? 0;
			const end = block.days[block.days.length - 1] ?? start;
			const submitted =
				block.askedDaysAgo === undefined
					? Math.max(start - leadDays(context, block), employee.startOffset)
					: -block.askedDaysAgo;
			// A request is never newer than yesterday: rows of today would change with the clock.
			// A later request does not exist yet, so the leave is not booked.
			if (submitted > -1) {
				continue;
			}
			const isSick = block.type === "sick";
			// A sick employee calls in before work. Other requests come during the day.
			const submittedMinutes = isSick
				? minutesBetween(random, 7, 9)
				: minutesBetween(random, 9, 17);
			// A started leave was decided before its first day.
			const lag = isSick ? 0 : (block.askedDaysAgo ?? random.int(0, 6));
			const decided =
				start <= 0 ? Math.min(submitted + lag, start - 1) : submitted + lag;
			const decidedDay = isSick ? submitted : Math.max(decided, submitted);
			const isPending = decidedDay >= 0;
			const decidedMinutes =
				decidedDay === submitted
					? random.int(submittedMinutes + 20, 18 * 60)
					: minutesBetween(random, 8, 18);
			let status: TimeOffStatus = isPending ? "pending" : "approved";
			let decidedById: string | null = isPending ? null : approverId;
			let decisionNote: string | null = null;
			let decidedAt = isPending ? null : context.at(decidedDay, decidedMinutes);
			const canBeRefused =
				block.type === "vacation" || block.type === "personal";
			if (!isPending && canBeRefused && random.chance(0.06)) {
				status = "declined";
				decisionNote = random.pick(DECLINE_REASONS);
			} else if (
				!isPending &&
				canBeRefused &&
				start - decidedDay > 3 &&
				random.chance(0.04)
			) {
				// The employee cancels some days later, before the leave starts.
				const cancelDay = Math.min(
					decidedDay + random.int(1, start - decidedDay - 1),
					-1,
				);
				if (cancelDay > decidedDay) {
					status = "cancelled";
					decidedById = employee.id;
					decidedAt = context.at(cancelDay, minutesBetween(random, 8, 20));
				}
			}
			const note =
				block.type === "vacation" && random.chance(0.35)
					? random.pick(VACATION_NOTES)
					: block.type === "personal" && random.chance(0.6)
						? random.pick(PERSONAL_NOTES)
						: null;
			drafts.push({
				employeeId: employee.id,
				type: block.type,
				status,
				startDate: context.day(start),
				endDate: context.day(end),
				days: block.days.length,
				submittedAt: context.at(submitted, submittedMinutes),
				decidedAt,
				decidedById,
				note,
				decisionNote,
			});
		}
	}
	// Numbers follow the order of the requests, like a database sequence.
	drafts.sort((first, second) =>
		first.submittedAt.localeCompare(second.submittedAt),
	);
	return drafts.map((draft, index) => ({ id: `TO-${4001 + index}`, ...draft }));
}

// Statuses that do not come from the time off: two leavers and the people on parental leave.
function assignStatuses(
	context: Context,
	employees: EmployeeDraft[],
	onParentalLeave: Set<string>,
	leavers: Map<string, { noticeOffset: number; lastOffset: number }>,
) {
	for (const employee of employees) {
		const leaver = leavers.get(employee.id);
		if (leaver) {
			employee.status = "notice";
			employee.endDate = context.day(leaver.lastOffset);
		} else if (onParentalLeave.has(employee.id)) {
			employee.status = "on_leave";
		} else if (-employee.startOffset < PROBATION_DAYS) {
			employee.status = "probation";
		}
	}
}

function buildCareerEvents(
	context: Context,
	employees: EmployeeDraft[],
	requests: TimeOffRequestRow[],
	leavers: Map<string, { noticeOffset: number; lastOffset: number }>,
): CareerEventRow[] {
	const { random } = context;
	const events: Omit<CareerEventRow, "id">[] = [];
	for (const employee of employees) {
		const tenure = -employee.startOffset;
		const promotedFrom = employee.role.promotedFrom;
		// A long tenure in a senior role often started one step below.
		const promotionOffset =
			promotedFrom && tenure > 700 && random.chance(0.6)
				? nextWeekday(
						context,
						employee.startOffset + random.int(365, tenure - 120),
					)
				: null;
		events.push({
			employeeId: employee.id,
			kind: "joined",
			day: employee.startDate,
			title:
				promotionOffset !== null && promotedFrom
					? promotedFrom
					: employee.title,
			previousTitle: null,
		});
		if (tenure >= PROBATION_DAYS) {
			events.push({
				employeeId: employee.id,
				kind: "probation_passed",
				day: context.day(
					nextWeekday(context, employee.startOffset + PROBATION_DAYS),
				),
				title: null,
				previousTitle: null,
			});
		}
		if (promotionOffset !== null && promotedFrom) {
			events.push({
				employeeId: employee.id,
				kind: "promoted",
				day: context.day(promotionOffset),
				title: employee.title,
				previousTitle: promotedFrom,
			});
		}
		const leaver = leavers.get(employee.id);
		if (leaver) {
			events.push({
				employeeId: employee.id,
				kind: "notice_given",
				day: context.day(leaver.noticeOffset),
				title: null,
				previousTitle: null,
			});
		}
		const parental = requests.find(
			(request) =>
				request.employeeId === employee.id && request.type === "parental",
		);
		if (employee.status === "on_leave" && parental) {
			events.push({
				employeeId: employee.id,
				kind: "leave_started",
				day: parental.startDate,
				title: null,
				previousTitle: null,
			});
		}
	}
	return events.map((event, index) => ({ id: `EV-${index + 1}`, ...event }));
}

// One position of the hiring plan. Offsets are days before today.
type PositionSpec = {
	id: string;
	title: string;
	department: Department;
	/** The role key of the hiring manager in ROLES. */
	managerRole: string;
	location: WorkLocation;
	status: PositionStatus;
	openedDaysAgo: number;
	/** Days ago of the hire or of the pause. */
	closedDaysAgo?: number;
	/** Mean applications per weekday. */
	applicationsPerDay: number;
	/** Years of experience of the applicants, as a range. */
	experience: [number, number];
	/** The current jobs that applicants write: 8 to 10, so a board column never repeats one. */
	currentRoles: string[];
};

const POSITION_SPECS: PositionSpec[] = [
	{
		id: "REQ-118",
		title: "Senior Backend Engineer",
		department: "engineering",
		managerRole: "em",
		location: "lisbon",
		status: "open",
		openedDaysAgo: 41,
		applicationsPerDay: 0.9,
		experience: [5, 14],
		currentRoles: [
			"Backend engineer at a payments company",
			"Software engineer at a travel platform",
			"Platform engineer at a bank",
			"Senior developer at an agency",
			"Site reliability engineer at a game studio",
			"Java developer at an insurer",
			"Data engineer at a logistics firm",
			"Tech lead at a food delivery startup",
			"Backend developer at a ticketing platform",
		],
	},
	{
		id: "REQ-121",
		title: "Product Designer",
		department: "product",
		managerRole: "head_product",
		location: "remote",
		status: "open",
		openedDaysAgo: 26,
		applicationsPerDay: 0.8,
		experience: [2, 9],
		currentRoles: [
			"Product designer at a health app",
			"UI designer at a studio",
			"Freelance designer",
			"Designer at a media group",
			"UX designer at a car rental company",
			"Interaction designer at a bank",
			"Visual designer at a fashion brand",
			"Service designer at a city council",
			"Junior designer at a SaaS startup",
		],
	},
	{
		id: "REQ-115",
		title: "Account Executive",
		department: "sales",
		managerRole: "sales_manager",
		location: "berlin",
		status: "open",
		openedDaysAgo: 55,
		applicationsPerDay: 0.6,
		experience: [2, 8],
		currentRoles: [
			"Account executive at a software vendor",
			"Sales manager at a print company",
			"Business developer at a startup",
			"Key account manager at a telecom firm",
			"Inside sales lead at a cloud provider",
			"Partner manager at a payroll vendor",
			"Sales consultant at a car dealer group",
			"Account manager at an ad network",
		],
	},
	{
		id: "REQ-124",
		title: "Customer Success Manager",
		department: "customer_success",
		managerRole: "head_cs",
		location: "lisbon",
		status: "open",
		openedDaysAgo: 14,
		applicationsPerDay: 0.9,
		experience: [2, 7],
		currentRoles: [
			"Account manager at a telecom firm",
			"Support lead at a software vendor",
			"Customer success at a startup",
			"Onboarding specialist at a booking platform",
			"Client manager at an accounting firm",
			"Service manager at a hotel group",
			"Implementation consultant at an ERP vendor",
			"Community manager at a fitness app",
		],
	},
	{
		id: "REQ-109",
		title: "Data Analyst",
		department: "operations",
		managerRole: "head_ops",
		location: "berlin",
		status: "on_hold",
		openedDaysAgo: 74,
		closedDaysAgo: 20,
		applicationsPerDay: 0.5,
		experience: [1, 6],
		currentRoles: [
			"Analyst at a retail group",
			"BI developer at an insurer",
			"Junior analyst at a consultancy",
			"Data analyst at a ride-hailing company",
			"Reporting specialist at a bank",
			"Pricing analyst at an airline",
			"Research assistant at a university",
			"Operations analyst at a warehouse firm",
			"Controller at a food producer",
		],
	},
	{
		id: "REQ-126",
		title: "Payroll Specialist",
		department: "people_finance",
		managerRole: "finance_manager",
		location: "lisbon",
		status: "open",
		openedDaysAgo: 9,
		applicationsPerDay: 0.6,
		experience: [2, 10],
		currentRoles: [
			"Payroll officer at a hospital",
			"Accountant at a payroll bureau",
			"HR assistant at a factory",
			"Payroll administrator at a retail chain",
			"Bookkeeper at a family business",
			"Benefits coordinator at a school group",
			"Finance assistant at a law firm",
			"Payroll analyst at a staffing agency",
		],
	},
	{
		id: "REQ-112",
		title: "Frontend Engineer",
		department: "engineering",
		managerRole: "em",
		location: "remote",
		status: "filled",
		openedDaysAgo: 68,
		closedDaysAgo: 6,
		applicationsPerDay: 1,
		experience: [2, 9],
		currentRoles: [
			"Frontend developer at an agency",
			"Web developer at a publisher",
			"Software engineer at a fintech",
			"React developer at an e-commerce shop",
			"UI engineer at a design tool",
			"Full-stack developer at a nonprofit",
			"Mobile developer at a bank",
			"Frontend lead at a travel startup",
			"Junior developer at a web studio",
		],
	},
	{
		id: "REQ-122",
		title: "Sales Development Representative",
		department: "sales",
		managerRole: "sales_manager",
		location: "lisbon",
		status: "open",
		openedDaysAgo: 31,
		applicationsPerDay: 1,
		experience: [0, 3],
		currentRoles: [
			"Graduate in business studies",
			"Call center agent",
			"Retail team leader",
			"Intern at a marketing agency",
			"Sales assistant at an electronics store",
			"Event host at a conference organizer",
			"Receptionist at a gym chain",
			"Language teacher at a private school",
			"Barista and shift lead at a cafe chain",
		],
	},
];

// Source weights: most people apply through the careers site and the job boards.
const SOURCE_POOL: Source[] = [
	"careers_site",
	"careers_site",
	"careers_site",
	"careers_site",
	"careers_site",
	"careers_site",
	"careers_site",
	"job_board",
	"job_board",
	"job_board",
	"job_board",
	"job_board",
	"job_board",
	"referral",
	"referral",
	"referral",
	"outreach",
	"outreach",
	"agency",
];

// The pipeline steps: the next stage, the wait before the decision in days, and the share that passes.
const PIPELINE_STEPS: { next: Stage; wait: [number, number]; pass: number }[] =
	[
		{ next: "screening", wait: [1, 5], pass: 0.45 },
		{ next: "interview", wait: [3, 8], pass: 0.6 },
		{ next: "offer", wait: [5, 12], pass: 0.45 },
		{ next: "hired", wait: [2, 6], pass: 0.75 },
	];

/** One application before it gets a name and a number. */
type CandidateDraft = Omit<CandidateRow, "id" | "name"> & {
	appliedOffset: number;
};

function buildHiring(
	context: Context,
	employees: EmployeeDraft[],
	pickName: ReturnType<typeof createNamePicker>,
): { positions: PositionRow[]; candidates: CandidateRow[] } {
	const { random } = context;
	const positions: PositionRow[] = [];
	const drafts: CandidateDraft[] = [];
	for (const spec of POSITION_SPECS) {
		const manager = employees.find(
			(employee) => employee.role.key === spec.managerRole,
		);
		if (!manager) {
			throw new Error(`No employee holds the role ${spec.managerRole}.`);
		}
		const opened = -spec.openedDaysAgo;
		const closed =
			spec.closedDaysAgo === undefined ? null : -spec.closedDaysAgo;
		positions.push({
			id: spec.id,
			title: spec.title,
			department: spec.department,
			hiringManagerId: manager.id,
			location: spec.location,
			status: spec.status,
			openedAt: context.day(opened),
			closedAt: closed === null ? null : context.day(closed),
		});
		// The last day that can hold a move: yesterday, or the day of the hire or the pause.
		const stop = closed ?? -1;
		const positionDrafts: CandidateDraft[] = [];
		// Adjacent applicants of one post never share a current job: take a shuffled list in order, then cycle.
		const roles = shuffled(random, spec.currentRoles);
		for (let day = opened; day <= stop; day += 1) {
			// A new post draws a first wave. Fewer people apply on weekends.
			const rate =
				spec.applicationsPerDay *
				(context.weekend(day) ? 0.3 : 1) *
				(day - opened < 7 ? 1.8 : 1);
			const count = Math.floor(rate) + (random.chance(rate % 1) ? 1 : 0);
			for (let index = 0; index < count; index += 1) {
				const appliedMinutes = minutesBetween(random, 7, 23);
				const draft: CandidateDraft = {
					positionId: spec.id,
					source: random.pick(SOURCE_POOL),
					appliedAt: context.at(day, appliedMinutes),
					appliedOffset: day,
					stage: "applied",
					stageChanges: [
						{ stage: "applied", at: context.at(day, appliedMinutes) },
					],
					rating: null,
					interviewAt: null,
					experienceYears: random.int(spec.experience[0], spec.experience[1]),
					// The role list is never empty. The fallback only satisfies the index type.
					currentRole:
						roles[positionDrafts.length % roles.length] ?? spec.title,
				};
				let at = day;
				for (const step of PIPELINE_STEPS) {
					at = nextWeekday(
						context,
						at + random.int(step.wait[0], step.wait[1]),
					);
					if (at > stop) {
						break;
					}
					// fillPosition makes the one hire of a filled post. An open post has at most one offer out.
					const isBlocked =
						step.next === "hired" ||
						(step.next === "offer" &&
							positionDrafts.some((other) => other.stage === "offer"));
					if (isBlocked) {
						break;
					}
					const passes = random.chance(step.pass);
					const stage: Stage = passes ? step.next : "rejected";
					draft.stage = stage;
					draft.stageChanges.push({
						stage,
						at: context.at(at, minutesBetween(random, 9, 18)),
					});
					if (step.next !== "screening" || passes) {
						draft.rating = random.int(passes ? 3 : 1, passes ? 5 : 3);
					}
					if (!passes) {
						break;
					}
				}
				positionDrafts.push(draft);
			}
		}
		if (spec.status === "filled" && closed !== null) {
			fillPosition(context, positionDrafts, closed);
		}
		// The next interview of each candidate at the interview stage of an open post.
		for (const draft of positionDrafts) {
			if (spec.status === "open" && draft.stage === "interview") {
				draft.interviewAt = context.at(
					nextWeekday(context, random.int(1, 6)),
					random.pick([10, 11, 14, 15, 16]) * 60,
				);
			}
		}
		drafts.push(...positionDrafts);
	}
	drafts.sort((first, second) =>
		first.appliedAt.localeCompare(second.appliedAt),
	);
	const candidates = drafts.map(
		({ appliedOffset: _offset, ...draft }, index) => {
			const { first, last } = pickName(FIRST_NAMES, 6);
			return { id: `CA-${5001 + index}`, name: `${first} ${last}`, ...draft };
		},
	);
	return { positions, candidates };
}

// A copy of `list` in a seeded random order (Fisher-Yates).
function shuffled<Item>(random: Random, list: readonly Item[]): Item[] {
	const copy = [...list];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const other = random.int(0, index);
		const item = copy[index];
		const swap = copy[other];
		if (item !== undefined && swap !== undefined) {
			copy[index] = swap;
			copy[other] = item;
		}
	}
	return copy;
}

// A filled post: the most advanced candidate gets the job on the day of the hire; the others close then.
function fillPosition(
	context: Context,
	drafts: CandidateDraft[],
	closed: number,
) {
	const order: Stage[] = ["offer", "interview", "screening", "applied"];
	const hire = order
		.map((stage) => drafts.find((draft) => draft.stage === stage))
		.find((draft) => draft !== undefined);
	if (!hire) {
		return;
	}
	const offerDay = nextWeekday(
		context,
		Math.max(hire.appliedOffset + 1, closed - 5),
	);
	if (hire.stage !== "offer") {
		hire.stageChanges.push({
			stage: "offer",
			at: context.at(offerDay, 15 * 60),
		});
	}
	hire.stage = "hired";
	hire.rating = 5;
	hire.stageChanges.push({ stage: "hired", at: context.at(closed, 11 * 60) });
	for (const draft of drafts) {
		if (draft !== hire && draft.stage !== "rejected") {
			draft.stage = "rejected";
			draft.stageChanges.push({
				stage: "rejected",
				at: context.at(closed, 16 * 60),
			});
		}
	}
}

function buildTables(dayStart: number): PeopleTables {
	const context = createContext(dayStart);
	const { random } = context;
	const pickName = createNamePicker(random);
	const employees = buildEmployees(context, pickName);
	// Two mid-level people are on parental leave, and two others have resigned.
	const longTenure = employees.filter(
		(employee) => employee.role.level === "mid" && employee.startOffset < -500,
	);
	const onParentalLeave = new Set(
		[longTenure[3], longTenure[17]].flatMap((employee) =>
			employee ? [employee.id] : [],
		),
	);
	const leavers = new Map<
		string,
		{ noticeOffset: number; lastOffset: number }
	>();
	for (const [index, leaver] of [longTenure[8], longTenure[22]].entries()) {
		if (leaver) {
			const lastOffset = nextWeekday(context, index === 0 ? 12 : 26);
			leavers.set(leaver.id, {
				noticeOffset: nextWeekday(context, lastOffset - 30),
				lastOffset,
			});
		}
	}
	// The last day of a leaver bounds its time off, so the statuses come before the requests.
	assignStatuses(context, employees, onParentalLeave, leavers);
	const requests = buildRequests(context, employees, onParentalLeave);
	const careerEvents = buildCareerEvents(context, employees, requests, leavers);
	const { positions, candidates } = buildHiring(context, employees, pickName);
	return {
		dayStart,
		employees: employees.map(
			({ role: _role, startOffset: _offset, ...employee }) => employee,
		),
		careerEvents,
		requests,
		positions,
		candidates,
	};
}

// The tables of the current day. A new day builds new tables.
let cache: PeopleTables | null = null;

/** The sample tables of today. The same calendar day gives the same object, so the query files can join freely. */
export function readPeopleTables(): PeopleTables {
	const dayStart = startOfLocalDay(Date.now());
	if (cache?.dayStart !== dayStart) {
		cache = buildTables(dayStart);
	}
	return cache;
}
