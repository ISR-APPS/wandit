// Appointments with their patient and their practitioner: the rows that the pages show.
// The query files of the pages call `listAppointmentRows`. It stands in for a read with two embedded tables.
// To make it real: select `*, patients(*), practitioners(*)` from `appointments` in each query file.
import { type Appointment, listAppointments } from "./sample-appointments";
import { listPatients, type Patient } from "./sample-patients";
import { listPractitioners, type Practitioner } from "./sample-practitioners";

/** One appointment with the two rows that its ids point to. */
export type AppointmentRow = Appointment & {
	patient: Patient;
	practitioner: Practitioner;
};

/** Every appointment of the book, oldest first, with the status at the time `now` (milliseconds since 1970). */
export function listAppointmentRows(now: number): AppointmentRow[] {
	const patients = new Map(
		listPatients(now).map((patient) => [patient.id, patient]),
	);
	const practitioners = new Map(
		listPractitioners().map((practitioner) => [practitioner.id, practitioner]),
	);
	return listAppointments(now).flatMap((appointment) => {
		const patient = patients.get(appointment.patientId);
		const practitioner = practitioners.get(appointment.practitionerId);
		// The generator books only known patients and practitioners, so both rows exist.
		return patient && practitioner
			? [{ ...appointment, patient, practitioner }]
			: [];
	});
}

/** The rows that start on the local day that begins at `dayStart`, oldest first. */
export function rowsOfDay(
	rows: readonly AppointmentRow[],
	dayStart: number,
	nextDayStart: number,
): AppointmentRow[] {
	return rows.filter(
		(row) => row.startsAt >= dayStart && row.startsAt < nextDayStart,
	);
}
