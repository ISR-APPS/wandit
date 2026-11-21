// Builds the numbers of the home for one period: the KPIs, the hours chart, the team card, the reminders,
// the approvals of the last three months, and the hours by service.
// overviewQueryOptions calls it inside its queryFn. Pure: it reads the sample rows and returns new objects.
// A later Supabase version moves each sum into a SQL read function (see STARTER.md).
import {
	type Day,
	type DeliverableStatus,
	dayFromToday,
	daysBetween,
	daysFromToday,
	isInLastDays,
	isInPreviousDays,
	isWeekend,
	type Priority,
	priorityOf,
	SERVICES,
	type Service,
	STUDIO_CURRENCY,
	type StudioData,
	summarizeProjects,
	workdaysInLastDays,
} from "~/features/studio";
import { changeRatio, type KpiItem } from "./series";

/** The ids of the four KPI cards, in order. */
export type OverviewKpiId =
	| "active-projects"
	| "revenue"
	| "utilization"
	| "outstanding";

/** One KPI card with its typed id. */
export type OverviewKpi = KpiItem & { id: OverviewKpiId };

/** The ids of the three highlight rows of the team card. */
export type HighlightId = "rate" | "hours-per-person" | "invoice";

/** One highlight row of the team card with its typed id. */
export type Highlight = KpiItem & { id: HighlightId };

/** Hours of the whole studio on one workday. The series has no weekend days. */
export type HoursPoint = {
	day: Day;
	/** Hours on client projects. */
	billable: number;
	/** Hours on internal work, pitches, and admin. */
	studio: number;
};

/** One member of the avatar row of the team card. */
export type BusyMember = { id: string; name: string; billable: number };

/** One upcoming deliverable of the reminder cards. */
export type Reminder = {
	id: string;
	name: string;
	projectId: string;
	projectName: string;
	service: Service;
	dueDay: Day;
	status: DeliverableStatus;
	/** Null for an approved deliverable, as on the task board. */
	priority: Priority | null;
};

/** The approved deliverables of one complete calendar month. */
export type MonthCount = {
	/** The first day of the month. */
	month: Day;
	count: number;
};

/** One part of the service donut, in billable hours of the period. */
export type ServiceSlice = { service: Service; value: number };

/** Everything the home shows for one period. */
export type Overview = {
	kpis: OverviewKpi[];
	/** One point per workday of the last 90 complete days, oldest first. The chart card cuts it to 7, 30, or 90 days. */
	hours: HoursPoint[];
	/** People of the studio. */
	headcount: number;
	/** The 6 people with the most billable hours in the period, the most first. */
	busiest: BusyMember[];
	highlights: Highlight[];
	/** Deliverables due today or in the next 14 days, the nearest first. Approved ones show as done. */
	reminders: Reminder[];
	/** The last three complete months, the newest first. */
	approvedByMonth: MonthCount[];
	/** Billable hours by service in the period, in the order of SERVICES. */
	hoursByService: ServiceSlice[];
};

// The hours chart can show up to 90 days, the longest period of the page.
const HOURS_SERIES_DAYS = 90;
// The reminder cards look two weeks ahead.
const REMINDER_DAYS = 14;
// The avatar row of the team card shows six people, as the kit card does.
const BUSIEST_COUNT = 6;
// The approvals card compares three months.
const APPROVAL_MONTHS = 3;

/** Euros of sent invoices still unpaid at the end of `day`. A draft has a future issue day, so it never counts. */
function outstandingOn(data: StudioData, day: Day): number {
	return data.invoices
		.filter(
			(invoice) =>
				daysBetween(invoice.issueDay, day) >= 0 &&
				(invoice.paidDay === null || daysBetween(invoice.paidDay, day) < 0),
		)
		.reduce((sum, invoice) => sum + invoice.amount, 0);
}

/** The sum of `value` over the rows of the period and over the rows of the period before it. */
function periodSums<Row>(
	rows: Row[],
	dayOf: (row: Row) => Day,
	value: (row: Row) => number,
	days: number,
) {
	let current = 0;
	let previous = 0;
	for (const row of rows) {
		if (isInLastDays(dayOf(row), days)) {
			current += value(row);
		} else if (isInPreviousDays(dayOf(row), days)) {
			previous += value(row);
		}
	}
	return { current, previous };
}

