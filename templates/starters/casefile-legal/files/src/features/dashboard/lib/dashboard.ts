// The math of the dashboard: the billable target, the three KPIs, hours by practice area, the stage
// pipeline, the team highlights, the hours per day, and the upcoming deadlines. dashboard.queries.ts calls these functions in its queryFn.
// It is pure: every function takes the rows, the period in days, and "now", so a later SQL function gives the same numbers.
import {
	addLocalDays,
	buildDailySeries,
	changeRatio,
	type DailyPoint,
	type DeadlineRow,
	dayKeyOf,
	type MatterRow,
	PRACTICE_AREAS,
	type PracticeArea,
	type SampleTables,
	STAGE_PATH,
	startOfLocalDay,
	toTenths,
} from "~/features/practice";

/**
 * Billable hours that one person of the firm aims to log in a year.
 * 1,800 is a common target of a small firm. The target of a period is its share of the year.
 */
export const ANNUAL_BILLABLE_TARGET_HOURS = 1800;

// 3 areas and one "Other" slice keep the donut legend in one row of 4, as in the kit.
const SHOWN_AREAS = 3;

/** One figure with its change against the period before. `change` is null when the period before is 0. */
export type Figure = { value: number; change: number | null };

/** One slice of the hours donut. `area` is a practice area, or "other" for the sum of the smaller areas. */
export type AreaSlice = { area: PracticeArea | "other"; hours: number };

/** One row of the stage pipeline: the open matters of a stage now, or the matters closed in the period. */
export type StageRow = {
	stage: (typeof STAGE_PATH)[number];
	count: number;
	/** Hours logged in the period on the matters of the row, one decimal. */
	hours: number;
};

/** Every number of the dashboard for one period. Amounts are whole USD. */
export type DashboardSummary = {
	/** Billable hours of the period against the target of the whole team for the period. */
	billable: { hours: number; target: number };
	/** Open matters now, against open matters at the start of the period. `opened` counts the new ones. */
	openMatters: Figure & { opened: number };
	/** Billable time that no invoice charges yet, now against the start of the period. */
	unbilled: Figure & { matterCount: number };
	/** Open balance past its due date, now against the start of the period. */
	overdue: Figure & { count: number };
	areas: AreaSlice[];
	stages: StageRow[];
	team: {
		/** Names of the people of the firm, the most billable hours of the period first. */
		names: string[];
		/** Payments received in the period. */
		collected: Figure;
		/** Billed amount per billable hour in the period, in USD. */
		averageRate: Figure;
		/** Billable hours divided by all hours of the period, from 0 to 1. */
		billableShare: Figure;
	};
};

/** The open balance of the invoices past their due date at `moment`, and their count. */
function overdueAt(tables: SampleTables, moment: number) {
	let amount = 0;
	let count = 0;
	for (const invoice of tables.invoices) {
		if (
			Date.parse(invoice.issuedAt) > moment ||
			Date.parse(invoice.dueAt) >= moment
		) {
			continue;
		}
		const paid = tables.payments
			.filter(
				(payment) =>
					payment.invoiceId === invoice.id &&
					Date.parse(payment.paidAt) <= moment,
			)
			.reduce((sum, payment) => sum + payment.amount, 0);
		if (paid < invoice.amount) {
			amount += invoice.amount - paid;
			count += 1;
		}
	}
	return { amount, count };
}

/** True while the matter is open at `moment`: opened by then, and not closed or declined by then. */
function isOpenAt(matter: MatterRow, moment: number): boolean {
	return (
		Date.parse(matter.openedAt) <= moment &&
		(matter.closedAt === null || Date.parse(matter.closedAt) > moment)
	);
}

