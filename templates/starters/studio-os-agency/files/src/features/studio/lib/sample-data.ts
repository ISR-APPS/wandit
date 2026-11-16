// The sample rows of Studio OS: members, clients, projects, time entries, deliverables, and invoices.
// The queryFn of each feature reads getStudioData(). A later turn replaces those queryFns with Supabase reads.
// The rows derive from sample-catalog.ts with a seeded generator, relative to the local midnight of today.
// So the rows, the ids, and the totals stay the same for the whole day. No event is dated today or later.
import {
	type DeliverableStatus,
	type InvoiceStatus,
	ROLES,
	type Role,
} from "./codes";
import {
	CLIENT_SEEDS,
	type ClientSeed,
	DELIVERABLE_NAMES,
	MEMBER_SEEDS,
	type MemberSeed,
	PROJECT_SEEDS,
	type ProjectSeed,
	RETAINER_DELIVERABLE_NAMES,
} from "./sample-catalog";
import {
	addDays,
	type Day,
	dayFromToday,
	daysBetween,
	daysFromToday,
	isWeekend,
	parseDay,
	toDay,
} from "./time";

/** One person of the studio. */
export type Member = MemberSeed;

/** One client company. */
export type Client = ClientSeed;

/** One project plan with its calendar days resolved. The generator reads it before any deliverable exists. */
type ProjectPlan = ProjectSeed & {
	startDay: Day;
	/** The delivery day. null for a retainer. */
	dueDay: Day | null;
};

/** One project with its calendar days resolved. */
export type Project = ProjectPlan & {
	/** True when the client approved every deliverable of a fixed or hourly project. Always false for a retainer. */
	isDelivered: boolean;
};

/** Hours of one member on one day: on a project (billable) or on studio time (projectId null). */
export type TimeEntry = {
	id: string;
	memberId: string;
	/** null for studio time: internal work, pitches, and admin. It is not billable. */
	projectId: string | null;
	day: Day;
	/** Hours in steps of a quarter hour. */
	hours: number;
};

/** One deliverable of a project. */
export type Deliverable = {
	id: string;
	projectId: string;
	name: string;
	/** Member id of the person who owns the work. */
	ownerId: string;
	dueDay: Day;
	status: DeliverableStatus;
	/** The day the client approved it. Set only when the status is "approved". */
	approvedDay: Day | null;
};

/** One line of an invoice. `amount` is in whole euros. */
export type InvoiceLine =
	| {
			id: string;
			kind: "stage";
			/** 1-based stage of a fixed fee: 1 of 3. */
			stage: number;
			stageCount: number;
			/** Share of the fee, 0.4 is 40 %. */
			share: number;
			amount: number;
	  }
	| {
			id: string;
			kind: "retainer";
			/** First day of the month that the fee pays for. */
			month: Day;
			amount: number;
	  }
	| {
			id: string;
			kind: "hours";
			role: Role;
			hours: number;
			/** Euros per hour. */
			rate: number;
			amount: number;
	  };

/** One invoice. The amount is the sum of its lines, in whole euros. */
export type Invoice = {
	id: string;
	/** "INV-2041". null for a draft: the studio numbers an invoice when it sends it. */
	number: string | null;
	projectId: string;
	clientId: string;
	status: InvoiceStatus;
	/** The day the studio sent it. For a draft: the planned day. */
	issueDay: Day;
	/** 30 days after the issue day. */
	dueDay: Day;
	/** Set only when the status is "paid". Always before today. */
	paidDay: Day | null;
	amount: number;
	lines: InvoiceLine[];
};

/** Every sample row of the studio. */
export type StudioData = {
	members: Member[];
	clients: Client[];
	projects: Project[];
	entries: TimeEntry[];
	deliverables: Deliverable[];
	invoices: Invoice[];
};