/** "YYYY-MM-01" of the month `monthsBack` months before the current month. */
function monthStart(monthsBack: number): Day {
	const today = new Date();
	const start = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
	const month = String(start.getMonth() + 1).padStart(2, "0");
	return `${start.getFullYear()}-${month}-01`;
}

/** The home of the last `days` complete days. */
export function buildOverview(data: StudioData, days: number): Overview {
	const projects = summarizeProjects(data);
	const projectById = new Map(projects.map((project) => [project.id, project]));
	const billableEntries = data.entries.filter(
		(entry) => entry.projectId !== null,
	);

	// Live now against the projects that ran by plan on the last day before the period.
	const periodStart = dayFromToday(-days - 1);
	const liveNow = projects.filter((project) => project.isLive).length;
	const liveBefore = projects.filter(
		(project) =>
			daysBetween(project.startDay, periodStart) >= 0 &&
			(project.dueDay === null ||
				daysBetween(periodStart, project.dueDay) >= 0),
	).length;

	const sentInvoices = data.invoices.filter(
		(invoice) => invoice.status !== "draft",
	);
	const revenue = periodSums(
		sentInvoices,
		(invoice) => invoice.issueDay,
		(invoice) => invoice.amount,
		days,
	);
	const invoiceCount = periodSums(
		sentInvoices,
		(invoice) => invoice.issueDay,
		() => 1,
		days,
	);

	const hours = periodSums(
		billableEntries,
		(entry) => entry.day,
		(entry) => entry.hours,
		days,
	);
	// Hours times the blended rate of the project give the euros of the work.
	const billedValue = periodSums(
		billableEntries,
		(entry) => entry.day,
		(entry) =>
			entry.hours * (projectById.get(entry.projectId ?? "")?.rate ?? 0),
		days,
	);
	// Capacity: contract hours of every member over the workdays of the period. A 32-hour week gives 6.4 a day.
	const dailyCapacity = data.members.reduce(
		(sum, member) => sum + member.weeklyCapacity / 5,
		0,
	);
	const capacity = dailyCapacity * workdaysInLastDays(days);
	// Two periods of the same length can differ by a few workdays, so each period has its own capacity.
	const previousCapacity =
		dailyCapacity * (workdaysInLastDays(2 * days) - workdaysInLastDays(days));
	const utilization = capacity === 0 ? 0 : hours.current / capacity;
	const previousUtilization =
		previousCapacity === 0 ? 0 : hours.previous / previousCapacity;
	// Open money now (end of yesterday) against open money on the last day before the period.
	const outstanding = outstandingOn(data, dayFromToday(-1));
	const previousOutstanding = outstandingOn(data, periodStart);
	const money = {
		style: "currency",
		currency: STUDIO_CURRENCY,
		maximumFractionDigits: 0,
	} as const;

	const hoursByDay = new Map<Day, HoursPoint>();
	for (let index = 0; index < HOURS_SERIES_DAYS; index++) {
		const day = dayFromToday(index - HOURS_SERIES_DAYS);
		hoursByDay.set(day, { day, billable: 0, studio: 0 });
	}
	const billableByMember = new Map<string, number>();
	const hoursByService = new Map<Service, number>();
	for (const entry of data.entries) {
		const point = hoursByDay.get(entry.day);
		if (point) {
			if (entry.projectId === null) {
				point.studio += entry.hours;
			} else {
				point.billable += entry.hours;
			}
		}
		if (entry.projectId !== null && isInLastDays(entry.day, days)) {
			billableByMember.set(
				entry.memberId,
				(billableByMember.get(entry.memberId) ?? 0) + entry.hours,
			);
			const service = projectById.get(entry.projectId)?.service;
			if (service) {
				hoursByService.set(
					service,
					(hoursByService.get(service) ?? 0) + entry.hours,
				);
			}
		}
	}

	const headcount = data.members.length;
	const reminders: Reminder[] = data.deliverables
		.filter((deliverable) => {
			const daysLeft = daysFromToday(deliverable.dueDay);
			return daysLeft >= 0 && daysLeft <= REMINDER_DAYS;
		})
		.sort((first, second) => first.dueDay.localeCompare(second.dueDay))
		.flatMap((deliverable) => {
			const project = projectById.get(deliverable.projectId);
			// A deliverable with no project has no service tag and no link target, so it gets no card.
			if (!project) {
				return [];
			}
			return [
				{
					id: deliverable.id,
					name: deliverable.name,
					projectId: deliverable.projectId,
					projectName: project.name,
					service: project.service,
					dueDay: deliverable.dueDay,
					status: deliverable.status,
					// The task board rule: an approved deliverable needs no action, so it has no priority.
					priority:
						deliverable.status === "approved"
							? null
							: priorityOf(deliverable.dueDay),
				},
			];
		});

	const approvedByMonth: MonthCount[] = [];
	for (let back = 1; back <= APPROVAL_MONTHS; back++) {
		const month = monthStart(back);
		const nextMonth = monthStart(back - 1);
		approvedByMonth.push({
			month,
			count: data.deliverables.filter(
				(deliverable) =>
					deliverable.approvedDay !== null &&
					deliverable.approvedDay >= month &&
					deliverable.approvedDay < nextMonth,
			).length,
		});
	}

	// A period with no hours or no invoices has no average. Zero avoids NaN on the team card.
	const rate = hours.current === 0 ? 0 : billedValue.current / hours.current;
	const previousRate =
		hours.previous === 0 ? 0 : billedValue.previous / hours.previous;
	const invoiceAverage =
		invoiceCount.current === 0 ? 0 : revenue.current / invoiceCount.current;
	const previousInvoiceAverage =
		invoiceCount.previous === 0 ? 0 : revenue.previous / invoiceCount.previous;

	return {
		kpis: [
			{
				id: "active-projects",
				value: liveNow,
				change: changeRatio(liveNow, liveBefore),
				goodWhen: "up",
			},
			{
				id: "revenue",
				value: revenue.current,
				format: money,
				change: changeRatio(revenue.current, revenue.previous),
				goodWhen: "up",
			},
			{
				id: "utilization",
				value: utilization,
				format: { style: "percent", maximumFractionDigits: 0 },
				// A share changes in points: 60 % to 76 % is +16 pts, not +26.7 %.
				change:
					previousCapacity === 0 ? null : utilization - previousUtilization,
				changeUnit: "points",
				goodWhen: "up",
			},
			{
				id: "outstanding",
				value: outstanding,
				format: money,
				change: changeRatio(outstanding, previousOutstanding),
				goodWhen: "down",
			},
		],
		// An empty weekend point makes a drop to 0 each week, so the chart leaves it out.
		// A weekend with hours stays, so the chart total agrees with the KPIs.
		hours: [...hoursByDay.values()]
			.filter(
				(point) => !isWeekend(point.day) || point.billable + point.studio > 0,
			)
			.map((point) => ({
				day: point.day,
				billable: Math.round(point.billable),
				studio: Math.round(point.studio),
			})),
		headcount,
		busiest: data.members
			.map((member) => ({
				id: member.id,
				name: member.name,
				billable: billableByMember.get(member.id) ?? 0,
			}))
			.sort((first, second) => second.billable - first.billable)
			.slice(0, BUSIEST_COUNT),
		highlights: [
			{
				id: "rate",
				value: rate,
				format: money,
				change: changeRatio(rate, previousRate),
				goodWhen: "up",
			},
			{
				id: "hours-per-person",
				// A new studio has no members yet. Zero avoids NaN on the team card.
				value: headcount === 0 ? 0 : hours.current / headcount,
				format: {
					style: "unit",
					unit: "hour",
					unitDisplay: "narrow",
					maximumFractionDigits: 0,
				},
				change: changeRatio(hours.current, hours.previous),
				goodWhen: "up",
			},
			{
				id: "invoice",
				value: invoiceAverage,
				format: money,
				change: changeRatio(invoiceAverage, previousInvoiceAverage),
				goodWhen: "up",
			},
		],
		reminders,
		approvedByMonth,
		hoursByService: SERVICES.map((service) => ({
			service,
			value: Math.round(hoursByService.get(service) ?? 0),
		})),
	};
}
