// The log table of the Activities page: the activities of the period, with a type filter and a row menu.
// ActivitiesPage renders it in the "Activity log" tab and passes the rows of the period of the page header.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	ACTIVITY_TYPE_ICON,
	ACTIVITY_TYPES,
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	PersonAvatar,
	toCsv,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import type { Activity } from "../api/activities.queries";
import { activityCsvColumns } from "../lib/activity-csv";

type ActivityLogTableProps = {
	/** The activities of the period, newest first. */
	activities: Activity[];
	/** The current time in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** The type filter cuts the rows; then RecordTable filters, sorts, and pages them. */
export function ActivityLogTable({ activities, now }: ActivityLogTableProps) {
	const { t, locale } = useT();
	const [type, setType] = useState<string | null>(null);
	const rows =
		type === null ? activities : activities.filter((row) => row.type === type);

	const columns: RecordColumn<Activity>[] = [
		{
			id: "activity",
			header: t("activities.activity"),
			sortValue: (row) => row.subject,
			cell: (row) => {
				const TypeIcon = ACTIVITY_TYPE_ICON[row.type];
				return (
					<div className="flex items-center gap-3">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted">
							<TypeIcon
								className="size-4"
								role="img"
								aria-hidden={false}
								aria-label={t(`activityTypes.${row.type}`)}
							/>
						</span>
						{/* A fixed width: a truncated line has no width of its own, so the column would not hold it. */}
						<div className="grid w-56">
							<span className="truncate font-medium">{row.subject}</span>
							<span
								className="truncate text-muted-foreground text-xs"
								dir="auto"
							>
								{row.note}
							</span>
						</div>
					</div>
				);
			},
		},
		{
			id: "related",
			header: t("activities.related"),
			sortValue: (row) => row.deal?.name ?? row.contactName,
			// justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side.
			cell: (row) => (
				<div className="grid justify-items-start">
					{row.deal ? (
						<Link
							to="/app/deals/$dealId"
							params={{ dealId: row.deal.id }}
							className="font-medium hover:underline"
							dir="auto"
						>
							{row.deal.name}
						</Link>
					) : (
						<span dir="auto">{row.contactName}</span>
					)}
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.companyName}
					</span>
				</div>
			),
		},
		{
			id: "rep",
			header: t("activities.rep"),
			hideable: true,
			sortValue: (row) => row.repName,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<PersonAvatar name={row.repName} className="size-6 text-xs" />
					<bdi>{row.repName}</bdi>
				</span>
			),
		},
		{
			id: "when",
			header: t("activities.when"),
			hideable: true,
			align: "end",
			sortValue: (row) => Date.parse(row.occurredAt),
			cell: (row) => (
				<time dateTime={row.occurredAt} className="text-muted-foreground">
					{formatRelativeTime(row.occurredAt, now, locale)}
				</time>
			),
		},
	];

	return (
		<RecordTable
			rows={rows}
			columns={columns}
			searchText={(row) =>
				`${row.subject} ${row.note} ${row.deal?.name ?? ""} ${row.companyName} ${row.contactName} ${row.repName}`
			}
			searchPlaceholder={t("activities.filterPlaceholder")}
			toolbar={
				<RecordFilter
					label={t("activities.type")}
					options={ACTIVITY_TYPES.map((value) => ({
						value,
						label: t(`activityTypes.${value}`),
					}))}
					value={type}
					onValueChange={setType}
				/>
			}
			pageSize={20}
			noResults={t("activities.noResults")}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"activities-selected.csv",
							toCsv(selectedRows, activityCsvColumns(t)),
						)
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			rowMenu={(row) => (
				<>
					{row.deal ? (
						<DropdownMenuItem asChild>
							<Link to="/app/deals/$dealId" params={{ dealId: row.deal.id }}>
								{t("deals.openDeal")}
							</Link>
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.note, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("activities.copyNote")}
					</DropdownMenuItem>
				</>
			)}
		/>
	);
}
