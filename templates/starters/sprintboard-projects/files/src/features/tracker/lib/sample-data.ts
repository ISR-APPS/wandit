// The sample tables of the tracker: team members, projects, milestones, and tasks.
// Only the query files (api/*.queries.ts) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every date is relative to the current day. Every event ends before today's midnight, and a seeded generator
// makes the rows. So the rows, the ids, and the totals stay the same for the whole day.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import {
	ESTIMATE_POINTS,
	type ProjectHealth,
	type ProjectStatus,
	type TaskKind,
	type TaskPriority,
	type TaskStatus,
} from "./codes";
import { DAY_MS, MINUTE_MS, startOfLocalDay } from "./time";

/** One person of the product team. */
export type MemberRow = {
	id: string;
	name: string;
	/** The job title, for example "Frontend engineer". */
	role: string;
	/** Story points that the person can carry in two weeks. The Team page compares the committed points with it. */
	capacity: number;
	/** Work email on the reserved example.com domain. The Team table shows it and copies it. */
	email: string;
};

/** One project of the team. The times are ISO texts. */
export type ProjectRow = {
	id: string;
	/** Two to four capitals. Task keys start with it: "CHK-42". */
	key: string;
	name: string;
	/** One sentence on the goal of the project. */
	summary: string;
	/** The member that owns the project. */
	leadId: string;
	/** The members that work on the project, the lead included. */
	memberIds: string[];
	status: ProjectStatus;
	/** Set by the lead on an active project. null for other statuses. */
	health: ProjectHealth | null;
	startAt: string;
	/** The planned ship day. */
	targetAt: string;
	/** The day the project was completed or paused. null while it is planned or active. */
	endedAt: string | null;
};

/** One checkpoint of a project. */
export type MilestoneRow = {
	id: string;
	projectId: string;
	name: string;
	dueAt: string;
	/** null while the milestone is open. */
	doneAt: string | null;
};

/** One task. A time is null until the step happened. */
export type TaskRow = {
	id: string;
	projectId: string;
	/** The number inside the project, in creation order. The key is `${project.key}-${number}`. */
	number: number;
	title: string;
	kind: TaskKind;
	priority: TaskPriority;
	/** Story points, one of ESTIMATE_POINTS. */
	estimate: number;
	status: TaskStatus;
	/** null for a backlog task that nobody owns yet. */
	assigneeId: string | null;
	/** The member that wrote the task. */
	reporterId: string;
	createdAt: string;
	startedAt: string | null;
	/** When the task moved to review. */
	reviewAt: string | null;
	completedAt: string | null;
	/** The promised day, at 17:00. Many tasks have none. */
	dueAt: string | null;
	/** Minutes that the assignee logged on the task. 0 until work starts. The "Hours logged" KPI sums it. */
	loggedMinutes: number;
};

/** Every sample table. Each list is in creation order; the query files sort and join them. */
export type SampleTables = {
	members: MemberRow[];
	projects: ProjectRow[];
	milestones: MilestoneRow[];
	tasks: TaskRow[];
};

const MEMBERS: Omit<MemberRow, "email">[] = [
	{
		id: "member-01",
		name: "Ines Okafor",
		role: "Product manager",
		capacity: 12,
	},
	{
		id: "member-02",
		name: "Tomas Reyes",
		role: "Engineering lead",
		capacity: 16,
	},
	{
		id: "member-03",
		name: "Mei Lindgren",
		role: "Frontend engineer",
		capacity: 24,
	},
	{
		id: "member-04",
		name: "Arjun Castell",
		role: "Backend engineer",
		capacity: 24,
	},
	{
		id: "member-05",
		name: "Sofia Varga",
		role: "Product designer",
		capacity: 20,
	},
	{
		id: "member-06",
		name: "Kwame Holloway",
		role: "Backend engineer",
		capacity: 24,
	},
	{ id: "member-07", name: "Leila Brandt", role: "QA engineer", capacity: 18 },
	{
		id: "member-08",
		name: "Daniel Ferreira",
		role: "Mobile engineer",
		capacity: 24,
	},
	{
		id: "member-09",
		name: "Hana Kowalczyk",
		role: "Frontend engineer",
		capacity: 24,
	},
	{
		id: "member-10",
		name: "Rafael Moreau",
		role: "Data engineer",
		capacity: 20,
	},
	{
		id: "member-11",
		name: "Yara Nakamura",
		role: "Product designer",
		capacity: 20,
	},
	{
		id: "member-12",
		name: "Elliot Ashby",
		role: "Site reliability engineer",
		capacity: 20,
	},
];