// Payment terms of every invoice, in days.
const PAYMENT_TERMS_DAYS = 30;
// A planned invoice shows as a draft this many days before its issue day.
const DRAFT_LEAD_DAYS = 14;
// A retainer ships one deliverable every two weeks.
const RETAINER_CYCLE_DAYS = 14;
// Working days in an average month. A retainer spreads its monthly hours over them.
const WORKDAYS_PER_MONTH = 21.7;
// The first invoice number of the sample. The numbers grow with the issue day.
const FIRST_INVOICE_NUMBER = 2041;
// These roles run the account and the schedule. They own no deliverable.
const NON_MAKER_ROLES: readonly Role[] = ["account_director", "producer"];
// Fixed fees bill 40 % at kick-off, 30 % at mid-point, and 30 % at delivery.
const FIXED_STAGE_SHARES = [0.4, 0.3, 0.3] as const;

/** FNV-1a hash of a text. It turns a row key into a stable seed. */
function hashText(text: string): number {
	let hash = 2_166_136_261;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16_777_619);
	}
	return hash >>> 0;
}

/** A number in [0, 1) that depends only on `key`. The same key gives the same number on every render. */
function noise(key: string): number {
	// Mulberry32: one step of a small seeded generator.
	let state = (hashText(key) + 0x6d2b79f5) >>> 0;
	state = Math.imul(state ^ (state >>> 15), state | 1);
	state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
	return ((state ^ (state >>> 14)) >>> 0) / 4_294_967_296;
}

/** A number between `min` and `max` that depends only on `key`. */
function between(key: string, min: number, max: number): number {
	return min + noise(key) * (max - min);
}

/** A whole number from `min` to `max`, both included, that depends only on `key`. */
function wholeBetween(key: string, min: number, max: number): number {
	return Math.floor(between(key, min, max + 1));
}

/** Rounds hours to a quarter hour, the step of a timesheet. */
function toQuarterHours(hours: number): number {
	return Math.round(hours * 4) / 4;
}

/** The weekdays from `from` to `to`, both included. */
function workdaysBetween(from: Day, to: Day): Day[] {
	const days: Day[] = [];
	for (let day = from; daysBetween(day, to) >= 0; day = addDays(day, 1)) {
		if (!isWeekend(day)) {
			days.push(day);
		}
	}
	return days;
}

/** The first day of each month after `from`, up to `to`, both included. */
function monthStartsBetween(from: Day, to: Day): Day[] {
	const starts: Day[] = [];
	const cursor = parseDay(from);
	cursor.setDate(1);
	cursor.setMonth(cursor.getMonth() + 1);
	while (daysBetween(toDay(cursor), to) >= 0) {
		starts.push(toDay(cursor));
		cursor.setMonth(cursor.getMonth() + 1);
	}
	return starts;
}

/** The project plans with their start and due days. */
function resolvePlans(): ProjectPlan[] {
	return PROJECT_SEEDS.map((seed) => {
		const startDay = dayFromToday(-seed.startedDaysAgo);
		return {
			...seed,
			startDay,
			dueDay:
				seed.durationDays === null
					? null
					: addDays(startDay, seed.durationDays),
		};
	});
}

/** The day the client signs off deliverable `id`: from 2 days before to 1 day after its due day. */
function approvalDayOf(id: string, dueDay: Day): Day {
	return addDays(dueDay, wholeBetween(`approve:${id}`, -2, 1));
}

/** The planned hours of a project on one workday, before the split among its team. */
function plannedDailyHours(project: ProjectPlan): number {
	if (project.dueDay === null) {
		return (project.budget / project.rate / WORKDAYS_PER_MONTH) * project.burn;
	}
	const workdays = workdaysBetween(project.startDay, project.dueDay).length;
	return (
		((project.budget / project.rate) * project.burn) / Math.max(1, workdays)
	);
}

