// The rows of the practitioners page: each practitioner with the day, the next patient, and the visits of 30 days.
// practitioners.queries.ts calls these functions with the sample rows. The page and its cards take the types.
// Every function is pure: the same rows and the same `now` give the same result.
import {
	type AppointmentRow,
	addDays,
	isComing,
	type Practitioner,
	rowsOfDay,
	type Shift,
	shiftOn,
	startOfLocalDay,
	type VisitType,
} from "~/features/clinic";

/** The period of the visit counts of this page, in days, today included. */
export const TEAM_PERIOD_DAYS = 30;

/** One practitioner with the facts that a card shows. */
export type PractitionerRow = Practitioner & {
	/** The shift of today, or null on a day off. */
	shiftToday: Shift | null;
	/** Appointments of today that nobody cancelled. */
	todayTotal: number;
	/** Consultations of today that ended. */
	todaySeen: number;
	/** The next patient of today: in the waiting room, or booked later. Null when nobody else comes. */
	nextAppointment: AppointmentRow | null;
	/** The patient in consultation now, or null. The card names this patient when nobody else comes. */
	currentAppointment: AppointmentRow | null;
	/** Local midnight of the next working day after today, in milliseconds since 1970. */
	nextWorkDay: number;
	/** Visits done in the last 30 days, today included. */
	periodVisits: number;
};

/** One part of a breakdown: a code and its count. The page translates the code or shows a name. */
export type BreakdownSlice<Label extends string> = {
	label: Label;
	value: number;
};

// The visits done in the last 30 days, today included.
function visitsOfPeriod(
	appointments: readonly AppointmentRow[],
	now: number,
): AppointmentRow[] {
	const start = addDays(startOfLocalDay(now), -(TEAM_PERIOD_DAYS - 1));
	return appointments.filter(
		(row) => row.status === "completed" && row.startsAt >= start,
	);
}

/** Joins each practitioner with the appointments of today and of the last 30 days. */
export function buildPractitionerRows(
	practitioners: readonly Practitioner[],
	appointments: readonly AppointmentRow[],
	now: number,
): PractitionerRow[] {
	const todayStart = startOfLocalDay(now);
	const today = rowsOfDay(appointments, todayStart, addDays(todayStart, 1));
	const periodVisits = visitsOfPeriod(appointments, now);
	return practitioners.map((practitioner) => {
		const own = today.filter(
			(row) =>
				row.practitioner.id === practitioner.id && row.status !== "cancelled",
		);
		let nextWorkDay = addDays(todayStart, 1);
		// At most 6 steps: every practitioner works on 2 days of the week or more.
		while (shiftOn(practitioner, nextWorkDay) === null) {
			nextWorkDay = addDays(nextWorkDay, 1);
		}
		return {
			...practitioner,
			shiftToday: shiftOn(practitioner, todayStart),
			todayTotal: own.length,
			todaySeen: own.filter((row) => row.status === "completed").length,
			nextAppointment: own.find((row) => isComing(row, now)) ?? null,
			currentAppointment:
				own.find((row) => row.status === "in_progress") ?? null,
			nextWorkDay,
			periodVisits: periodVisits.filter(
				(row) => row.practitioner.id === practitioner.id,
			).length,
		};
	});
}

/** The visits of the last 30 days by kind of visit, the largest first. A kind with no visit is absent. */
export function buildVisitTypeBreakdown(
	appointments: readonly AppointmentRow[],
	now: number,
): BreakdownSlice<VisitType>[] {
	const counts = new Map<VisitType, number>();
	for (const row of visitsOfPeriod(appointments, now)) {
		counts.set(row.visitType, (counts.get(row.visitType) ?? 0) + 1);
	}
	return [...counts]
		.map(([label, value]) => ({ label, value }))
		.sort((first, second) => second.value - first.value);
}
