// The figures of the home for one period: the KPI strip, the departments, the visit types, the visits chart, and the invoices.
// dashboard.queries.ts calls the build functions with the appointment rows. The home cards take the types.
// Every function is pure: the same rows, the same `now`, and the same period give the same figures.
import {
	type AppointmentRow,
	addDays,
	ageInYears,
	changeRatio,
	isInRange,
	type PaymentStatus,
	type PeriodRange,
	paymentStatusOf,
	periodRanges,
	SPECIALTIES,
	type Specialty,
	VISIT_FEES,
	type VisitType,
} from "~/features/clinic";

/** One figure of the KPI strip and its change against the period before. */
export type Figure = {
	value: number;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null when the earlier value is 0. */
	change: number | null;
};

/** One department and the patients that it saw in the period. */
export type DepartmentSlice = { specialty: Specialty; patients: number };

/** One kind of visit in the period. */
export type VisitTypeTotal = {
	visitType: VisitType;
	/** Visits done. */
	visits: number;
	/** Different patients among those visits. */
	patients: number;
};

/** One visit that was done, as a line of the Reports tab. */
export type InvoiceRow = {
	/** The appointment id. */
	id: string;
	/** The start of the visit, in milliseconds since 1970. */
	at: number;
	patientId: string;
	patientName: string;
	specialty: Specialty;
	visitType: VisitType;
	/** The fee, in whole units of CURRENCY. */
	amount: number;
	/** Who pays: the coverage of the patient file. */
	payer: AppointmentRow["patient"]["coverage"];
	status: PaymentStatus;
};

/** The home figures of one period. */
export type DashboardSummary = {
	/** Bookings that start in the period, without the cancelled ones. */
	appointments: Figure;
	/** First visits that were done. */
	newPatients: Figure;
	/** Patients who did not come. A fall is good news. */
	noShows: Figure;
	/** The fees of the visits that were done, in whole units of CURRENCY. */
	revenue: Figure;
	/** Every department, in the order of SPECIALTIES, also at 0. */
	departments: DepartmentSlice[];
	/** Visits done in the period, and in the period before. */
	visits: { total: number; previousTotal: number };
	/** Every kind of visit that was done, the largest first. */
	visitTypes: VisitTypeTotal[];
	/** The visits done in the period, newest first. */
	invoices: InvoiceRow[];
};

/** One point of the visits chart: the visits that started in one bucket, per patient group. */
export type VisitPoint = {
	/** Local midnight of the first day of the bucket. */
	start: number;
	women: number;
	men: number;
	children: number;
};

/** The three patient groups of the visits chart, in legend order. */
export const VISIT_GROUPS = ["women", "men", "children"] as const;

/** Chart series 1 to 3, one per patient group. The chart and its legend read it. */
export const VISIT_GROUP_COLORS = {
	women: "var(--chart-1)",
	men: "var(--chart-2)",
	children: "var(--chart-3)",
} satisfies Record<(typeof VISIT_GROUPS)[number], string>;

/** "all" or one department: the filter of the visits chart. */
export type DepartmentFilter = Specialty | "all";

// Under 16 a patient counts as a child, as in the sample patient files.
const CHILD_UNDER_YEARS = 16;
// The 7-day period shows one point per day. A longer period shows 6 points, as the kit chart does.
const DAILY_POINTS_UP_TO_DAYS = 7;
const GROUPED_POINTS = 6;

/** The days in one point of the visits chart: 1 for 7 days, 5 for 30 days, 15 for 90 days. */
export function visitBucketDays(days: number): number {
	return days <= DAILY_POINTS_UP_TO_DAYS ? 1 : Math.ceil(days / GROUPED_POINTS);
}

// The totals of one range.
function totalsOf(rows: readonly AppointmentRow[], range: PeriodRange) {
	const inRange = rows.filter((row) => isInRange(row.startsAt, range));
	const done = inRange.filter((row) => row.status === "completed");
	return {
		inRange,
		done,
		appointments: inRange.filter((row) => row.status !== "cancelled").length,
		newPatients: done.filter((row) => row.visitType === "first_visit").length,
		noShows: inRange.filter((row) => row.status === "no_show").length,
		revenue: done.reduce((sum, row) => sum + VISIT_FEES[row.visitType], 0),
	};
}