/** The billable hours of every project, then the studio time that fills each workday of each member. */
function buildTimeEntries(projects: ProjectPlan[]): TimeEntry[] {
	const yesterday = dayFromToday(-1);
	const entries: TimeEntry[] = [];
	// Billable hours per member and day, to size the studio time of that day.
	const billableByMemberDay = new Map<string, number>();
	const isDayOff = (memberId: string, day: Day) =>
		// About 3 % of workdays are days off: holidays or sick days.
		noise(`off:${memberId}:${day}`) < 0.03;

	for (const project of projects) {
		const lastDay =
			project.dueDay !== null && daysBetween(project.dueDay, yesterday) > 0
				? project.dueDay
				: yesterday;
		const perDay = plannedDailyHours(project);
		for (const day of workdaysBetween(project.startDay, lastDay)) {
			const dayHours =
				perDay * between(`hours:${project.id}:${day}`, 0.55, 1.45);
			// The lead carries 40 % of the hours. The rest of the team shares the other 60 %.
			const weights = project.teamIds.map(
				(memberId, index) =>
					(index === 0 ? 0.4 : 0.6 / (project.teamIds.length - 1)) *
					between(`split:${project.id}:${memberId}:${day}`, 0.6, 1.4),
			);
			const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
			project.teamIds.forEach((memberId, index) => {
				const hours = toQuarterHours(
					(dayHours * (weights[index] ?? 0)) / weightTotal,
				);
				if (hours <= 0 || isDayOff(memberId, day)) {
					return;
				}
				entries.push({
					id: `t-${project.id}-${memberId}-${day}`,
					memberId,
					projectId: project.id,
					day,
					hours,
				});
				const key = `${memberId}:${day}`;
				billableByMemberDay.set(
					key,
					(billableByMemberDay.get(key) ?? 0) + hours,
				);
			});
		}
	}

	// Studio time: internal work, pitches, and admin fill the rest of a workday, with at least half an hour.
	const firstDay = dayFromToday(
		-Math.max(...PROJECT_SEEDS.map((seed) => seed.startedDaysAgo)),
	);
	for (const member of MEMBER_SEEDS) {
		const dailyCapacity = member.weeklyCapacity / 5;
		for (const day of workdaysBetween(firstDay, yesterday)) {
			if (isDayOff(member.id, day)) {
				continue;
			}
			const billable = billableByMemberDay.get(`${member.id}:${day}`) ?? 0;
			const open =
				dailyCapacity * between(`fill:${member.id}:${day}`, 0.85, 1) - billable;
			entries.push({
				id: `t-studio-${member.id}-${day}`,
				memberId: member.id,
				projectId: null,
				day,
				hours: toQuarterHours(Math.min(3.5, Math.max(0.5, open))),
			});
		}
	}
	return entries;
}

/** The deliverables of a project. The status comes from the sign-off day and the due day. Only the first open one is in progress. */
function deliverablesOf(project: ProjectPlan): Deliverable[] {
	const plan: { name: string; dueDay: Day }[] = [];
	if (project.dueDay === null) {
		// A retainer: one numbered deliverable per cycle, up to four weeks ahead.
		const base = RETAINER_DELIVERABLE_NAMES[project.service];
		for (let cycle = 1; ; cycle++) {
			const dueDay = addDays(project.startDay, cycle * RETAINER_CYCLE_DAYS);
			if (daysFromToday(dueDay) > 28) {
				break;
			}
			plan.push({ name: `${base} ${cycle}`, dueDay });
		}
	} else {
		const names = DELIVERABLE_NAMES[project.service];
		const durationDays = daysBetween(project.startDay, project.dueDay);
		names.forEach((name, index) => {
			plan.push({
				name,
				dueDay: addDays(
					project.startDay,
					Math.round((durationDays * (index + 1)) / names.length),
				),
			});
		});
	}

	const roleOf = new Map(
		MEMBER_SEEDS.map((member) => [member.id, member.role]),
	);
	const makerIds = project.teamIds.filter((memberId) => {
		const role = roleOf.get(memberId);
		return role !== undefined && !NON_MAKER_ROLES.includes(role);
	});
	let hasCurrentWork = false;
	return plan.map((item, index) => {
		const id = `d-${project.id}-${index + 1}`;
		const ownerId = makerIds[index % makerIds.length] ?? project.leadId;
		const dueIn = daysFromToday(item.dueDay);
		const signOffDay = approvalDayOf(id, item.dueDay);
		let status: DeliverableStatus;
		let approvedDay: Day | null = null;
		// Only a sign-off before today is approved, so yesterday can hold approvals and no approval is in the future.
		if (daysFromToday(signOffDay) < 0) {
			status = "approved";
			approvedDay = signOffDay;
		} else if (dueIn <= 2) {
			status = "client_review";
		} else if (hasCurrentWork) {
			status = "todo";
		} else {
			status = "in_progress";
			hasCurrentWork = true;
		}
		return {
			id,
			projectId: project.id,
			name: item.name,
			ownerId,
			dueDay: item.dueDay,
			status,
			approvedDay,
		};
	});
}

