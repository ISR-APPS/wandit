// The list view of the reservations: status tabs, one channel filter, and the searchable table.
// ReservationsPage renders it in a Card. The guest name of a row opens the detail page.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	BOOKING_CHANNELS,
	type BookingChannel,
	countLabel,
	dayToDate,
	isoDayToMs,
	moneyFormat,
	RESERVATION_STATUSES,
	type ReservationStatus,
	ReservationStatusBadge,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import type { ReservationRow } from "../api/reservations.queries";

type ReservationsTableProps = {
	/** Every reservation, in the order of the list query. */
	reservations: ReservationRow[];
};

/** The status tab and the channel Select filter the rows. Then DataTable searches, sorts, and pages them. */
export function ReservationsTable({ reservations }: ReservationsTableProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<ReservationStatus | "all">("all");
	const [channel, setChannel] = useState<BookingChannel | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const ofChannel =
		channel === "all"
			? reservations
			: reservations.filter((row) => row.channel === channel);
	// A tab shows only for a status that has rows in the chosen channel.
	const tabs = RESERVATION_STATUSES.map((value) => ({
		value,
		count: ofChannel.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A new channel can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? ofChannel
			: ofChannel.filter((row) => row.status === activeStatus);

	const columns: DataTableColumn<ReservationRow>[] = [
		{
			id: "guest",
			header: t("reservations.guest"),
			sortValue: (row) => row.guestName,
			// justify-items-start: each line is as wide as its text, so a click beside the name does nothing.
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
						{`${row.code} · ${t(`channels.${row.channel}`)}`}
					</span>
				</div>
			),
		},
		// The status is the second column: at 375 px it shows beside the name with no sideways scroll.
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
			cell: (row) => (
				<div className="grid">
					<span className="whitespace-nowrap tabular-nums">
						{`${shortDate.format(dayToDate(row.checkIn))} – ${shortDate.format(dayToDate(row.checkOut))}`}
					</span>
					<span className="whitespace-nowrap text-muted-foreground text-xs">
						{`${countLabel(row.nights, t("units.nightOne"), t("units.nightOther"), locale)} · ${countLabel(row.adults + row.children, t("units.guestOne"), t("units.guestOther"), locale)}`}
					</span>
				</div>
			),
		},
		{
			id: "total",
			header: t("reservations.total"),
			align: "end",
			sortValue: (row) => row.total,
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
		<DataTable
			rows={rows}
			columns={columns}
			searchText={(row) => `${row.guestName} ${row.code} ${row.roomNumber}`}
			noResults={t("reservations.noResults")}
			toolbar={
				<>
					<Select
						value={channel}
						onValueChange={(value) =>
							setChannel(
								BOOKING_CHANNELS.find((option) => option === value) ?? "all",
							)
						}
					>
						<SelectTrigger
							className="w-full sm:w-44"
							aria-label={t("reservations.channel")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">
								{t("reservations.allChannels")}
							</SelectItem>
							{BOOKING_CHANNELS.map((option) => (
								<SelectItem key={option} value={option}>
									{t(`channels.${option}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Tabs
						value={activeStatus}
						onValueChange={(value) =>
							setStatus(
								RESERVATION_STATUSES.find((option) => option === value) ??
									"all",
							)
						}
						className="max-w-full overflow-x-auto"
					>
						<TabsList>
							<TabsTrigger value="all">
								{t("reservations.all")}
								<span className="text-muted-foreground tabular-nums">
									{number.format(ofChannel.length)}
								</span>
							</TabsTrigger>
							{tabs.map((tab) => (
								<TabsTrigger key={tab.value} value={tab.value}>
									{t(`reservationStatuses.${tab.value}`)}
									<span className="text-muted-foreground tabular-nums">
										{number.format(tab.count)}
									</span>
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</>
			}
		/>
	);
}