// The QA engineer reports many of the bugs.
const QA_MEMBER_ID = "member-07";

/** The fixed facts of one project. Day numbers count from today: -30 is 30 days ago. */
type ProjectSeed = {
	key: string;
	name: string;
	summary: string;
	leadId: string;
	memberIds: string[];
	status: ProjectStatus;
	health: ProjectHealth | null;
	startDay: number;
	targetDay: number;
	/** The day the project was completed or paused. */
	endDay: number | null;
	/** Tasks per working day. */
	rate: number;
	/** Days added to the planned finish to get a due day. A low range gives late tasks. */
	dueSlack: [number, number];
	/** The parts of the product that the task titles name. */
	parts: string[];
	milestones: { name: string; day: number; isDone: boolean }[];
};

const PROJECTS: ProjectSeed[] = [
	{
		key: "CHK",
		name: "Checkout revamp",
		summary: "A one-page checkout with saved cards and clearer totals.",
		leadId: "member-01",
		memberIds: [
			"member-01",
			"member-03",
			"member-07",
			"member-05",
			"member-04",
		],
		status: "active",
		health: "on-track",
		startDay: -76,
		targetDay: 18,
		endDay: null,
		rate: 1.7,
		dueSlack: [-1, 5],
		parts: [
			"cart summary",
			"promo code field",
			"shipping step",
			"saved cards list",
			"order review page",
			"tax line",
			"payment form",
			"receipt email",
			"address autocomplete",
			"checkout progress bar",
		],
		milestones: [
			{ name: "Flows signed off", day: -58, isDone: true },
			{ name: "Saved cards in beta", day: -21, isDone: true },
			{ name: "One-page checkout for 10% of buyers", day: 4, isDone: false },
			{ name: "General release", day: 18, isDone: false },
		],
	},
	{
		key: "ONB",
		name: "Mobile onboarding",
		summary: "A shorter first-run flow for the phone apps.",
		leadId: "member-08",
		memberIds: ["member-08", "member-11", "member-06", "member-07"],
		status: "active",
		health: "at-risk",
		startDay: -61,
		targetDay: 9,
		endDay: null,
		rate: 1.5,
		dueSlack: [-4, 2],
		parts: [
			"welcome screen",
			"permission prompt",
			"workspace picker",
			"invite step",
			"sample project",
			"push opt-in",
			"progress dot row",
			"skip button",
			"sign-in handoff",
			"tour tooltip",
		],
		milestones: [
			{ name: "Prototype tested with 8 users", day: -44, isDone: true },
			{ name: "Phone build in beta testing", day: -12, isDone: true },
			{
				name: "Second phone build in internal testing",
				day: -3,
				isDone: false,
			},
			{ name: "Store release", day: 9, isDone: false },
		],
	},
	{
		key: "BIL",
		name: "Billing v2",
		summary: "Usage-based plans, prorated upgrades, and an invoice history.",
		leadId: "member-02",
		memberIds: [
			"member-02",
			"member-04",
			"member-06",
			"member-10",
			"member-09",
		],
		status: "active",
		health: "on-track",
		startDay: -112,
		targetDay: 31,
		endDay: null,
		rate: 1.5,
		dueSlack: [0, 6],
		parts: [
			"plan picker",
			"usage meter",
			"proration preview",
			"invoice list",
			"invoice PDF",
			"seat counter",
			"tax ID field",
			"dunning email",
			"billing settings page",
			"upgrade dialog",
		],
		milestones: [
			{ name: "Pricing model approved", day: -96, isDone: true },
			{ name: "Usage metering live", day: -40, isDone: true },
			{ name: "Invoice history for all workspaces", day: 12, isDone: false },
			{ name: "Plan migration", day: 31, isDone: false },
		],
	},
	{
		key: "SRC",
		name: "Search relevance",
		summary: "Typo tolerance and better ranking for workspace search.",
		leadId: "member-10",
		memberIds: ["member-12", "member-09", "member-10"],
		status: "active",
		health: "off-track",
		startDay: -52,
		targetDay: 4,
		endDay: null,
		rate: 1.4,
		dueSlack: [-8, 0],
		parts: [
			"search index",
			"ranking model",
			"typo tolerance",
			"result snippet",
			"filter chip row",
			"recent search list",
			"query parser",
			"search analytics page",
			"empty result page",
			"keyboard shortcut list",
		],
		milestones: [
			{ name: "Relevance baseline measured", day: -38, isDone: true },
			{ name: "New ranking behind a flag", day: -6, isDone: false },
			{ name: "Ranking for all workspaces", day: 4, isDone: false },
		],
	},
	{
		key: "DS",
		name: "Design system 3",
		summary: "New tokens, form controls, and a documented component library.",
		leadId: "member-05",
		memberIds: ["member-05", "member-11", "member-03", "member-09"],
		status: "active",
		health: "on-track",
		startDay: -96,
		targetDay: 40,
		endDay: null,
		rate: 1.5,
		dueSlack: [0, 6],
		parts: [
			"color token set",
			"button set",
			"date picker",
			"select menu",
			"toast",
			"data table",
			"icon set",
			"spacing scale",
			"focus ring",
			"docs site",
		],
		milestones: [
			{ name: "Token audit", day: -80, isDone: true },
			{ name: "Form controls shipped", day: -26, isDone: true },
			{ name: "Docs site public", day: 15, isDone: false },
			{ name: "All screens on version 3", day: 40, isDone: false },
		],
	},
	{
		key: "NTF",
		name: "Notification center",
		summary: "One inbox for mentions, assignments, and status changes.",
		leadId: "member-06",
		memberIds: ["member-06", "member-03", "member-11", "member-12"],
		status: "active",
		health: "at-risk",
		startDay: -41,
		targetDay: 22,
		endDay: null,
		rate: 1.6,
		dueSlack: [-2, 4],
		parts: [
			"inbox panel",
			"unread badge",
			"email digest",
			"mute settings page",
			"mention parser",
			"delivery queue",
			"read receipt",
			"snooze menu",
			"mobile push",
			"notification filter",
		],
		milestones: [
			{ name: "Event model agreed", day: -30, isDone: true },
			{ name: "Inbox for staff", day: -2, isDone: false },
			{ name: "Inbox for all users", day: 22, isDone: false },
		],
	},
	{
		key: "API",
		name: "Public API v3",
		summary: "Versioned REST endpoints with scoped tokens and webhooks.",
		leadId: "member-02",
		memberIds: ["member-02", "member-04", "member-12", "member-10"],
		status: "planned",
		health: null,
		startDay: 12,
		targetDay: 96,
		endDay: null,
		rate: 1.0,
		dueSlack: [0, 6],
		parts: [
			"token scope picker",
			"rate limiter",
			"webhook signer",
			"pagination",
			"error format",
			"API reference",
			"versioning header",
			"sandbox key page",
			"audit trail",
			"SDK sample page",
		],
		milestones: [
			{ name: "Endpoint review", day: 20, isDone: false },
			{ name: "Private beta", day: 61, isDone: false },
			{ name: "Public release", day: 96, isDone: false },
		],
	},
	{
		key: "PRF",
		name: "Performance budget",
		summary: "Load time budgets for every page, checked on each release.",
		leadId: "member-12",
		memberIds: ["member-12", "member-08", "member-09"],
		status: "paused",
		health: null,
		startDay: -132,
		targetDay: -20,
		endDay: -36,
		rate: 1.1,
		dueSlack: [0, 5],
		parts: [
			"bundle report",
			"image loader",
			"route prefetch",
			"font loading",
			"release check",
			"timing dashboard",
			"cache header",
			"lazy chart",
			"budget alert",
			"trace sampler",
		],
		milestones: [
			{ name: "Budgets set per page", day: -101, isDone: true },
			{ name: "Release check in CI", day: -20, isDone: false },
		],
	},
	{
		key: "SSO",
		name: "Team SSO",
		summary: "SAML sign-in and automatic seats for company accounts.",
		leadId: "member-04",
		memberIds: ["member-04", "member-02", "member-07", "member-09"],
		status: "completed",
		health: null,
		startDay: -172,
		targetDay: -30,
		endDay: -28,
		rate: 1.3,
		dueSlack: [0, 5],
		parts: [
			"SAML handshake",
			"domain check",
			"seat sync",
			"admin settings page",
			"login screen",
			"session timeout",
			"role mapping",
			"setup guide",
			"audit event log",
			"metadata upload",
		],
		milestones: [
			{ name: "Identity provider tests pass", day: -96, isDone: true },
			{ name: "First company live", day: -52, isDone: true },
			{ name: "General release", day: -28, isDone: true },
		],
	},
	{
		key: "EXP",
		name: "Data export",
		summary: "CSV and JSON exports of projects, tasks, and comments.",
		leadId: "member-10",
		memberIds: ["member-10", "member-06", "member-05"],
		status: "completed",
		health: null,
		startDay: -206,
		targetDay: -75,
		endDay: -71,
		rate: 1.2,
		dueSlack: [0, 5],
		parts: [
			"export job",
			"CSV writer",
			"JSON schema",
			"download link",
			"export history",
			"size limit",
			"progress toast",
			"comment export",
			"retry logic",
			"export settings page",
		],
		milestones: [
			{ name: "Export format agreed", day: -150, isDone: true },
			{ name: "Exports for all plans", day: -71, isDone: true },
		],
	},
];

