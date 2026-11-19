// The rows of the practitioners page: each practitioner with the day, the patient now, and the visits of 30 days.
// practitioners.queries.ts calls these functions with the sample rows. The page and its cards take the types.
// Every function is pure: the same rows and the same `now` give the same result.
import {
	type AppointmentRow,
	addDays,
	type Practitioner,
	rowsOfDay,
	type Shift,
	shiftOn,
	startOfLocalDay,
} from "~/features/clinic";

// The period of the visit counts of this page, in days, today included.
const TEAM_PERIOD_DAYS = 30;

/** One practitioner with the facts that a table row shows. */
export type PractitionerRow = Practitioner & {
	/** The shift of today, or null on a day off. */
	shiftToday: Shift | null;
	/** Appointments of today that nobody cancelled. */
	todayTotal: number;
	/** Consultations of today that ended. */
	todaySeen: number;
	/** The patient in consultation now, or null. The status column then shows "With a patient". */
	currentAppointment: AppointmentRow | null;
	/** Visits done in the last 30 days, today included. */
	periodVisits: number;
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
		return {
			...practitioner,
			shiftToday: shiftOn(practitioner, todayStart),
			todayTotal: own.length,
			todaySeen: own.filter((row) => row.status === "completed").length,
			currentAppointment:
				own.find((row) => row.status === "in_progress") ?? null,
			periodVisits: periodVisits.filter(
				(row) => row.practitioner.id === practitioner.id,
			).length,
		};
	});
}