/** Every number of the dashboard for the last `days` local days up to now. */
export function buildDashboardSummary(
	tables: SampleTables,
	days: number,
	now: number,
): DashboardSummary {
	const today = startOfLocalDay(now);
	const periodStart = addLocalDays(today, -(days - 1));
	const previousStart = addLocalDays(today, -(2 * days - 1));
	// Day keys are YYYY-MM-DD, so a text compare is a date compare.
	const firstDay = dayKeyOf(periodStart);
	const previousFirstDay = dayKeyOf(previousStart);
	const startDay = dayKeyOf(addLocalDays(periodStart, -1));
	const matterOf = new Map(tables.matters.map((matter) => [matter.id, matter]));
	const attorneyName = new Map(
		tables.attorneys.map((attorney) => [attorney.id, attorney.name]),
	);
	const issuedAt = new Map(
		tables.invoices.map((invoice) => [
			invoice.id,
			Date.parse(invoice.issuedAt),
		]),
	);

	const current = { all: 0, billable: 0, amount: 0 };
	const previous = { all: 0, billable: 0, amount: 0 };
	let unbilled = 0;
	let unbilledAtStart = 0;
	const unbilledMatters = new Set<string>();
	const hoursOfArea = new Map<PracticeArea, number>(
		PRACTICE_AREAS.map((area) => [area, 0]),
	);
	const hoursOfMatter = new Map<string, number>();
	const billableOfAttorney = new Map<string, number>(
		tables.attorneys.map((attorney) => [attorney.id, 0]),
	);
	for (const entry of tables.timeEntries) {
		const bucket =
			entry.day >= firstDay
				? current
				: entry.day >= previousFirstDay
					? previous
					: null;
		if (bucket) {
			bucket.all += entry.hours;
			if (entry.billable) {
				bucket.billable += entry.hours;
				bucket.amount += entry.amount;
			}
		}
		if (bucket === current) {
			const area = matterOf.get(entry.matterId)?.area;
			if (area) {
				hoursOfArea.set(area, (hoursOfArea.get(area) ?? 0) + entry.hours);
			}
			hoursOfMatter.set(
				entry.matterId,
				(hoursOfMatter.get(entry.matterId) ?? 0) + entry.hours,
			);
			if (entry.billable) {
				billableOfAttorney.set(
					entry.attorneyId,
					(billableOfAttorney.get(entry.attorneyId) ?? 0) + entry.hours,
				);
			}
		}
		if (!entry.billable) {
			continue;
		}
		if (entry.invoiceId === null) {
			unbilled += entry.amount;
			unbilledMatters.add(entry.matterId);
		}
		// Unbilled at the start: logged before the period, and charged by an invoice of the period or not at all.
		const issued =
			entry.invoiceId === null ? null : issuedAt.get(entry.invoiceId);
		if (entry.day <= startDay && (issued == null || issued >= periodStart)) {
			unbilledAtStart += entry.amount;
		}
	}

	const openNow = tables.matters.filter((matter) => isOpenAt(matter, now));
	const openAtStart = tables.matters.filter((matter) =>
		isOpenAt(matter, periodStart),
	).length;
	const overdueNow = overdueAt(tables, now);
	const overdueAtStart = overdueAt(tables, periodStart);

	const rankedAreas = [...hoursOfArea.entries()]
		.filter(([, hours]) => hours > 0)
		.sort((first, second) => second[1] - first[1]);
	const otherHours = rankedAreas
		.slice(SHOWN_AREAS)
		.reduce((sum, [, hours]) => sum + hours, 0);
	const areas: AreaSlice[] = [
		...rankedAreas
			.slice(0, SHOWN_AREAS)
			.map(([area, hours]) => ({ area, hours: toTenths(hours) })),
		...(otherHours > 0
			? [{ area: "other" as const, hours: toTenths(otherHours) }]
			: []),
	];

	// The closed row keeps only the matters closed in the period, else it grows forever.
	const stages: StageRow[] = STAGE_PATH.map((stage) => {
		const matters = tables.matters.filter(
			(matter) =>
				matter.stage === stage &&
				(stage !== "closed" ||
					(matter.closedAt !== null &&
						Date.parse(matter.closedAt) >= periodStart)),
		);
		return {
			stage,
			count: matters.length,
			hours: toTenths(
				matters.reduce(
					(sum, matter) => sum + (hoursOfMatter.get(matter.id) ?? 0),
					0,
				),
			),
		};
	});

	const collectedIn = (start: number, end: number) =>
		tables.payments
			.filter((payment) => {
				const paid = Date.parse(payment.paidAt);
				return paid >= start && paid < end;
			})
			.reduce((sum, payment) => sum + payment.amount, 0);
	const collected = collectedIn(periodStart, now + 1);
	const collectedBefore = collectedIn(previousStart, periodStart);
	const rateOf = (bucket: typeof current) =>
		bucket.billable === 0 ? 0 : Math.round(bucket.amount / bucket.billable);
	const shareOf = (bucket: typeof current) =>
		bucket.all === 0 ? 0 : bucket.billable / bucket.all;

	return {
		billable: {
			hours: toTenths(current.billable),
			target: Math.round(
				(tables.attorneys.length * ANNUAL_BILLABLE_TARGET_HOURS * days) / 365,
			),
		},
		openMatters: {
			value: openNow.length,
			change: changeRatio(openNow.length, openAtStart),
			opened: openNow.filter(
				(matter) => Date.parse(matter.openedAt) >= periodStart,
			).length,
		},
		unbilled: {
			value: unbilled,
			change: changeRatio(unbilled, unbilledAtStart),
			matterCount: unbilledMatters.size,
		},
		overdue: {
			value: overdueNow.amount,
			change: changeRatio(overdueNow.amount, overdueAtStart.amount),
			count: overdueNow.count,
		},
		areas,
		stages,
		team: {
			names: [...billableOfAttorney.entries()]
				.sort((first, second) => second[1] - first[1])
				.map(([attorneyId]) => attorneyName.get(attorneyId) ?? ""),
			collected: {
				value: collected,
				change: changeRatio(collected, collectedBefore),
			},
			averageRate: {
				value: rateOf(current),
				change: changeRatio(rateOf(current), rateOf(previous)),
			},
			billableShare: {
				value: shareOf(current),
				change: changeRatio(shareOf(current), shareOf(previous)),
			},
		},
	};
}

