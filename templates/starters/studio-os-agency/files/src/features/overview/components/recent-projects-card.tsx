// The full-width table card of the home: the projects, the newest start first, with their progress.
// OverviewPage renders it in the last band. RecordTable gives the filter, the columns menu, the checkboxes,
// the row menu, and the pages. "Export selected" downloads the chosen rows as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { projectCsvColumns } from "~/features/projects";
import {
	copyToClipboard,
	downloadCsv,
	PersonAvatar,
	PHASES,
	PhaseBadge,
	type ProjectSummary,
	toCsv,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// The kit home table shows six rows per page.
const HOME_PAGE_SIZE = 6;

type RecentProjectsCardProps = {
	/** Every project, in any order. The card sorts them by start day, the newest first. */
	projects: ProjectSummary[];
};

/** The name cell links to the project; the row menu opens it or copies its id. */
export function RecentProjectsCard({ projects }: RecentProjectsCardProps) {
	const { t } = useT();
	const { shortDate, longDate, percent } = useFormatters();
	const rows = [...projects].sort((first, second) =>
		second.startDay.localeCompare(first.startDay),
	);
	const columns: RecordColumn<ProjectSummary>[] = [
		{
			id: "name",
			header: t("projects.project"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<Link
					to="/app/projects/$projectId"
					params={{ projectId: row.id }}
					className="font-medium hover:underline"
				>
					{row.name}
				</Link>
			),
		},
		{
			id: "client",
			header: t("projects.client"),
			sortValue: (row) => row.clientName,
			hideable: true,
			cell: (row) => (
				<span className="flex items-center gap-3">
					<PersonAvatar name={row.clientName} className="size-8" />
					{row.clientName}
				</span>
			),
		},
		{
			id: "start",
			header: t("projects.start"),
			sortValue: (row) => row.startDay,
			hideable: true,
			cell: (row) => (
				<span className="tabular-nums">{longDate(row.startDay)}</span>
			),
		},
		{
			id: "deadline",
			header: t("projects.deadline"),
			// A retainer has no deadline. The far date puts it after every real deadline in an ascending sort.
			sortValue: (row) => row.dueDay ?? "9999-12-31",
			hideable: true,
			cell: (row) => (
				<span className="tabular-nums">
					{row.dueDay === null ? t("projects.monthly") : shortDate(row.dueDay)}
				</span>
			),
		},
		{
			id: "status",
			header: t("projects.status"),
			// The index keeps the order of the work, not the alphabet of the codes.
			sortValue: (row) => PHASES.indexOf(row.phase),
			hideable: true,
			cell: (row) => <PhaseBadge phase={row.phase} />,
		},
		{
			id: "progress",
			header: t("projects.progress"),
			sortValue: (row) => row.progress,
			hideable: true,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<Progress
						value={row.progress * 100}
						className="h-1.5 w-16"
						aria-label={t("projects.progress")}
					/>
					<span className="text-muted-foreground text-xs tabular-nums">
						{percent(row.progress)}
					</span>
				</span>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.recent.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(row) => `${row.name} ${row.clientName}`}
					searchPlaceholder={t("overview.recent.filter")}
					selectable
					bulkActions={(selected) => (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								downloadCsv(
									"projects.csv",
									toCsv(selected, projectCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					rowMenu={(row) => (
						<>
							<DropdownMenuItem asChild>
								<Link
									to="/app/projects/$projectId"
									params={{ projectId: row.id }}
								>
									{t("table.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(row.id, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("table.copyId")}
							</DropdownMenuItem>
						</>
					)}
					pageSize={HOME_PAGE_SIZE}
					noResults={t("projects.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
