// The figures of the home page: the visits per day, the figures of the last 7 days, and the progress of today.
// today.queries.ts calls the build functions with the appointment rows. The home panels take the types.
// Every function is pure: the same rows and the same `now` give the same figures.
import {
	type AppointmentRow,
	addDays,
	DAY_MS,
	isLate,
	MINUTE_MS,
	NO_SHOW_AFTER_MINUTES,
	type Patient,
	startOfLocalDay,
	toIsoDay,
} from "~/features/clinic";
import type { TranslationKey } from "~/shared/i18n";

/** The period choices of the trend panel, in days. The book holds 90 days of history. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The period of the figures panel, in days. It equals the shortest period of the trend panel. */
export const FIGURES_DAYS = 7;

/** One day of the trend, oldest first in a list. */
export type DailyPoint = {
	/** The day as `YYYY-MM-DD` in the browser time zone. */
	day: string;
	/** Visits done on that day. Zero on a day with no visit. */
	current: number;
	/** Visits done on the same day one period earlier. Zero before the start of the book. */
	previous: number;
};

/** One figure of the home page. */
export type KpiItem = {
	/** Stable id, also the React key and the key of the icon map, for example "visits". */
	id: string;
	/** Label, already translated. */
	label: string;
	value: number;
	/** Intl options of the value, for example { style: "percent" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for no-shows and waiting times: a fall is good news. */
	goodWhen: "up" | "down";
};

/** One figure before translation. The home turns `labelKey` into the `label` of KpiItem with t(). */
export type WeekKpi = Omit<KpiItem, "label"> & { labelKey: TranslationKey };

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** Visits done per day for the last `days` days, today included. The last point grows during the day. */
export function buildDailyVisits(
	rows: readonly AppointmentRow[],
	days: number,
	now: number,
): DailyPoint[] {
	const todayStart = startOfLocalDay(now);
	const doneByDay = new Map<string, number>();
	for (const row of rows) {
		if (row.status === "completed") {
			const day = toIsoDay(row.startsAt);
			doneByDay.set(day, (doneByDay.get(day) ?? 0) + 1);
		}
	}
	return Array.from({ length: days }, (_, index) => {
		const dayStart = addDays(todayStart, index - (days - 1));
		return {
			day: toIsoDay(dayStart),
			current: doneByDay.get(toIsoDay(dayStart)) ?? 0,
			previous: doneByDay.get(toIsoDay(addDays(dayStart, -days))) ?? 0,
		};
	});
}

// The totals of one period of 7 days.
type PeriodTotals = {
	visits: number;
	noShows: number;
	waitMinutes: number;
	newPatients: number;
};

// The totals of the 7 days that end at `end`. Only steps that ended at `end` or before count,
// so the earlier period stops at the same hour as the current one.
function totalsOfPeriod(
	rows: readonly AppointmentRow[],
	patients: readonly Patient[],
	end: number,
): PeriodTotals {
	const start = addDays(startOfLocalDay(end), -(FIGURES_DAYS - 1));
	const totals = { visits: 0, noShows: 0, waitMinutes: 0, newPatients: 0 };
	for (const row of rows) {
		if (row.startsAt < start || row.startsAt > end) {
			continue;
		}
		if (
			row.status === "completed" &&
			row.endedAt !== null &&
			row.endedAt <= end &&
			row.checkedInAt !== null &&
			row.startedAt !== null
		) {
			totals.visits += 1;
			totals.waitMinutes += (row.startedAt - row.checkedInAt) / MINUTE_MS;
		}
		if (
			row.status === "no_show" &&
			row.startsAt + NO_SHOW_AFTER_MINUTES * MINUTE_MS <= end
		) {
			totals.noShows += 1;
		}
	}
	totals.newPatients = patients.filter(
		(patient) => patient.registeredAt >= start && patient.registeredAt <= end,
	).length;
	return totals;
}

// No closed appointment gives no rate, so no delta shows.
function rate(part: number, total: number): number | null {
	return total === 0 ? null : part / total;
}

/**
 * The 4 figures of the last 7 days, the most important first.
 * Each one compares with the 7 days before, up to the same hour of the day.
 */
export function buildWeekKpis(
	rows: readonly AppointmentRow[],
	patients: readonly Patient[],
	now: number,
): WeekKpi[] {
	const current = totalsOfPeriod(rows, patients, now);
	const previous = totalsOfPeriod(rows, patients, now - FIGURES_DAYS * DAY_MS);
	const noShowRate = rate(current.noShows, current.visits + current.noShows);
	const previousNoShowRate = rate(
		previous.noShows,
		previous.visits + previous.noShows,
	);
	const wait = rate(current.waitMinutes, current.visits);
	const previousWait = rate(previous.waitMinutes, previous.visits);
	return [
		{
			id: "visits",
			labelKey: "metrics.visits",
			value: current.visits,
			change: changeRatio(current.visits, previous.visits),
			goodWhen: "up",
		},
		{
			id: "new-patients",
			labelKey: "metrics.newPatients",
			value: current.newPatients,
			change: changeRatio(current.newPatients, previous.newPatients),
			goodWhen: "up",
		},
		{
			id: "no-show-rate",
			labelKey: "metrics.noShowRate",
			value: noShowRate ?? 0,
			format: { style: "percent", maximumFractionDigits: 1 },
			change:
				noShowRate === null || previousNoShowRate === null
					? null
					: changeRatio(noShowRate, previousNoShowRate),
			goodWhen: "down",
		},
		{
			id: "wait",
			labelKey: "metrics.averageWait",
			value: wait ?? 0,
			// The wait is in minutes, from the check-in to the start of the consultation.
			format: {
				style: "unit",
				unit: "minute",
				unitDisplay: "short",
				maximumFractionDigits: 0,
			},
			change:
				wait === null || previousWait === null
					? null
					: changeRatio(wait, previousWait),
			goodWhen: "down",
		},
	];
}

/** Where the appointments of today stand. `total` is the sum of the 6 counts before `cancelled`. */
export type DayProgress = {
	/** Appointments of today that nobody cancelled. */
	total: number;
	/** Consultations that ended. */
	seen: number;
	/** Patients with a practitioner now. */
	inConsultation: number;
	/** Patients in the waiting room. */
	waiting: number;
	/** Expected patients whose start time passed. */
	late: number;
	/** Expected patients whose start time is still to come. */
	toCome: number;
	noShows: number;
	/** Cancelled appointments of today. They are not part of `total`. */
	cancelled: number;
};

/** Counts the appointments of today by their place in the day. `rows` holds only the rows of today. */
export function buildDayProgress(
	rows: readonly AppointmentRow[],
	now: number,
): DayProgress {
	const progress: DayProgress = {
		total: 0,
		seen: 0,
		inConsultation: 0,
		waiting: 0,
		late: 0,
		toCome: 0,
		noShows: 0,
		cancelled: 0,
	};
	for (const row of rows) {
		if (row.status === "cancelled") {
			progress.cancelled += 1;
			continue;
		}
		progress.total += 1;
		if (row.status === "completed") {
			progress.seen += 1;
		} else if (row.status === "in_progress") {
			progress.inConsultation += 1;
		} else if (row.status === "checked_in") {
			progress.waiting += 1;
		} else if (row.status === "no_show") {
			progress.noShows += 1;
		} else if (isLate(row, now)) {
			progress.late += 1;
		} else {
			progress.toCome += 1;
		}
	}
	return progress;
}
