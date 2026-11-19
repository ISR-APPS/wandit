// The time-off request table: RecordTable with the request columns, a row menu, row selection, and the export of the selected rows.
// The requests card of the time-off page and the upcoming time-off card of the home render it. They filter the rows first.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	copyToClipboard,
	downloadCsv,
	formatDayRange,
	formatRelativeTime,
	PersonAvatar,
	TIME_OFF_STATUS_BADGE,
	TIME_OFF_STATUSES,
	TIME_OFF_TYPES,
	TimeOffTypeMark,
	toCsv,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { TimeOffRequest } from "../api/time-off.queries";
import { requestCsvColumns } from "../lib/request-csv";

type RequestTableProps = {
	/** The requests to list, after the filters of the page. */
	requests: TimeOffRequest[];
	/** "list" adds the "Days" and "Sent" columns and the Columns menu (time-off page). "upcoming" keeps the short set of the home card. */
	variant: "upcoming" | "list";
	/** Rows per page: 8 on the home card, 12 on the time-off page. */
	pageSize: number;
	/** True adds the filter field. The home card holds its own field in the card head, so it passes false. */
	searchable: boolean;
	/** Filter buttons after the filter field. */
	toolbar?: ReactNode;
	/** Text when no row matches. */
	noResults: string;
};

/** The name opens the profile. "Open request" opens the request dialog of the time-off page. */
export function RequestTable({
	requests,
	variant,
	pageSize,
	searchable,
	toolbar,
	noResults,
}: RequestTableProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	// The home card has no Columns menu, as in the kit. The list page lets the user hide columns.
	const hideable = variant === "list";

	const columns: RecordColumn<TimeOffRequest>[] = [
		{
			id: "employee",
			header: t("timeOff.employee"),
			sortValue: (row) => row.employeeName,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<PersonAvatar name={row.employeeName} className="size-8" />
					{/* justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side. */}
					<div className="grid min-w-0 justify-items-start">
						<Link
							to="/app/employees/$employeeId"
							params={{ employeeId: row.employeeId }}
							className="font-medium hover:underline"
							dir="auto"
						>
							{row.employeeName}
						</Link>
						<span className="text-muted-foreground text-xs" dir="auto">
							{row.employeeTitle}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "type",
			header: t("timeOff.type"),
			hideable,
			sortValue: (row) => TIME_OFF_TYPES.indexOf(row.type),
			cell: (row) => <TimeOffTypeMark type={row.type} />,
		},
		{
			id: "dates",
			header: t("timeOff.dates"),
			sortValue: (row) => row.startDate,
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{formatDayRange(row.startDate, row.endDate, locale)}
				</span>
			),
		},
		...(variant === "list"
			? [
					{
						id: "days",
						header: t("timeOff.days"),
						hideable: true,
						align: "end" as const,
						sortValue: (row: TimeOffRequest) => row.days,
						cell: (row: TimeOffRequest) => number.format(row.days),
					},
					{
						id: "sent",
						header: t("timeOff.sent"),
						hideable: true,
						sortValue: (row: TimeOffRequest) => row.submittedAt,
						cell: (row: TimeOffRequest) => (
							<span className="whitespace-nowrap text-muted-foreground">
								{formatRelativeTime(row.submittedAt, now, locale)}
							</span>
						),
					},
				]
			: []),
		{
			id: "status",
			header: t("timeOff.status"),
			sortValue: (row) => TIME_OFF_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={TIME_OFF_STATUS_BADGE[row.status]}>
					{t(`timeOffStatuses.${row.status}`)}
				</Badge>
			),
		},
	];

	return (
		<RecordTable
			rows={requests}
			columns={columns}
			searchText={
				searchable
					? (row) => `${row.employeeName} ${row.employeeTitle} ${row.id}`
					: undefined
			}
			searchPlaceholder={t("timeOff.filterPlaceholder")}
			toolbar={toolbar}
			pageSize={pageSize}
			noResults={noResults}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"time-off-selected.csv",
							toCsv(selectedRows, requestCsvColumns(t, locale)),
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
						<Link to="/app/time-off" search={{ request: row.id }}>
							{t("timeOff.openRequest")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link
							to="/app/employees/$employeeId"
							params={{ employeeId: row.employeeId }}
						>
							{t("timeOff.openProfile")}
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
		/>
	);
}