// Title patterns of each kind. "{part}" is a part of the project; "{Part}" starts with a capital.
// Every part is singular, because the bug patterns use a singular verb ("{Part} flickers").
const TITLES: Record<TaskKind, string[]> = {
	feature: [
		"Build the {part}",
		"Design the {part}",
		"Write tests for the {part}",
		"Track usage of the {part}",
		"Polish the {part}",
		"Write help text for the {part}",
		"Review the {part} with support",
		"Ship the {part} behind a flag",
		"Add keyboard support to the {part}",
		"Prototype the {part}",
		"Add an empty state to the {part}",
		"Translate the {part}",
	],
	bug: [
		"{Part} breaks in older browsers",
		"{Part} loses its state after a refresh",
		"{Part} is cut off on small screens",
		"{Part} times out on slow networks",
		"{Part} shows the wrong time zone",
		"{Part} skips keyboard focus",
		"{Part} flickers while it loads",
		"{Part} sends the request twice",
		"{Part} shows a stale count",
		"{Part} crashes on an empty list",
		"{Part} uses the wrong sort order",
	],
	chore: [
		"Remove the old flag of the {part}",
		"Add logging to the {part}",
		"Speed up the query of the {part}",
		"Clean up the styles of the {part}",
		"Upgrade the library of the {part}",
	],
};

