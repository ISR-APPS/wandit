// Builds the detail view of one project: its deliverables, its people, its invoices, and its burn series.
// projectQueryOptions calls it inside its queryFn. Pure: it reads the sample rows and returns new objects.
import {
	addDays,
	type Day,
	type Deliverable,
	dayFromToday,
	daysBetween,
	type InvoiceRow,
	isInLastDays,
	type ProjectSummary,
	type StudioData,
	summarizeInvoices,
	summarizeProjects,
} from "~/features/studio";

/** A retainer shows the burn of its last 90 days: three monthly fees. */
const RETAINER_BURN_DAYS = 90;
/** Average days in a month. A retainer plans its monthly fee over them. */
const DAYS_PER_MONTH = 30.4;

/** One day of the burn chart. Both values are cumulative euros since the start of the window. */
export type BurnPoint = {
	day: Day;
	/** Euros spent so far: hours times rate. */
	spent: number;
	/** Euros the plan allows so far: the budget spread evenly over the calendar. */
	planned: number;
};

/** One person on the project, with the hours they logged on it. */
export type ProjectPerson = {
	id: string;
	name: string;
	role: StudioData["members"][number]["role"];
	hours: number;
	/** The last day this person logged time on the project, or null. */
	lastDay: Day | null;
	isLead: boolean;
};

/** Everything the detail page shows about one project. */
export type ProjectDetail = {
	project: ProjectSummary;
	deliverables: Deliverable[];
	people: ProjectPerson[];
	invoices: InvoiceRow[];
	/** One point per day, oldest first. Ends yesterday or on the due day. */
	burn: BurnPoint[];
	/** The total the burn chart compares with: the fee, or three monthly fees for a retainer. */
	burnBudget: number;
};

/** The detail of one project, or null when the id is unknown. */
export function buildProjectDetail(
	data: StudioData,
	projectId: string,
): ProjectDetail | null {
	const project = summarizeProjects(data).find((row) => row.id === projectId);
	if (!project) {
		return null;
	}
	const entries = data.entries.filter((entry) => entry.projectId === projectId);
	const isRetainer = project.dueDay === null;
	const yesterday = dayFromToday(-1);
	const firstDay = isRetainer
		? dayFromToday(-RETAINER_BURN_DAYS)
		: project.startDay;
	const lastDay =
		project.dueDay !== null && daysBetween(project.dueDay, yesterday) > 0
			? project.dueDay
			: yesterday;
	const spentByDay = new Map<Day, number>();
	for (const entry of entries) {
		spentByDay.set(
			entry.day,
			(spentByDay.get(entry.day) ?? 0) + entry.hours * project.rate,
		);
	}
	// The plan spreads the fee evenly over the calendar. A retainer spreads one fee over each month.
	const plannedPerDay =
		project.dueDay === null
			? project.budget / DAYS_PER_MONTH
			: project.budget /
				Math.max(1, daysBetween(project.startDay, project.dueDay));
	const burn: BurnPoint[] = [];
	let spent = 0;
	for (
		let offset = 0;
		daysBetween(addDays(firstDay, offset), lastDay) >= 0;
		offset++
	) {
		const day = addDays(firstDay, offset);
		spent += spentByDay.get(day) ?? 0;
		burn.push({
			day,
			spent: Math.round(spent),
			planned: Math.round(plannedPerDay * (offset + 1)),
		});
	}

	// A team id with no member row (a person who left) has no name or role to show, so it is left out.
	const people = project.teamIds.flatMap((memberId): ProjectPerson[] => {
		const member = data.members.find((row) => row.id === memberId);
		if (!member) {
			return [];
		}
		const own = entries.filter((entry) => entry.memberId === memberId);
		return [
			{
				id: memberId,
				name: member.name,
				role: member.role,
				hours: own.reduce((sum, entry) => sum + entry.hours, 0),
				lastDay: own.reduce<Day | null>(
					(last, entry) =>
						last === null || daysBetween(last, entry.day) > 0
							? entry.day
							: last,
					null,
				),
				isLead: memberId === project.leadId,
			},
		];
	});

	return {
		project,
		deliverables: data.deliverables
			.filter((deliverable) => deliverable.projectId === projectId)
			// A retainer keeps every cycle. The page shows the cycles of the last 90 days and the next ones.
			.filter(
				(deliverable) =>
					!isRetainer ||
					deliverable.approvedDay === null ||
					isInLastDays(deliverable.approvedDay, RETAINER_BURN_DAYS),
			),
		people,
		invoices: summarizeInvoices(data).filter(
			(invoice) => invoice.projectId === projectId,
		),
		burn,
		burnBudget: isRetainer
			? Math.round((project.budget * RETAINER_BURN_DAYS) / DAYS_PER_MONTH)
			: project.budget,
	};
}
