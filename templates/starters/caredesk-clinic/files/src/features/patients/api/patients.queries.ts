// Reads of the patient pages: the list of files, and one file with its appointments.
// The list and detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn returns sample rows of ~/features/clinic. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	LIVE_REFETCH_MS,
	listAppointmentRows,
	listPatients,
	listPractitioners,
	startOfMinute,
} from "~/features/clinic";
import { buildPatientRows } from "../lib/patient-rows";

/** Every patient file with its last visit and its next appointment, sorted by last name. */
export function patientsQueryOptions() {
	return queryOptions({
		queryKey: ["patients", "list"],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			return buildPatientRows(
				listPatients(now),
				listAppointmentRows(now),
				listPractitioners(),
				now,
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** One patient file and its appointments, newest first. null when the id does not exist. */
export function patientQueryOptions(patientId: string) {
	return queryOptions({
		queryKey: ["patients", "detail", patientId],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			const appointments = listAppointmentRows(now).filter(
				(row) => row.patientId === patientId,
			);
			const [patient] = buildPatientRows(
				listPatients(now).filter((row) => row.id === patientId),
				appointments,
				listPractitioners(),
				now,
			);
			// The id comes from the URL. An unknown id is "not found", not an error.
			return patient ? { patient, appointments: appointments.reverse() } : null;
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