// How many working days the work on an estimate takes, from start to done.
const CYCLE_DAYS: Record<number, [number, number]> = {
	1: [0, 1],
	2: [1, 2],
	3: [1, 4],
	5: [3, 6],
	8: [4, 9],
};

// Work starts between 09:00 and 17:00, in minutes after midnight.
const WORKDAY_START = 9 * 60;
const WORKDAY_END = 17 * 60;
// The history covers two periods of the longest chart period (90 days), plus 30 days.
// The extra days give the oldest chart days finished work, so the previous line does not start at 0.
const HISTORY_DAYS = 210;
// A backlog task that starts within this many days moves to "To do".
const TODO_HORIZON_DAYS = 4;

// A fixed seed gives the same rows for the whole day, so the numbers do not jump between loads.
// mulberry32: a small generator with an even spread. The constants are part of the algorithm.
function createRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

// The item at `index`, starting again at the first item after the last.
function cycle<Item>(items: readonly Item[], index: number): Item {
	// SAFETY: the lists are fixed and not empty, and the modulo keeps the index inside the list.
	return items[index % items.length] as Item;
}

/** The time of `minutes` after the local midnight of the day `day` days from `today`. */
function atDay(today: number, day: number, minutes: number): number {
	const date = new Date(today);
	// setDate keeps the calendar day across a clock change. A sum of 24-hour days does not.
	date.setDate(date.getDate() + day);
	date.setHours(0, minutes, 0, 0);
	return date.getTime();
}