/** The home figures of the last `days` days, today included. `rows` is the whole book with the statuses at `now`. */
export function buildSummary(
	rows: readonly AppointmentRow[],
	days: number,
	now: number,
): DashboardSummary {
	const ranges = periodRanges(days, now);
	const current = totalsOf(rows, ranges.current);
	const previous = totalsOf(rows, ranges.previous);
	const figure = (
		key: "appointments" | "newPatients" | "noShows" | "revenue",
	) => ({
		value: current[key],
		change: changeRatio(current[key], previous[key]),
	});

	const visitTypes = new Map<
		VisitType,
		{ visits: number; patients: Set<string> }
	>();
	const departments = new Map<Specialty, Set<string>>();
	for (const row of current.done) {
		const type = visitTypes.get(row.visitType) ?? {
			visits: 0,
			patients: new Set(),
		};
		type.visits += 1;
		type.patients.add(row.patientId);
		visitTypes.set(row.visitType, type);
		const department = departments.get(row.practitioner.specialty) ?? new Set();
		department.add(row.patientId);
		departments.set(row.practitioner.specialty, department);
	}

	return {
		appointments: figure("appointments"),
		newPatients: figure("newPatients"),
		noShows: figure("noShows"),
		revenue: figure("revenue"),
		departments: SPECIALTIES.map((specialty) => ({
			specialty,
			patients: departments.get(specialty)?.size ?? 0,
		})),
		visits: { total: current.done.length, previousTotal: previous.done.length },
		visitTypes: [...visitTypes]
			.map(([visitType, total]) => ({
				visitType,
				visits: total.visits,
				patients: total.patients.size,
			}))
			.sort((first, second) => second.visits - first.visits),
		invoices: current.done
			.map((row) => ({
				id: row.id,
				at: row.startsAt,
				patientId: row.patientId,
				patientName: row.patient.fullName,
				specialty: row.practitioner.specialty,
				visitType: row.visitType,
				amount: VISIT_FEES[row.visitType],
				payer: row.patient.coverage,
				status: paymentStatusOf(row, now),
			}))
			.reverse(),
	};
}

/**
 * The visits done per bucket of the last `days` days, split into women, men, and children.
 * The bucket size comes from visitBucketDays. The buckets cover the period exactly for 7, 30, and 90 days.
 */
export function buildVisitSeries(
	rows: readonly AppointmentRow[],
	days: number,
	department: DepartmentFilter,
	now: number,
): VisitPoint[] {
	const { current } = periodRanges(days, now);
	const bucketDays = visitBucketDays(days);
	const bucketCount = Math.ceil(days / bucketDays);
	// The last bucket ends today, so the buckets count back from tomorrow.
	const starts = Array.from({ length: bucketCount }, (_, index) =>
		addDays(current.end, -(bucketCount - index) * bucketDays),
	);
	const points: VisitPoint[] = starts.map((start) => ({
		start,
		women: 0,
		men: 0,
		children: 0,
	}));
	for (const row of rows) {
		if (
			row.status !== "completed" ||
			row.startsAt < (starts[0] ?? current.start) ||
			row.startsAt >= current.end ||
			(department !== "all" && row.practitioner.specialty !== department)
		) {
			continue;
		}
		// The bucket of the row is the last one that starts at or before it.
		let index = starts.length - 1;
		while (index > 0 && row.startsAt < (starts[index] ?? 0)) {
			index -= 1;
		}
		const point = points[index];
		if (!point) {
			continue;
		}
		if (ageInYears(row.patient.dateOfBirth, row.startsAt) < CHILD_UNDER_YEARS) {
			point.children += 1;
		} else if (row.patient.sex === "female") {
			point.women += 1;
		} else {
			point.men += 1;
		}
	}
	return points;
}
