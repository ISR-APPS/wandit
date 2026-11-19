// The columns of a project CSV file: key, name, lead, state, start, target, points, and progress.
// The export button of the Projects page and the export menu of the home call it.
import type { CsvColumn } from "~/features/tracker";
import type { useT } from "~/shared/i18n";
import type { Project } from "../api/projects.queries";
import { progressOf } from "./project-progress";

type Translate = ReturnType<typeof useT>["t"];

/** The columns of a project CSV file. The progress is a whole percent. */
export function projectCsvColumns(
	t: Translate,
	locale: string,
): CsvColumn<Project>[] {
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	return [
		{ header: t("projects.key"), value: (project) => project.key },
		{ header: t("projects.project"), value: (project) => project.name },
		{ header: t("projects.lead"), value: (project) => project.leadName },
		{
			header: t("projects.state"),
			value: (project) =>
				project.health === null
					? t(`projectStatus.${project.status}`)
					: t(`health.${project.health}`),
		},
		{
			header: t("projects.start"),
			value: (project) => date.format(new Date(project.startAt)),
		},
		{
			header: t("projects.target"),
			value: (project) => date.format(new Date(project.targetAt)),
		},
		{
			header: t("projects.points"),
			value: (project) => String(project.pointsTotal),
		},
		{
			header: t("projects.progress"),
			value: (project) => `${progressOf(project)}%`,
		},
	];
}