/** The first working day (Monday to Friday) at `day` days from `today` or after it. */
function nextWorkday(today: number, day: number): number {
	let result = day;
	while (isWeekend(today, result)) {
		result += 1;
	}
	return result;
}

function isWeekend(today: number, day: number): boolean {
	// Noon is on the same calendar day in every clock change.
	return [0, 6].includes(new Date(atDay(today, day, 12 * 60)).getDay());
}

/**
 * The working day `count` working days after `day`. A count of 0 gives `day`, or the next Monday on a weekend.
 * Work counts in working days, so finished tasks spread over Monday to Friday and no weekday gets a weekend of work.
 */
function addWorkdays(today: number, day: number, count: number): number {
	let result = nextWorkday(today, day);
	for (let left = count; left > 0; left -= 1) {
		result = nextWorkday(today, result + 1);
	}
	return result;
}

/** The last working day at `day` or before it. */
function previousWorkday(today: number, day: number): number {
	let result = day;
	while (isWeekend(today, result)) {
		result -= 1;
	}
	return result;
}

function capitalize(text: string): string {
	return `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}`;
}

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

function buildSampleTables(now: number): SampleTables {
	const random = createRandom(133);
	const between = (min: number, max: number) =>
		min + Math.floor(random() * (max - min + 1));
	const today = startOfLocalDay(now);

	const projects: ProjectRow[] = PROJECTS.map((seed, index) => ({
		id: `project-${String(index + 1).padStart(2, "0")}`,
		key: seed.key,
		name: seed.name,
		summary: seed.summary,
		leadId: seed.leadId,
		memberIds: seed.memberIds,
		status: seed.status,
		health: seed.health,
		startAt: iso(atDay(today, seed.startDay, WORKDAY_START)),
		targetAt: iso(atDay(today, seed.targetDay, WORKDAY_END)),
		endedAt:
			seed.endDay === null ? null : iso(atDay(today, seed.endDay, WORKDAY_END)),
	}));

	const milestones: MilestoneRow[] = PROJECTS.flatMap((seed, projectIndex) =>
		seed.milestones.map((milestone, index) => ({
			id: `milestone-${projectIndex + 1}-${index + 1}`,
			projectId: `project-${String(projectIndex + 1).padStart(2, "0")}`,
			name: milestone.name,
			dueAt: iso(atDay(today, milestone.day, WORKDAY_END)),
			// A milestone is done on its due day or up to two days before it.
			doneAt: milestone.isDone
				? iso(atDay(today, milestone.day - (projectIndex % 3), 15 * 60))
				: null,
		})),
	);

	const tasks: TaskRow[] = [];
	const numberByProject = new Map<string, number>();
	const countByKind = new Map<string, number>();

	// The history stops yesterday. A task of today would appear at the minute of its creation, so the rows would change during the day.
	for (let day = -HISTORY_DAYS; day <= -1; day += 1) {
		const isWeekendDay = isWeekend(today, day);
		PROJECTS.forEach((seed, projectIndex) => {
			const project = projects[projectIndex];
			// A planned project already has a small backlog from the last two weeks.
			const firstDay = seed.status === "planned" ? -13 : seed.startDay;
			// No new task in the last week of a completed project, nor after a pause.
			const lastDay =
				seed.status === "completed" && seed.endDay !== null
					? seed.endDay - 8
					: (seed.endDay ?? 0);
			if (!project || day < firstDay || day > lastDay) {
				return;
			}
			// The team writes no task on a weekend. A weekday gives 0 to 2 tasks, about `rate` on average.
			const count = isWeekendDay
				? 0
				: Math.floor(random() * 2 * seed.rate + 0.5);
			for (let index = 0; index < count; index += 1) {
				const createdMinute = between(WORKDAY_START, WORKDAY_END + 60);
				const kindRoll = random();
				const kind: TaskKind =
					kindRoll < 0.22 ? "bug" : kindRoll < 0.34 ? "chore" : "feature";
				const priorityRoll = random() + (kind === "bug" ? 0.15 : 0);
				const priority: TaskPriority =
					priorityRoll > 1.05
						? "urgent"
						: priorityRoll > 0.75
							? "high"
							: priorityRoll > 0.28
								? "medium"
								: "low";
				const estimateRoll = random();
				const estimate = cycle(
					ESTIMATE_POINTS,
					estimateRoll < 0.15
						? 0
						: estimateRoll < 0.45
							? 1
							: estimateRoll < 0.75
								? 2
								: estimateRoll < 0.93
									? 3
									: 4,
				);
				// Most tasks start within a week. One in three waits in the backlog for weeks.
				const waitDays = random() < 0.68 ? between(0, 5) : between(12, 50);
				const [cycleMin, cycleMax] = CYCLE_DAYS[estimate] ?? [1, 3];
				const cycleDays = between(cycleMin, cycleMax);
				const hasDue =
					random() < (priority === "urgent" || priority === "high" ? 0.8 : 0.5);
				const dueShift = between(seed.dueSlack[0], seed.dueSlack[1]);
				const assigneeRoll = random();
				const memberIndex = between(0, seed.memberIds.length - 1);
				const reporterRoll = random();
				const startMinute = between(WORKDAY_START, WORKDAY_END);
				const reviewMinute = between(WORKDAY_START, WORKDAY_END);
				const doneMinute = between(WORKDAY_START, WORKDAY_END + 60);
				const reviewShare = 0.5 + random() * 0.3;
				// Some tasks take longer than planned. Their due day stays, so they can run late.
				// A project in trouble slips more often: that is why its lead flags it.
				const slipShare =
					seed.health === "off-track"
						? 0.6
						: seed.health === "at-risk"
							? 0.45
							: 0.25;
				const slipDays = random() < slipShare ? between(2, 8) : 0;

				let startDay = addWorkdays(today, day, waitDays);
				let reviewDay = addWorkdays(
					today,
					startDay,
					Math.round(cycleDays * reviewShare),
				);
				const plannedDoneDay = Math.max(
					reviewDay,
					addWorkdays(today, startDay, cycleDays),
				);
				let doneDay = addWorkdays(today, plannedDoneDay, slipDays);
				reviewDay = Math.min(doneDay, addWorkdays(today, reviewDay, slipDays));
				// A completed project finished all its work by its end day.
				if (seed.status === "completed" && seed.endDay !== null) {
					// Late work spreads over the last week, so the end day has no spike of finished tasks.
					doneDay = Math.min(
						doneDay,
						previousWorkday(today, seed.endDay - (createdMinute % 7)),
					);
					reviewDay = Math.min(reviewDay, doneDay);
					startDay = Math.max(day, Math.min(startDay, reviewDay));
				}
				const createdAt = atDay(today, day, createdMinute);
				// Each step comes after the step before: the start at least 30 minutes later, the next steps at least an hour later.
				const startedAt = Math.max(
					atDay(today, startDay, startMinute),
					createdAt + 30 * MINUTE_MS,
				);
				const reviewAt = Math.max(
					atDay(today, reviewDay, reviewMinute),
					startedAt + 60 * MINUTE_MS,
				);
				const completedAt = Math.max(
					atDay(today, doneDay, doneMinute),
					reviewAt + 60 * MINUTE_MS,
				);
				const dueAt = hasDue
					? atDay(today, plannedDoneDay + dueShift, WORKDAY_END)
					: null;

				const numberInProject = (numberByProject.get(project.id) ?? 0) + 1;
				numberByProject.set(project.id, numberInProject);
				const kindKey = `${project.id}:${kind}`;
				const kindIndex = countByKind.get(kindKey) ?? 0;
				countByKind.set(kindKey, kindIndex + 1);
				// The pattern and the part both change with every task. Each round of patterns shifts the part
				// by one more step, so a title repeats only after parts x patterns tasks of one kind.
				const patterns = TITLES[kind];
				const pattern = cycle(patterns, kindIndex);
				const part = cycle(
					seed.parts,
					kindIndex + Math.floor(kindIndex / patterns.length) + projectIndex,
				);
				const title = pattern
					.replace("{part}", part)
					.replace("{Part}", capitalize(part));

				// A step happens only before today's midnight, and before the pause of a paused project.
				// A cut at midnight, not at now, keeps the statuses the same for the whole day.
				const stopAt =
					seed.status === "paused" && seed.endDay !== null
						? Math.min(today, atDay(today, seed.endDay, WORKDAY_END))
						: seed.status === "planned"
							? createdAt
							: today;
				const hasStarted = startedAt <= stopAt;
				const isPausedWork = seed.status === "paused" && completedAt > stopAt;
				// A planned project has not started: all its tasks wait in the backlog.
				const status: TaskStatus =
					seed.status === "planned"
						? "backlog"
						: completedAt <= stopAt
							? "done"
							: isPausedWork
								? "backlog"
								: reviewAt <= stopAt
									? "in-review"
									: hasStarted
										? "in-progress"
										: startedAt - today <= TODO_HORIZON_DAYS * DAY_MS
											? "todo"
											: "backlog";
				const isUnassigned = status === "backlog" && assigneeRoll < 0.45;
				tasks.push({
					id: `task-${String(tasks.length + 1).padStart(4, "0")}`,
					projectId: project.id,
					number: numberInProject,
					title,
					kind,
					priority,
					estimate,
					status,
					assigneeId: isUnassigned ? null : cycle(seed.memberIds, memberIndex),
					reporterId:
						kind === "bug" && reporterRoll < 0.4 ? QA_MEMBER_ID : seed.leadId,
					createdAt: iso(createdAt),
					// Paused work went back to the backlog, so its steps are cleared.
					startedAt: hasStarted && !isPausedWork ? iso(startedAt) : null,
					reviewAt: reviewAt <= stopAt && !isPausedWork ? iso(reviewAt) : null,
					completedAt: completedAt <= stopAt ? iso(completedAt) : null,
					// About 2.5 to 5 hours per story point. The spread comes from the creation minute, so no new random draw shifts the rows.
					loggedMinutes:
						hasStarted && !isPausedWork
							? estimate * (150 + ((createdMinute * 37) % 150))
							: 0,
					// Work of a planned project and paused work have no promised day yet.
					dueAt:
						dueAt === null || seed.status === "planned" || isPausedWork
							? null
							: iso(dueAt),
				});
			}
		});
	}

	// The email is "first.last" of the name on example.com, a domain that no real person uses.
	const members: MemberRow[] = MEMBERS.map((member) => ({
		...member,
		email: `${member.name.toLocaleLowerCase("en").replace(/\s+/g, ".")}@example.com`,
	}));
	return { members, projects, milestones, tasks };
}

// Built on the first read, then kept for the page load. A reload on the same day builds the same rows.
let cachedTables: SampleTables | null = null;

/** The sample tables. Every query file calls it, so all pages see the same rows. */
export function getSampleTables(): SampleTables {
	cachedTables ??= buildSampleTables(Date.now());
	return cachedTables;
}
