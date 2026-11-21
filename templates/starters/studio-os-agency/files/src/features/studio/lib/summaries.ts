// Pure functions that join the sample rows into the views of the pages: project, client, and invoice rows.
// The queryFns of the overview, clients, projects, team, and invoices features call them.
// A later Supabase version computes the same fields in SQL views or read functions (see STARTER.md).
import {
	type BillingType,
	type ClientRelation,
	DELIVERABLE_STATUSES,
	type Health,
	type Industry,
	type Phase,
	type Service,
	TIMELINE_PHASES,
	type TimelinePhase,
} from "./codes";
import type { Client, Invoice, StudioData } from "./sample-data";
import {
	type Day,
	dayFromToday,
	daysBetween,
	daysFromToday,
	isWeekend,
} from "./time";

/** A retainer compares the spend of the last 30 days with its monthly fee. */
const RETAINER_WINDOW_DAYS = 30;
/** A project is at risk when its spend runs this share ahead of its elapsed time: 0.08 is 8 points. */
const AT_RISK_GAP = 0.08;
/** The Clients page sums the invoices of the last 365 days. */
const BILLED_WINDOW_DAYS = 365;

/** True when `day` falls in the last `days` complete days: yesterday and the days before it. */
export function isInLastDays(day: Day, days: number): boolean {
	const offset = daysFromToday(day);
	return offset < 0 && offset >= -days;
}

/** True when `day` falls in the `days` complete days before the last `days` days. */
export function isInPreviousDays(day: Day, days: number): boolean {
	const offset = daysFromToday(day);
	return offset < -days && offset >= -2 * days;
}

/** Workdays in the last `days` complete days. Capacity counts only these. */
export function workdaysInLastDays(days: number): number {
	let count = 0;
	for (let offset = 1; offset <= days; offset++) {
		if (!isWeekend(dayFromToday(-offset))) {
			count++;
		}
	}
	return count;
}

/** One project with its client, its lead, its spend, its phase, and its health. */
export type ProjectSummary = {
	id: string;
	name: string;
	clientId: string;
	clientName: string;
	service: Service;
	billing: BillingType;
	leadId: string;
	leadName: string;
	teamIds: readonly string[];
	/** Names of the team, in the order of `teamIds`. A team id with no member row is left out. */
	teamNames: string[];
	startDay: Day;
	/** null for a retainer. */
	dueDay: Day | null;
	phase: Phase;
	/** null once the project is delivered. */
	health: Health | null;
	/** The fee or the hour cap in euros. For a retainer: the monthly fee. */
	budget: number;
	/** Blended hourly rate in euros. */
	rate: number;
	/** Hours times rate in whole euros. For a live retainer: the last 30 days only, to compare with the monthly fee. */
	spent: number;
	/** spent / budget. 1.1 is 10 % over. */
	burnShare: number;
	/** Share of the calendar from start to due day that has passed, 0 to 1. null for a retainer. */
	elapsedShare: number | null;
	/** Every hour logged on the project since its start. */
	hours: number;
	/** Euros of every sent or paid invoice of the project. Drafts are not in it. */
	invoiced: number;
	/** Euros of every paid invoice of the project. */
	paid: number;
	/** True while the project is not delivered. A retainer is always live. */
	isLive: boolean;
	/** Share of the deliverable steps done, 0 to 1: an approved deliverable counts 1. A delivered project is 1. */
	progress: number;
};

/**
 * The share of the calendar where each phase of a fixed or hourly project ends.
 * Discovery takes the first 12 %, review the last 20 %.
 */
const PHASE_ENDS = {
	discovery: 0.12,
	design: 0.4,
	production: 0.8,
	review: 1,
} as const satisfies Record<TimelinePhase, number>;

/** The phase of a live fixed or hourly project, from the share of its calendar that has passed. */
function phaseOf(elapsedShare: number): Phase {
	return (
		TIMELINE_PHASES.find((phase) => elapsedShare < PHASE_ENDS[phase]) ??
		"review"
	);
}

