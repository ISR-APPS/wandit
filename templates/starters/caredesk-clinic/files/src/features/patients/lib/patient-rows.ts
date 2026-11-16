// The rows of the patient list: each file with its practitioner, its last visit, and its next appointment.
// patients.queries.ts calls `buildPatientRows` with the sample rows. The list and the detail page take the types.
// The function is pure: the same rows and the same `now` give the same result.
import {
	type AppointmentRow,
	ageInYears,
	DAY_MS,
	isComing,
	type Patient,
	type Practitioner,
} from "~/features/clinic";

/** The tabs of the patient list, in order. "all" has no filter. */
export const PATIENT_SEGMENTS = ["all", "booked", "new", "recall"] as const;

/** One tab of the patient list. */
export type PatientSegment = (typeof PATIENT_SEGMENTS)[number];

// A file is "new" for 30 days.
const NEW_FILE_DAYS = 30;
// With no visit for 60 days and no booking, the front desk calls the patient back.
const RECALL_AFTER_DAYS = 60;

/** One patient file with the facts that the list shows. */
export type PatientRow = Patient & {
	/** The practitioner who follows the patient, or null when the id points to no practitioner. */
	primaryPractitioner: Practitioner | null;
	/** The start of the last visit that was done, in milliseconds since 1970, or null. */
	lastVisitAt: number | null;
	/** The next appointment that is still expected, or null. */
	nextAppointment: AppointmentRow | null;
	/** Count of visits that were done. */
	visitCount: number;
	/** True for 30 days after the file opens. */
	isNew: boolean;
	/**
	 * True when no appointment is booked and the last visit is more than 60 days old.
	 * Also true for an older file with no visit done: its only booking was a no-show or was cancelled.
	 */
	isRecallDue: boolean;
};

/** Joins each patient with the practitioner and the appointments. `appointments` is oldest first. */
export function buildPatientRows(
	patients: readonly Patient[],
	appointments: readonly AppointmentRow[],
	practitioners: readonly Practitioner[],
	now: number,
): PatientRow[] {
	const byPatient = new Map<string, AppointmentRow[]>();
	for (const appointment of appointments) {
		const list = byPatient.get(appointment.patientId);
		if (list) {
			list.push(appointment);
		} else {
			byPatient.set(appointment.patientId, [appointment]);
		}
	}
	return patients.map((patient) => {
		const own = byPatient.get(patient.id) ?? [];
		const done = own.filter((row) => row.status === "completed");
		const lastVisitAt = done.at(-1)?.startsAt ?? null;
		const nextAppointment = own.find((row) => isComing(row, now)) ?? null;
		const isNew = now - patient.registeredAt < NEW_FILE_DAYS * DAY_MS;
		return {
			...patient,
			primaryPractitioner:
				practitioners.find(
					(practitioner) => practitioner.id === patient.primaryPractitionerId,
				) ?? null,
			lastVisitAt,
			nextAppointment,
			visitCount: done.length,
			isNew,
			// A patient who never came (a no-show, a cancelled first booking) needs a call most of all.
			isRecallDue:
				nextAppointment === null &&
				(lastVisitAt === null
					? !isNew
					: now - lastVisitAt > RECALL_AFTER_DAYS * DAY_MS),
		};
	});
}

/** The rows of one tab. */
export function rowsOfSegment(
	rows: readonly PatientRow[],
	segment: PatientSegment,
): PatientRow[] {
	switch (segment) {
		case "all":
			return [...rows];
		case "booked":
			return rows.filter((row) => row.nextAppointment !== null);
		case "new":
			return rows.filter((row) => row.isNew);
		case "recall":
			return rows.filter((row) => row.isRecallDue);
	}
}

// The age for a label: months under 2 years, else years.
function ageParts(
	dateOfBirth: string,
	now: number,
): { value: number; unit: "month" | "year" } {
	const years = ageInYears(dateOfBirth, now);
	if (years >= 2) {
		return { value: years, unit: "year" };
	}
	const [birthYear = 0, birthMonth = 1, birthDay = 1] = dateOfBirth
		.split("-")
		.map(Number);
	const today = new Date(now);
	const months =
		(today.getFullYear() - birthYear) * 12 +
		(today.getMonth() + 1 - birthMonth) -
		(today.getDate() < birthDay ? 1 : 0);
	return { value: Math.max(0, months), unit: "month" };
}

/** The age as a label of the app language: months under 2 years ("18 months"), else years ("34 years"). */
export function formatAge(
	dateOfBirth: string,
	now: number,
	locale: string,
): string {
	const age = ageParts(dateOfBirth, now);
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: age.unit,
		unitDisplay: "long",
	}).format(age.value);
}