/** An invoice before its number and its status. */
type PlannedInvoice = {
	key: string;
	project: ProjectPlan;
	issueDay: Day;
	lines: InvoiceLine[];
};

/** The hours lines of an hourly invoice: the billable hours from `from` to the day before `to`, per role. */
function hoursLines(
	key: string,
	project: ProjectPlan,
	entries: TimeEntry[],
	from: Day,
	to: Day,
): InvoiceLine[] {
	const roleOf = new Map(
		MEMBER_SEEDS.map((member) => [member.id, member.role]),
	);
	const hoursByRole = new Map<Role, number>();
	for (const entry of entries) {
		if (
			entry.projectId === project.id &&
			daysBetween(from, entry.day) >= 0 &&
			daysBetween(entry.day, to) > 0
		) {
			const role = roleOf.get(entry.memberId);
			if (role) {
				hoursByRole.set(role, (hoursByRole.get(role) ?? 0) + entry.hours);
			}
		}
	}
	return ROLES.flatMap((role) => {
		const hours = hoursByRole.get(role);
		return hours
			? [
					{
						id: `${key}-${role}`,
						kind: "hours" as const,
						role,
						hours,
						rate: project.rate,
						amount: Math.round(hours * project.rate),
					},
				]
			: [];
	});
}

/** The invoices that each project plans: fee stages, monthly retainer fees, or monthly hours. */
function planInvoices(
	projects: ProjectPlan[],
	entries: TimeEntry[],
): PlannedInvoice[] {
	const lastPlannedDay = dayFromToday(DRAFT_LEAD_DAYS);
	const planned: PlannedInvoice[] = [];
	for (const project of projects) {
		if (project.billing === "fixed" && project.dueDay !== null) {
			const durationDays = daysBetween(project.startDay, project.dueDay);
			const stageOffsets = [0, Math.round(durationDays / 2), durationDays];
			let billed = 0;
			FIXED_STAGE_SHARES.forEach((share, index) => {
				const isLast = index === FIXED_STAGE_SHARES.length - 1;
				// The last stage takes the rest, so the three stages add up to the fee exactly.
				const amount = isLast
					? project.budget - billed
					: Math.round(project.budget * share);
				billed += amount;
				const key = `i-${project.id}-s${index + 1}`;
				planned.push({
					key,
					project,
					issueDay: addDays(project.startDay, stageOffsets[index] ?? 0),
					lines: [
						{
							id: `${key}-1`,
							kind: "stage",
							stage: index + 1,
							stageCount: FIXED_STAGE_SHARES.length,
							share,
							amount,
						},
					],
				});
			});
		} else if (project.billing === "retainer") {
			// A retainer bills only on the 1st of each month. monthStartsBetween skips its first day,
			// so the day before the start lets a retainer that starts on the 1st bill that month.
			for (const month of monthStartsBetween(
				addDays(project.startDay, -1),
				lastPlannedDay,
			)) {
				const key = `i-${project.id}-${month}`;
				planned.push({
					key,
					project,
					issueDay: month,
					lines: [
						{ id: `${key}-1`, kind: "retainer", month, amount: project.budget },
					],
				});
			}
		} else {
			// Hourly: each first of the month bills the hours of the month before.
			const yesterday = dayFromToday(-1);
			let from = project.startDay;
			for (const month of monthStartsBetween(project.startDay, yesterday)) {
				// A first month of under 10 days moves to the next invoice, so no invoice is tiny.
				if (daysBetween(from, month) < 10) {
					continue;
				}
				const key = `i-${project.id}-${month}`;
				const lines = hoursLines(key, project, entries, from, month);
				if (lines.length > 0) {
					planned.push({ key, project, issueDay: month, lines });
				}
				from = month;
			}
		}
	}
	return planned.filter(
		(invoice) => daysBetween(invoice.issueDay, lastPlannedDay) >= 0,
	);
}

