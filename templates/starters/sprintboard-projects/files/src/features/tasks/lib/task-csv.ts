// The columns of a task CSV file: key, title, kind, project, status, priority, assignee, points, due, done, hours.
// The Tasks page export, its "Export selected" action, and the export menu of the home call it.
import type { CsvColumn, Task } from "~/features/tracker";
import type { useT } from "~/shared/i18n";

type Translate = ReturnType<typeof useT>["t"];

/** Dates are medium dates in the app language. An empty cell means no due day, not done, or nobody. */
export function taskCsvColumns(
	t: Translate,
	locale: string,
): CsvColumn<Task>[] {
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const dateOf = (iso: string | null) =>
		iso === null ? "" : date.format(new Date(iso));
	return [
		{ header: t("tasks.key"), value: (task) => task.key },
		{ header: t("tasks.titleColumn"), value: (task) => task.title },
		{ header: t("tasks.kind"), value: (task) => t(`kind.${task.kind}`) },
		{ header: t("task.project"), value: (task) => task.projectName },
		{ header: t("tasks.status"), value: (task) => t(`status.${task.status}`) },
		{
			header: t("tasks.priority"),
			value: (task) => t(`priority.${task.priority}`),
		},
		{ header: t("task.assignee"), value: (task) => task.assigneeName ?? "" },
		{ header: t("task.pointsShort"), value: (task) => String(task.estimate) },
		{ header: t("task.due"), value: (task) => dateOf(task.dueAt) },
		{ header: t("task.completed"), value: (task) => dateOf(task.completedAt) },
		// Minutes to hours, with one decimal.
		{
			header: t("tasks.hours"),
			value: (task) => hours.format(task.loggedMinutes / 60),
		},
	];
}
