// The list view of the reservations: a filter field, a status and a channel filter, a column menu,
// checkboxes with "Export selected", sortable heads, a row menu, and pages.
// ReservationsPage renders it in a Card. The guest name and the row menu open the detail page.
// reservationCsvColumns gives the columns of the CSV files of the page.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	BOOKING_CHANNELS,
	type CsvColumn,
	copyToClipboard,
	countLabel,
	dayToDate,
	downloadCsv,
	isoDayToMs,
	moneyFormat,
	RESERVATION_STATUSES,
	ReservationStatusBadge,
	toCsv,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import type { ReservationRow } from "../api/reservations.queries";

type ReservationsTableProps = {
	/** Every reservation, in the order of the list query. */
	reservations: ReservationRow[];
};

/** The two filters cut the rows. Then RecordTable searches, sorts, selects, and pages them, 20 per page. */
export function ReservationsTable({ reservations }: ReservationsTableProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<string | null>(null);
	const [channel, setChannel] = useState<string | null>(null);
	const money = moneyFormat(locale);
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const rows = reservations.filter(
		(row) =>
			(status === null || row.status === status) &&
			(channel === null || row.channel === channel),
	);

	const columns: RecordColumn<ReservationRow>[] = [
		{
			id: "guest",
			header: t("reservations.guest"),
			sortValue: (row) => row.guestName,
			// justify-items-start: the link is as wide as the name, so a click beside it does nothing.
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/reservations/$reservationId"
						params={{ reservationId: row.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.guestName}
					</Link>
					<span className="text-muted-foreground text-xs tabular-nums">
						{row.code}
					</span>
				</div>
			),
		},
		{
			id: "status",
			header: t("reservations.status"),
			sortValue: (row) => RESERVATION_STATUSES.indexOf(row.status),
			cell: (row) => <ReservationStatusBadge status={row.status} />,
		},
		{
			id: "room",
			header: t("reservations.room"),
			sortValue: (row) => Number(row.roomNumber),
			hideable: true,
			cell: (row) => (
				<div className="grid">
					<span className="tabular-nums">{row.roomNumber}</span>
					<span className="text-muted-foreground text-xs">
						{t(`roomTypes.${row.roomType}`)}
					</span>
				</div>
			),
		},
		{
			id: "stay",
			header: t("reservations.stay"),
			sortValue: (row) => isoDayToMs(row.checkIn),
			hideable: true,
			cell: (row) => (
				<div className="grid">
					<span className="whitespace-nowrap tabular-nums">
						{`${shortDate.format(dayToDate(row.checkIn))} – ${shortDate.format(dayToDate(row.checkOut))}`}
					</span>
					<span className="whitespace-nowrap text-muted-foreground text-xs">
						{countLabel(
							row.nights,
							t("units.nightOne"),
							t("units.nightOther"),
							locale,
						)}
					</span>
				</div>
			),
		},
		{
			id: "channel",
			header: t("reservations.channel"),
			sortValue: (row) => row.channel,
			hideable: true,
			cell: (row) => t(`channels.${row.channel}`),
		},
		{
			id: "total",
			header: t("reservations.total"),
			align: "end",
			sortValue: (row) => row.total,
			hideable: true,
			cell: (row) => (
				<span
					className={
						row.status === "cancelled"
							? "text-muted-foreground line-through"
							: undefined
					}
				>
					{money.format(row.total)}
				</span>
			),
		},
		{
			id: "balance",
			header: t("reservations.balance"),
			align: "end",
			sortValue: (row) => row.balance,
			hideable: true,
			cell: (row) =>
				row.balance > 0 ? (
					<span className="font-medium">{money.format(row.balance)}</span>
				) : (
					<span className="text-muted-foreground">
						{t(
							row.status === "cancelled"
								? "reservations.refunded"
								: "reservations.paid",
						)}
					</span>
				),
		},
	];

	return (
		<RecordTable
			rows={rows}
			columns={columns}
			searchText={(row) => `${row.guestName} ${row.code} ${row.roomNumber}`}
			searchPlaceholder={t("reservations.search")}
			toolbar={
				<>
					<RecordFilter
						label={t("reservations.status")}
						options={RESERVATION_STATUSES.map((value) => ({
							value,
							label: t(`reservationStatuses.${value}`),
						}))}
						value={status}
						onValueChange={setStatus}
					/>
					<RecordFilter
						label={t("reservations.channel")}
						options={BOOKING_CHANNELS.map((value) => ({
							value,
							label: t(`channels.${value}`),
						}))}
						value={channel}
						onValueChange={setChannel}
					/>
				</>
			}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem asChild>
						<Link
							to="/app/reservations/$reservationId"
							params={{ reservationId: row.id }}
						>
							{t("reservations.open")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.code, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("reservations.copyCode")}
					</DropdownMenuItem>
				</>
			)}
			selectable
			bulkActions={(selected) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"reservations-selected.csv",
							toCsv(selected, reservationCsvColumns(t, locale)),
						)
					}
				>
					{t("table.exportSelected")}
				</Button>
			)}
			pageSize={20}
			noResults={t("reservations.noResults")}
		/>
	);
}

/** The columns of the CSV files of the reservations, in the order of the table. */
export function reservationCsvColumns(
	t: ReturnType<typeof useT>["t"],
	locale: string,
): CsvColumn<ReservationRow>[] {
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	return [
		{ header: t("reservations.code"), value: (row) => row.code },
		{ header: t("reservations.guest"), value: (row) => row.guestName },
		{
			header: t("reservations.status"),
			value: (row) => t(`reservationStatuses.${row.status}`),
		},
		{ header: t("reservations.room"), value: (row) => row.roomNumber },
		{
			header: t("reservations.arrival"),
			value: (row) => date.format(dayToDate(row.checkIn)),
		},
		{
			header: t("reservations.departure"),
			value: (row) => date.format(dayToDate(row.checkOut)),
		},
		{ header: t("reservations.nights"), value: (row) => String(row.nights) },
		{
			header: t("reservations.channel"),
			value: (row) => t(`channels.${row.channel}`),
		},
		{ header: t("reservations.total"), value: (row) => String(row.total) },
		{ header: t("reservations.balance"), value: (row) => String(row.balance) },
	];
}