/** Numbers, statuses, and payment days of the planned invoices. */
function buildInvoices(
	projects: ProjectPlan[],
	entries: TimeEntry[],
): Invoice[] {
	const delayOf = new Map(
		CLIENT_SEEDS.map((client) => [client.id, client.paymentDelay]),
	);
	const planned = planInvoices(projects, entries).sort(
		(first, second) =>
			daysBetween(second.issueDay, first.issueDay) ||
			first.key.localeCompare(second.key),
	);
	// The list is sorted by issue day, so the drafts come last and the sent invoices get gapless numbers.
	let sentCount = 0;
	return planned.map((invoice) => {
		const amount = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
		const dueDay = addDays(invoice.issueDay, PAYMENT_TERMS_DAYS);
		const base = {
			id: invoice.key,
			projectId: invoice.project.id,
			clientId: invoice.project.clientId,
			issueDay: invoice.issueDay,
			dueDay,
			amount,
			lines: invoice.lines,
		};
		// An issue day of today or later is still a draft: the studio sends invoices at the end of a day.
		if (daysFromToday(invoice.issueDay) >= 0) {
			return { ...base, number: null, status: "draft" as const, paidDay: null };
		}
		const number = `INV-${FIRST_INVOICE_NUMBER + sentCount}`;
		sentCount++;
		const delay =
			(delayOf.get(invoice.project.clientId) ?? PAYMENT_TERMS_DAYS) +
			wholeBetween(`pay:${invoice.key}`, -6, 8);
		const paidDay = addDays(invoice.issueDay, Math.max(3, delay));
		if (daysFromToday(paidDay) < 0) {
			return { ...base, number, status: "paid" as const, paidDay };
		}
		const status: InvoiceStatus =
			daysFromToday(dueDay) < 0 ? "overdue" : "sent";
		return { ...base, number, status, paidDay: null };
	});
}

/** The cache of one day. A new day builds new rows, so the dates move with the calendar. */
let cache: { today: Day; data: StudioData } | null = null;

/** Every sample row, built once per local day. */
export function getStudioData(): StudioData {
	const today = dayFromToday(0);
	if (cache?.today === today) {
		return cache.data;
	}
	const plans = resolvePlans();
	const entries = buildTimeEntries(plans);
	const deliverables = plans.flatMap(deliverablesOf);
	// A fixed or hourly project is delivered when the client approved its last deliverable. A retainer never ends.
	const projects = plans.map(
		(plan): Project => ({
			...plan,
			isDelivered:
				plan.dueDay !== null &&
				deliverables.every(
					(deliverable) =>
						deliverable.projectId !== plan.id ||
						deliverable.status === "approved",
				),
		}),
	);
	const data: StudioData = {
		members: [...MEMBER_SEEDS],
		clients: [...CLIENT_SEEDS],
		projects,
		entries,
		deliverables,
		invoices: buildInvoices(plans, entries),
	};
	cache = { today, data };
	return data;
}
