// Builds the numbers of the overview for one period: the KPI items, the running and weekly series, and the service breakdown.
// overviewQueryOptions calls it inside its queryFn. Pure: it reads the sample rows and returns new objects.
// A later Supabase version moves each sum into a SQL read function (see STARTER.md).
import {
	addDays,
	type Day,
	dayFromToday,
	daysBetween,
	isInLastDays,
	isInPreviousDays,
	SERVICES,
	type Service,
	STUDIO_CURRENCY,
	type StudioData,
	summarizeProjects,
	workdaysInLastDays,
} from "~/features/studio";
import { changeRatio, type DailyPoint, type KpiItem } from "./series";

/** The ids of the overview figures, in order of importance. */
export type OverviewKpiId =
	| "deliverables"
	| "billable-hours"
	| "cash-collected"
	| "outstanding"
	| "utilization"
	| "projects-at-risk";

/** One part of the service breakdown, in hours. The page translates the service. */
export type ServiceSlice = { service: Service; value: number };

/** One overview figure with its typed id. */
export type OverviewKpi = KpiItem & { id: OverviewKpiId };

/** Everything the overview shows for one period. */
export type Overview = {
	kpis: OverviewKpi[];
	/** Deliverables approved, as a running total over each period. */
	deliverables: DailyPoint[];
	/** Billable hours, as a running total over each period. The line is flat on weekends. */
	hours: DailyPoint[];
	/** Cash collected, as a running total over each period. */
	cash: DailyPoint[];
	/** Deliverables approved in the 7 days up to each day. The entity rows plot it. */
	weeklyDeliverables: DailyPoint[];
	/** Billable hours in the 7 days up to each day. A full week has no weekend dip. */
	weeklyHours: DailyPoint[];
	/** Cash collected in the 7 days up to each day. */
	weeklyCash: DailyPoint[];
	/** Billable hours by service in the period, the largest first. Services with no hours are left out. */
	hoursByService: ServiceSlice[];
};

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

/** Adds `value` to the total of `day`. */
function addTo(totals: Map<Day, number>, day: Day, value: number) {
	totals.set(day, (totals.get(day) ?? 0) + value);
}

/**
 * One point per day for the last `days` complete days, oldest first, with the same day one period earlier.
 * Each value is a running total from the first day of its period, so the two lines compare the progress of each period.
 */
function buildRunningSeries(
	totals: Map<Day, number>,
	days: number,
): DailyPoint[] {
	const points: DailyPoint[] = [];
	let current = 0;
	let previous = 0;
	for (let index = 0; index < days; index++) {
		const day = dayFromToday(index - days);
		current += totals.get(day) ?? 0;
		previous += totals.get(addDays(day, -days)) ?? 0;
		points.push({ day, current, previous });
	}
	return points;
}

// A trailing week holds every weekday once, so the weekly line shows the real rhythm and no weekend dip.
const WEEK_DAYS = 7;

/**
 * One point per day for the last `days` complete days, oldest first, with the same day one period earlier.
 * Each value is the sum of the 7 days that end on that day, so the line shows the ups and downs of the work.
 */
function buildWeeklySeries(
	totals: Map<Day, number>,
	days: number,
): DailyPoint[] {
	const weekUpTo = (day: Day) => {
		let sum = 0;
		for (let back = 0; back < WEEK_DAYS; back++) {
			sum += totals.get(addDays(day, -back)) ?? 0;
		}
		return sum;
	};
	const points: DailyPoint[] = [];
	for (let index = 0; index < days; index++) {
		const day = dayFromToday(index - days);
		points.push({
			day,
			current: weekUpTo(day),
			previous: weekUpTo(addDays(day, -days)),
		});
	}
	return points;
}

/** The totals of the last `days` complete days and of the `days` days before them. */
function periodTotals(totals: Map<Day, number>, days: number) {
	let current = 0;
	let previous = 0;
	for (const [day, value] of totals) {
		if (isInLastDays(day, days)) {
			current += value;
		} else if (isInPreviousDays(day, days)) {
			previous += value;
		}
	}
	return { current, previous };
}

/** The overview of the last `days` complete days. */
export function buildOverview(data: StudioData, days: number): Overview {
	const approvals = new Map<Day, number>();
	for (const deliverable of data.deliverables) {
		if (deliverable.approvedDay !== null) {
			addTo(approvals, deliverable.approvedDay, 1);
		}
	}
	const billable = new Map<Day, number>();
	const serviceOf = new Map(
		data.projects.map((project) => [project.id, project.service]),
	);
	const hoursByService = new Map<Service, number>();
	for (const entry of data.entries) {
		if (entry.projectId === null) {
			continue;
		}
		addTo(billable, entry.day, entry.hours);
		const service = serviceOf.get(entry.projectId);
		if (service && isInLastDays(entry.day, days)) {
			hoursByService.set(
				service,
				(hoursByService.get(service) ?? 0) + entry.hours,
			);
		}
	}
	const cash = new Map<Day, number>();
	for (const invoice of data.invoices) {
		if (invoice.paidDay !== null) {
			addTo(cash, invoice.paidDay, invoice.amount);
		}
	}

	const approved = periodTotals(approvals, days);
	const hours = periodTotals(billable, days);
	const collected = periodTotals(cash, days);
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
	const previousOutstanding = outstandingOn(data, dayFromToday(-days - 1));
	const atRisk = summarizeProjects(data).filter(
		(project) =>
			project.health === "at_risk" || project.health === "over_budget",
	).length;
	const money = {
		style: "currency",
		currency: STUDIO_CURRENCY,
		maximumFractionDigits: 0,
	} as const;

	return {
		kpis: [
			{
				id: "deliverables",
				value: approved.current,
				change: changeRatio(approved.current, approved.previous),
				goodWhen: "up",
			},
			{
				id: "billable-hours",
				value: hours.current,
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
				id: "cash-collected",
				value: collected.current,
				format: money,
				change: changeRatio(collected.current, collected.previous),
				goodWhen: "up",
			},
			{
				id: "outstanding",
				value: outstanding,
				format: money,
				change: changeRatio(outstanding, previousOutstanding),
				goodWhen: "down",
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
			// The sample keeps no history of project health, so this figure shows no delta. The page adds a note.
			{ id: "projects-at-risk", value: atRisk, change: null, goodWhen: "down" },
		],
		deliverables: buildRunningSeries(approvals, days),
		hours: buildRunningSeries(billable, days),
		cash: buildRunningSeries(cash, days),
		weeklyDeliverables: buildWeeklySeries(approvals, days),
		weeklyHours: buildWeeklySeries(billable, days),
		weeklyCash: buildWeeklySeries(cash, days),
		hoursByService: SERVICES.map((service) => ({
			service,
			value: Math.round(hoursByService.get(service) ?? 0),
		}))
			.filter((slice) => slice.value > 0)
			.sort((first, second) => second.value - first.value),
	};
}
