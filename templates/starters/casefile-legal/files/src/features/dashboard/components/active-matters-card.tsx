// The table card of the dashboard: every open matter with its client, lead, next deadline, stage, and path progress.
// DashboardPage renders it under the other bands and passes the rows. The /app loader fills the matter list.
// It follows the full-width table card of the kit system: filter, columns, sort, checkboxes, row menu, pages.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type MatterSummary, matterCsvColumns } from "~/features/matters";
import {
	copyToClipboard,
	downloadCsv,
	fillMessage,
	MatterStageBadge,
	PersonAvatar,
	STAGE_PATH,
	stageStep,
	toCsv,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// Eight rows keep the card near one screen high. The pages show the rest.
const ACTIVE_PAGE_SIZE = 8;

type ActiveMattersCardProps = {
	/** The open matters, newest opening first. */
	matters: MatterSummary[];
};

/** The name cell links to the matter page. The row menu opens it or copies the file number. */
export function ActiveMattersCard({ matters }: ActiveMattersCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const number = new Intl.NumberFormat(locale);
	const columns: RecordColumn<MatterSummary>[] = [
		{
			id: "matter",
			header: t("matters.matter"),
			sortValue: (matter) => matter.name,
			cell: (matter) => (
				// A long name wraps on a narrow screen, so the row menu column stays on screen at 1280 px.
				<Link
					to="/app/matters/$matterId"
					params={{ matterId: matter.id }}
					className="grid min-w-40 gap-0.5 hover:underline"
				>
					<span className="whitespace-normal font-medium" dir="auto">
						{matter.name}
					</span>
					<span className="text-muted-foreground text-xs tabular-nums">
						{matter.number}
					</span>
				</Link>
			),
		},
		{
			id: "client",
			header: t("matters.client"),
			hideable: true,
			sortValue: (matter) => matter.clientName,
			cell: (matter) => (
				<span className="flex items-center gap-2">
					<PersonAvatar name={matter.clientName} />
					<span className="min-w-28 whitespace-normal" dir="auto">
						{matter.clientName}
					</span>
				</span>
			),
		},
		{
			id: "lead",
			header: t("matters.lead"),
			hideable: true,
			sortValue: (matter) => matter.leadName,
			cell: (matter) => matter.leadName,
		},
		{
			id: "deadline",
			header: t("matters.deadline"),
			hideable: true,
			// "~" sorts after every ISO date, so a matter with no deadline comes last in the ascending order.
			sortValue: (matter) => matter.nextDeadline?.dueAt ?? "~",
			cell: (matter) =>
				matter.nextDeadline ? (
					<span className="tabular-nums">
						{date.format(new Date(matter.nextDeadline.dueAt))}
					</span>
				) : (
					<span className="text-muted-foreground">{t("matters.none")}</span>
				),
		},
		{
			id: "stage",
			header: t("matters.stage"),
			hideable: true,
			sortValue: (matter) => stageStep(matter.stage) ?? 0,
			cell: (matter) => <MatterStageBadge stage={matter.stage} />,
		},
		{
			id: "progress",
			header: t("matters.progress"),
			hideable: true,
			sortValue: (matter) => stageStep(matter.stage) ?? 0,
			cell: (matter) => {
				const step = stageStep(matter.stage) ?? 0;
				return (
					<span className="flex items-center gap-2">
						<Progress
							value={(step / STAGE_PATH.length) * 100}
							className="h-1.5 w-16"
							aria-label={t("matters.progress")}
						/>
						<span className="text-muted-foreground text-xs tabular-nums">
							{fillMessage(t("matters.stepOf"), {
								step: number.format(step),
								count: number.format(STAGE_PATH.length),
							})}
						</span>
					</span>
				);
			},
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.activeTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={matters}
					columns={columns}
					searchText={(matter) =>
						`${matter.name} ${matter.number} ${matter.clientName} ${matter.leadName}`
					}
					searchPlaceholder={t("matters.filter")}
					pageSize={ACTIVE_PAGE_SIZE}
					noResults={t("matters.noResults")}
					selectable
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									"matters-selected.csv",
									toCsv(selected, matterCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					rowMenu={(matter) => (
						<>
							<DropdownMenuItem asChild>
								<Link
									to="/app/matters/$matterId"
									params={{ matterId: matter.id }}
								>
									{t("table.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(matter.number, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("matters.copyNumber")}
							</DropdownMenuItem>
						</>
					)}
				/>
			</CardContent>
		</Card>
	);
}
