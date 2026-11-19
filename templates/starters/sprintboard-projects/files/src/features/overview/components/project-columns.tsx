// The columns and the row menu of the project tables of the home.
// The "Recent projects" card and the Reports tab pick the columns they show from projectColumns.
// progressOf of the projects feature gives the progress column, so it matches the project cards.
import { Link } from "@tanstack/react-router";
import { type Project, progressOf } from "~/features/projects";
import {
	copyToClipboard,
	PersonAvatar,
	ProjectStateBadge,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import type { RecordColumn } from "~/shared/ui/record-table";

type Translate = ReturnType<typeof useT>["t"];

/** Every column of a project table, by id. A table lists the ids it shows, in its order. */
export function projectColumns(t: Translate, locale: string) {
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	return {
		key: {
			id: "key",
			header: t("projects.key"),
			cell: (project) => (
				<span className="font-medium tabular-nums">{project.key}</span>
			),
			sortValue: (project) => project.key,
			hideable: true,
		},
		name: {
			id: "name",
			header: t("projects.project"),
			cell: (project) => (
				<Link
					to="/app/projects/$projectId"
					params={{ projectId: project.id }}
					className="font-medium hover:underline"
				>
					{project.name}
				</Link>
			),
			sortValue: (project) => project.name,
		},
		lead: {
			id: "lead",
			header: t("projects.lead"),
			cell: (project) => (
				<span className="flex items-center gap-3">
					<PersonAvatar name={project.leadName} className="size-8" />
					<span className="whitespace-nowrap">{project.leadName}</span>
				</span>
			),
			sortValue: (project) => project.leadName,
			hideable: true,
		},
		start: {
			id: "start",
			header: t("projects.start"),
			cell: (project) => (
				<span className="whitespace-nowrap tabular-nums">
					{date.format(new Date(project.startAt))}
				</span>
			),
			sortValue: (project) => project.startAt,
			hideable: true,
		},
		target: {
			id: "target",
			header: t("projects.target"),
			cell: (project) => (
				<span className="whitespace-nowrap tabular-nums">
					{date.format(new Date(project.targetAt))}
				</span>
			),
			sortValue: (project) => project.targetAt,
			hideable: true,
		},
		status: {
			id: "status",
			header: t("projects.state"),
			cell: (project) => (
				<ProjectStateBadge status={project.status} health={project.health} />
			),
			hideable: true,
		},
		points: {
			id: "points",
			header: t("projects.points"),
			cell: (project) => number.format(project.pointsTotal),
			sortValue: (project) => project.pointsTotal,
			align: "end",
			hideable: true,
		},
		progress: {
			id: "progress",
			header: t("projects.progress"),
			cell: (project) => (
				<span className="flex items-center gap-2">
					<Progress
						value={progressOf(project)}
						className="h-2 w-16"
						aria-label={t("projects.progress")}
					/>
					<span className="text-muted-foreground text-sm tabular-nums">
						{percent.format(progressOf(project) / 100)}
					</span>
				</span>
			),
			sortValue: (project) => progressOf(project),
			hideable: true,
		},
	} satisfies Record<string, RecordColumn<Project>>;
}

/** The menu of one project row: open its page, or copy its key. */
export function ProjectRowMenu({ project }: { project: Project }) {
	const { t } = useT();
	return (
		<>
			<DropdownMenuItem asChild>
				<Link to="/app/projects/$projectId" params={{ projectId: project.id }}>
					{t("table.open")}
				</Link>
			</DropdownMenuItem>
			<DropdownMenuItem
				onSelect={() =>
					copyToClipboard(project.key, {
						done: t("table.copied"),
						failed: t("table.copyFailed"),
					})
				}
			>
				{t("table.copyKey")}
			</DropdownMenuItem>
		</>
	);
}
