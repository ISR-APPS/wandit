// The Reports tab of the home: every project with its budget, its spend, and its health.
// OverviewPage renders it when the tab is "reports". RecordTable gives the filter, sort, columns, and pages.
import { Link } from "@tanstack/react-router";
import {
	HealthBadge,
	type ProjectSummary,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// A report reads like a list page: twenty rows per page.
const REPORT_PAGE_SIZE = 20;

type ProjectBudgetsCardProps = {
	/** Every project, in catalog order. */
	projects: ProjectSummary[];
};

/** A delivered project has no health: its status cell shows a muted dash. */
export function ProjectBudgetsCard({ projects }: ProjectBudgetsCardProps) {
	const { t } = useT();
	const { money, percent } = useFormatters();
	const columns: RecordColumn<ProjectSummary>[] = [
		{
			id: "name",
			header: t("projects.project"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<span className="grid">
					<Link
						to="/app/projects/$projectId"
						params={{ projectId: row.id }}
						className="font-medium hover:underline"
					>
						{row.name}
					</Link>
					<span className="text-muted-foreground text-xs">
						{row.clientName}
					</span>
				</span>
			),
		},
		{
			id: "lead",
			header: t("projects.lead"),
			sortValue: (row) => row.leadName,
			hideable: true,
			cell: (row) => row.leadName,
		},
		{
			id: "budget",
			header: t("projects.budget"),
			sortValue: (row) => row.budget,
			align: "end",
			hideable: true,
			cell: (row) => money(row.budget),
		},
		{
			id: "spent",
			header: t("projects.spent"),
			sortValue: (row) => row.spent,
			align: "end",
			hideable: true,
			cell: (row) => money(row.spent),
		},
		{
			id: "burn",
			header: t("projects.burn"),
			sortValue: (row) => row.burnShare,
			hideable: true,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<Progress
						value={row.burnShare * 100}
						className="h-1.5 w-20"
						aria-label={t("projects.burn")}
					/>
					<span className="text-muted-foreground text-xs tabular-nums">
						{percent(row.burnShare)}
					</span>
				</span>
			),
		},
		{
			id: "invoiced",
			header: t("projects.invoiced"),
			sortValue: (row) => row.invoiced,
			align: "end",
			hideable: true,
			cell: (row) => money(row.invoiced),
		},
		{
			id: "health",
			header: t("projects.health"),
			sortValue: (row) => row.health ?? "",
			hideable: true,
			cell: (row) =>
				row.health === null ? (
					<span className="text-muted-foreground">–</span>
				) : (
					<HealthBadge health={row.health} />
				),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.reports.title")}</CardTitle>
				<CardDescription>{t("overview.reports.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={projects}
					columns={columns}
					searchText={(row) => `${row.name} ${row.clientName} ${row.leadName}`}
					searchPlaceholder={t("overview.recent.filter")}
					rowMenu={(row) => (
						<DropdownMenuItem asChild>
							<Link
								to="/app/projects/$projectId"
								params={{ projectId: row.id }}
							>
								{t("table.open")}
							</Link>
						</DropdownMenuItem>
					)}
					pageSize={REPORT_PAGE_SIZE}
					noResults={t("projects.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
