// The CSV columns of an appointment export: day, time, patient, practitioner, department, visit, and status.
// The calendar "Export CSV" button and the upcoming card of the home call it with the translator of useT().
import type { AppointmentRow, CsvColumn } from "~/features/clinic";
import type { useT } from "~/shared/i18n";

/** The columns of one appointment row. Dates and times use the app locale, as on the page. */
export function appointmentCsvColumns(
	t: ReturnType<typeof useT>["t"],
	locale: string,
): CsvColumn<AppointmentRow>[] {
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	return [
		{
			header: t("appointments.date"),
			value: (row) => date.format(row.startsAt),
		},
		{
			header: t("appointments.time"),
			value: (row) => time.format(row.startsAt),
		},
		{ header: t("appointments.patient"), value: (row) => row.patient.fullName },
		{
			header: t("patients.fileNumber"),
			value: (row) => row.patient.fileNumber,
		},
		{
			header: t("appointments.practitioner"),
			value: (row) => row.practitioner.fullName,
		},
		{
			header: t("appointments.department"),
			value: (row) => t(`specialties.${row.practitioner.specialty}`),
		},
		{
			header: t("appointments.visit"),
			value: (row) => t(`visitTypes.${row.visitType}`),
		},
		{
			header: t("appointments.status"),
			value: (row) => t(`appointmentStatuses.${row.status}`),
		},
	];
}
