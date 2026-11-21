// The Orders tab of one event: every order in a table with a filter field, a door status filter, checkboxes,
// a column menu, a row menu, and pages. EventDetailPage renders it inside a Card when the tab is open.
// It follows section 2.4 of the kit system through RecordTable. "Export selected" downloads the chosen rows.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	ATTENDANCE_STATUSES,
	AttendanceBadge,
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	moneyFormat,
	toCsv,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import type { EventOrder } from "../api/events.queries";

type EventOrdersTableProps = {
	/** The orders of the event, the newest first. */
	orders: EventOrder[];
	/** The event id: the name of the CSV file. */
	eventId: string;
};

/** 20 rows per page, as on a list page. */
export function EventOrdersTable({ orders, eventId }: EventOrdersTableProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<string | null>(null);
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const rows =
		status === null
			? orders
			: orders.filter((order) => order.status === status);
	const columns: RecordColumn<EventOrder>[] = [
		{
			id: "guest",
			header: t("attendees.guest"),
			cell: (row) => (
				<Link
					to="/app/attendees"
					search={{ order: row.id }}
					className="grid max-w-56 gap-0.5 hover:underline"
				>
					<span className="truncate font-medium">{row.buyerName}</span>
					<span className="truncate text-muted-foreground text-xs">
						{row.buyerEmail}
					</span>
				</Link>
			),
			sortValue: (row) => row.buyerName,
		},
		{
			id: "reference",
			header: t("attendees.ordered"),
			cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
			hideable: true,
		},
		{
			id: "tier",
			header: t("attendees.tier"),
			cell: (row) => row.tierName,
			sortValue: (row) => row.tierName,
			hideable: true,
		},
		{
			id: "placed",
			header: t("events.date"),
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{dateTime.format(row.placedAt)}
				</span>
			),
			sortValue: (row) => row.placedAt,
			hideable: true,
		},
		{
			id: "tickets",
			header: t("attendees.tickets"),
			cell: (row) => row.quantity,
			sortValue: (row) => row.quantity,
			align: "end",
		},
		{
			id: "amount",
			header: t("attendees.amount"),
			cell: (row) => money.format(row.amount),
			sortValue: (row) => row.amount,
			align: "end",
			hideable: true,
		},
		{
			id: "status",
			header: t("attendees.status"),
			cell: (row) => <AttendanceBadge status={row.status} />,
			sortValue: (row) => t(`attendees.statuses.${row.status}`),
		},
	];
	const csvColumns: CsvColumn<EventOrder>[] = [
		{ header: t("attendees.ordered"), value: (row) => row.reference },
		{ header: t("attendees.guest"), value: (row) => row.buyerName },
		{ header: t("attendees.email"), value: (row) => row.buyerEmail },
		{ header: t("attendees.tier"), value: (row) => row.tierName },
		{ header: t("attendees.tickets"), value: (row) => String(row.quantity) },
		{ header: t("attendees.amount"), value: (row) => String(row.amount) },
		{
			header: t("attendees.status"),
			value: (row) => t(`attendees.statuses.${row.status}`),
		},
	];

	return (
		<RecordTable
			rows={rows}
			columns={columns}
			searchText={(row) =>
				`${row.buyerName} ${row.buyerEmail} ${row.reference}`
			}
			searchPlaceholder={t("attendees.search")}
			toolbar={
				<RecordFilter
					label={t("attendees.status")}
					options={ATTENDANCE_STATUSES.map((value) => ({
						value,
						label: t(`attendees.statuses.${value}`),
					}))}
					value={status}
					onValueChange={setStatus}
				/>
			}
			selectable
			bulkActions={(selected) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(`${eventId}-orders.csv`, toCsv(selected, csvColumns))
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem asChild>
						<Link to="/app/attendees" search={{ order: row.id }}>
							{t("table.open")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.buyerEmail, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("table.copyEmail")}
					</DropdownMenuItem>
				</>
			)}
			pageSize={20}
			noResults={t("attendees.noResults")}
		/>
	);
}