/**
 * Days in the rolling average of the hours chart.
 * One full week holds one weekend, so the chart has no weekend drop to 0.
 */
const HOURS_AVERAGE_DAYS = 7;

/**
 * One day of the hours chart. `day` is YYYY-MM-DD in the browser time zone.
 * Each value is the mean hours per day of the 7 days that end on `day`, one decimal.
 */
export type HoursPoint = { day: string; billable: number; nonBillable: number };

/** The hours chart: smoothed points, plus the real hour totals of the period for the chart label. */
export type HoursSeries = {
	/** One point per day of the period, oldest first. */
	points: HoursPoint[];
	/** Sum of the billable hours logged in the period, one decimal. */
	billableTotal: number;
	/** Sum of the other hours logged in the period, one decimal. */
	nonBillableTotal: number;
};

/** Billable and non-billable hours per local day for the last `days` days, as a 7-day rolling average. */
export function hoursPerDay(
	tables: SampleTables,
	days: number,
	now: number,
): HoursSeries {
	const billableByDay = new Map<string, number>();
	const otherByDay = new Map<string, number>();
	for (const entry of tables.timeEntries) {
		const target = entry.billable ? billableByDay : otherByDay;
		target.set(entry.day, (target.get(entry.day) ?? 0) + entry.hours);
	}
	// The series starts 6 days before the period, so the first day of the period also averages a full week.
	const lead = HOURS_AVERAGE_DAYS - 1;
	const billable = buildDailySeries(days + lead, now, billableByDay);
	const others = buildDailySeries(days + lead, now, otherByDay);
	const weekAverage = (series: DailyPoint[], end: number) =>
		series
			.slice(end - lead, end + 1)
			.reduce((sum, point) => sum + point.current, 0) / HOURS_AVERAGE_DAYS;
	const periodTotal = (series: DailyPoint[]) =>
		toTenths(series.slice(lead).reduce((sum, point) => sum + point.current, 0));
	return {
		points: billable.slice(lead).map((point, index) => ({
			day: point.day,
			billable: toTenths(weekAverage(billable, index + lead)),
			nonBillable: toTenths(weekAverage(others, index + lead)),
		})),
		billableTotal: periodTotal(billable),
		nonBillableTotal: periodTotal(others),
	};
}

/** One deadline with the names that the deadline card shows. */
export type DeadlineItem = DeadlineRow & {
	matterName: string;
	clientName: string;
};

/** Every deadline, the soonest first. The table holds only future rows, so no filter on the date is needed. */
export function buildUpcomingDeadlines(tables: SampleTables): DeadlineItem[] {
	const matterOf = new Map(tables.matters.map((matter) => [matter.id, matter]));
	const clientName = new Map(
		tables.clients.map((client) => [client.id, client.name]),
	);
	return tables.deadlines
		.map((deadline) => {
			const matter = matterOf.get(deadline.matterId);
			return {
				...deadline,
				matterName: matter?.name ?? "",
				clientName: clientName.get(matter?.clientId ?? "") ?? "",
			};
		})
		.sort((first, second) => first.dueAt.localeCompare(second.dueAt));
}
