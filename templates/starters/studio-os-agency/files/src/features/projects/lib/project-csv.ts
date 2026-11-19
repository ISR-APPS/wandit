// The CSV columns of a project export: the same facts as the project tables, as plain text.
// The home export menu, the "Export selected" actions, and the Projects page call it with the translations.
import type { CsvColumn, ProjectSummary, Translate } from "~/features/studio";

/** Days and amounts stay in ISO dates and whole euros, so a spreadsheet can sort and sum them. */
export function projectCsvColumns(t: Translate): CsvColumn<ProjectSummary>[] {
	return [
		{ header: t("projects.project"), value: (row) => row.name },
		{ header: t("projects.client"), value: (row) => row.clientName },
		{
			header: t("projects.service"),
			value: (row) => t(`codes.services.${row.service}`),
		},
		{ header: t("projects.lead"), value: (row) => row.leadName },
		{ header: t("projects.start"), value: (row) => row.startDay },
		{ header: t("projects.deadline"), value: (row) => row.dueDay ?? "" },
		{
			header: t("projects.status"),
			value: (row) => t(`codes.phases.${row.phase}`),
		},
		{
			header: t("projects.progress"),
			value: (row) => String(Math.round(row.progress * 100)),
		},
		{ header: t("projects.budget"), value: (row) => String(row.budget) },
		{ header: t("projects.spent"), value: (row) => String(row.spent) },
		{ header: t("projects.invoiced"), value: (row) => String(row.invoiced) },
	];
}