/** Every project as a ProjectSummary, in the order of the catalog. */
export function summarizeProjects(data: StudioData): ProjectSummary[] {
	const nameOf = new Map<string, string>([
		...data.clients.map((client): [string, string] => [client.id, client.name]),
		...data.members.map((member): [string, string] => [member.id, member.name]),
	]);
	return data.projects.map((project) => {
		const entries = data.entries.filter(
			(entry) => entry.projectId === project.id,
		);
		const hours = entries.reduce((sum, entry) => sum + entry.hours, 0);
		const isRetainer = project.dueDay === null;
		// Whole euros, so budget minus spent on the detail page adds up to the figures it shows.
		const spent = Math.round(
			isRetainer
				? entries
						.filter((entry) => isInLastDays(entry.day, RETAINER_WINDOW_DAYS))
						.reduce((sum, entry) => sum + entry.hours, 0) * project.rate
				: hours * project.rate,
		);
		const burnShare = spent / project.budget;
		const elapsedShare =
			project.dueDay === null
				? null
				: Math.min(
						1,
						Math.max(
							0,
							-daysFromToday(project.startDay) /
								daysBetween(project.startDay, project.dueDay),
						),
					);
		let health: Health | null = null;
		if (project.isDelivered) {
			health = null;
		} else if (elapsedShare === null) {
			// A retainer: the last 30 days against one monthly fee. Up to 8 % over is a warning, more is over budget.
			health =
				burnShare > 1 + AT_RISK_GAP
					? "over_budget"
					: burnShare > 1
						? "at_risk"
						: "on_track";
		} else {
			// A project: the spend against the fee, and against the share of the calendar that has passed.
			health =
				burnShare > 1
					? "over_budget"
					: burnShare - elapsedShare > AT_RISK_GAP
						? "at_risk"
						: "on_track";
		}
		const invoices = data.invoices.filter(
			(invoice) => invoice.projectId === project.id,
		);
		const deliverables = data.deliverables.filter(
			(deliverable) => deliverable.projectId === project.id,
		);
		// Each deliverable counts for its workflow step: To do 0, In progress 1/3, Client review 2/3, Approved 1.
		const stepSum = deliverables.reduce(
			(sum, deliverable) =>
				sum +
				DELIVERABLE_STATUSES.indexOf(deliverable.status) /
					(DELIVERABLE_STATUSES.length - 1),
			0,
		);
		return {
			id: project.id,
			name: project.name,
			clientId: project.clientId,
			clientName: nameOf.get(project.clientId) ?? "",
			service: project.service,
			billing: project.billing,
			leadId: project.leadId,
			leadName: nameOf.get(project.leadId) ?? "",
			teamIds: project.teamIds,
			teamNames: project.teamIds.flatMap((memberId) => {
				const name = nameOf.get(memberId);
				return name ? [name] : [];
			}),
			startDay: project.startDay,
			dueDay: project.dueDay,
			phase: project.isDelivered
				? "delivered"
				: elapsedShare === null
					? "ongoing"
					: phaseOf(elapsedShare),
			health,
			budget: project.budget,
			rate: project.rate,
			spent,
			burnShare,
			elapsedShare,
			hours,
			invoiced: invoices
				.filter((invoice) => invoice.status !== "draft")
				.reduce((sum, invoice) => sum + invoice.amount, 0),
			paid: invoices
				.filter((invoice) => invoice.status === "paid")
				.reduce((sum, invoice) => sum + invoice.amount, 0),
			isLive: !project.isDelivered,
			progress: project.isDelivered
				? 1
				: deliverables.length === 0
					? 0
					: stepSum / deliverables.length,
		};
	});
}

/** One client with its relation, its live work, and its money. */
export type ClientSummary = {
	id: string;
	name: string;
	industry: Industry;
	leadId: string;
	leadName: string;
	relation: ClientRelation;
	/** Projects that are not delivered, retainers included. */
	liveProjects: number;
	/** Euros of sent and paid invoices issued in the last 365 days. */
	billedLastYear: number;
	/** Euros of sent and overdue invoices. */
	outstanding: number;
	/** Euros of overdue invoices only. A part of `outstanding`. */
	overdue: number;
	/** The start day of the first project: the client since then. null for a client with no project yet. */
	sinceDay: Day | null;
};

/** Every client as a ClientSummary. The relation comes from the live projects. */
export function summarizeClients(
	data: StudioData,
	projects: ProjectSummary[],
): ClientSummary[] {
	const leadName = new Map(
		data.members.map((member) => [member.id, member.name]),
	);
	return data.clients.map((client: Client) => {
		const own = projects.filter((project) => project.clientId === client.id);
		const live = own.filter((project) => project.isLive);
		const invoices = data.invoices.filter(
			(invoice) => invoice.clientId === client.id,
		);
		const open = invoices.filter(
			(invoice) => invoice.status === "sent" || invoice.status === "overdue",
		);
		const relation: ClientRelation = live.some(
			(project) => project.billing === "retainer",
		)
			? "retainer"
			: live.length > 0
				? "project"
				: "dormant";
		const sinceDay = own
			.map((project) => project.startDay)
			.reduce<Day | null>(
				(first, day) =>
					first === null || daysBetween(day, first) > 0 ? day : first,
				null,
			);
		return {
			id: client.id,
			name: client.name,
			industry: client.industry,
			leadId: client.leadId,
			leadName: leadName.get(client.leadId) ?? "",
			relation,
			liveProjects: live.length,
			billedLastYear: invoices
				.filter(
					(invoice) =>
						invoice.status !== "draft" &&
						isInLastDays(invoice.issueDay, BILLED_WINDOW_DAYS),
				)
				.reduce((sum, invoice) => sum + invoice.amount, 0),
			outstanding: open.reduce((sum, invoice) => sum + invoice.amount, 0),
			overdue: open
				.filter((invoice) => invoice.status === "overdue")
				.reduce((sum, invoice) => sum + invoice.amount, 0),
			sinceDay,
		};
	});
}

/** One invoice with the names of its client and its project. */
export type InvoiceRow = Invoice & { clientName: string; projectName: string };

/** Every invoice with its names: the sent ones by issue day, newest first, then the drafts. */
export function summarizeInvoices(data: StudioData): InvoiceRow[] {
	const clientName = new Map(
		data.clients.map((client) => [client.id, client.name]),
	);
	const projectName = new Map(
		data.projects.map((project) => [project.id, project.name]),
	);
	return (
		data.invoices
			.map((invoice) => ({
				...invoice,
				clientName: clientName.get(invoice.clientId) ?? "",
				projectName: projectName.get(invoice.projectId) ?? "",
			}))
			// Drafts go last: the first screen shows the money that is out, not the plans.
			.sort(
				(first, second) =>
					Number(first.status === "draft") -
						Number(second.status === "draft") ||
					daysBetween(first.issueDay, second.issueDay) ||
					second.id.localeCompare(first.id),
			)
	);
}
