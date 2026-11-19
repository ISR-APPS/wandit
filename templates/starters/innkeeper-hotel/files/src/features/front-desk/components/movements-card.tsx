// The table card at the foot of the home: the arrivals and the departures of today and tomorrow.
// FrontDeskPage renders it with the movement rows of the summary query. It follows the booking list of the kit:
// a filter field, one filter button, sortable heads, a room type badge, a status badge, and pages.
// The guest name opens the reservation. movementCsvColumns gives the columns of the "Export CSV" button of the page.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type CsvColumn,
	countLabel,
	dayToDate,
	fillMessage,
	isoDayToMs,
	RESERVATION_STATUSES,
	ReservationStatusBadge,
	type RoomType,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import type { MovementRow } from "../lib/home-figures";

/** The dot color of each room type. Chart series 1 to 4, from the smallest room to the largest. */
const ROOM_TYPE_DOT = {
	classic: "bg-chart-1",
	deluxe: "bg-chart-2",
	junior_suite: "bg-chart-3",
	suite: "bg-chart-4",
} satisfies Record<RoomType, string>;

type MovementsCardProps = {
	/** The arrivals and departures of today and tomorrow, in time order. */
	rows: MovementRow[];
};

/** 8 rows per page, as every home table card. */
export function MovementsCard({ rows }: MovementsCardProps) {
	const { t, locale } = useT();
	const [movement, setMovement] = useState<MovementRow["movement"] | null>(
		null,
	);
	const number = new Intl.NumberFormat(locale);
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const shown =
		movement === null ? rows : rows.filter((row) => row.movement === movement);

	const columns: RecordColumn<MovementRow>[] = [
		{
			id: "code",
			header: t("frontDesk.movements.code"),
			sortValue: (row) => row.code,
			cell: (row) => <span className="tabular-nums">{row.code}</span>,
		},
		{
			id: "guest",
			header: t("frontDesk.movements.guest"),
			sortValue: (row) => row.at,
			// justify-items-start: the link is as wide as the name, so a click beside it does nothing.
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/reservations/$reservationId"
						params={{ reservationId: row.reservationId }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.guestName}
					</Link>
					<span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
						{fillMessage(t(`frontDesk.movements.${row.movement}.${row.day}`), {
							time: time.format(new Date(row.at)),
						})}
					</span>
				</div>
			),
		},
		{
			id: "roomType",
			header: t("frontDesk.movements.roomType"),
			sortValue: (row) => row.roomType,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<span
						aria-hidden="true"
						className={cn("size-2 rounded-full", ROOM_TYPE_DOT[row.roomType])}
					/>
					<Badge variant="outline">{t(`roomTypes.${row.roomType}`)}</Badge>
				</span>
			),
		},
		{
			id: "room",
			header: t("frontDesk.movements.room"),
			sortValue: (row) => Number(row.roomNumber),
			cell: (row) =>
				fillMessage(t("frontDesk.movements.roomNumber"), {
					number: row.roomNumber,
				}),
		},
		{
			id: "nights",
			header: t("frontDesk.movements.nights"),
			sortValue: (row) => row.nights,
			cell: (row) =>
				countLabel(
					row.nights,
					t("units.nightOne"),
					t("units.nightOther"),
					locale,
				),
		},
		{
			id: "stay",
			header: t("frontDesk.movements.stay"),
			sortValue: (row) => isoDayToMs(row.checkIn),
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{`${shortDate.format(dayToDate(row.checkIn))} – ${shortDate.format(dayToDate(row.checkOut))}`}
				</span>
			),
		},
		{
			id: "status",
			header: t("frontDesk.movements.status"),
			align: "end",
			sortValue: (row) => RESERVATION_STATUSES.indexOf(row.status),
			cell: (row) => <ReservationStatusBadge status={row.status} />,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("frontDesk.movements.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("frontDesk.movements.description"), {
						arrivals: number.format(
							rows.filter((row) => row.movement === "arrival").length,
						),
						departures: number.format(
							rows.filter((row) => row.movement === "departure").length,
						),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={shown}
					columns={columns}
					searchText={(row) => `${row.guestName} ${row.code} ${row.roomNumber}`}
					searchPlaceholder={t("frontDesk.movements.search")}
					toolbar={
						<RecordFilter
							label={t("frontDesk.movements.movement")}
							options={[
								{
									value: "arrival",
									label: t("frontDesk.movements.arrivals"),
								},
								{
									value: "departure",
									label: t("frontDesk.movements.departures"),
								},
							]}
							value={movement}
							onValueChange={setMovement}
						/>
					}
					pageSize={8}
					noResults={t("frontDesk.movements.noResults")}
				/>
			</CardContent>
		</Card>
	);
}

/** The columns of the CSV file of the movements, in the order of the table. */
export function movementCsvColumns(
	t: ReturnType<typeof useT>["t"],
	locale: string,
): CsvColumn<MovementRow>[] {
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	return [
		{ header: t("frontDesk.movements.code"), value: (row) => row.code },
		{ header: t("frontDesk.movements.guest"), value: (row) => row.guestName },
		{
			header: t("frontDesk.movements.movement"),
			value: (row) =>
				t(
					row.movement === "arrival"
						? "frontDesk.movements.arrivals"
						: "frontDesk.movements.departures",
				),
		},
		{
			header: t("frontDesk.movements.time"),
			value: (row) => dateTime.format(new Date(row.at)),
		},
		{
			header: t("frontDesk.movements.roomType"),
			value: (row) => t(`roomTypes.${row.roomType}`),
		},
		{ header: t("frontDesk.movements.room"), value: (row) => row.roomNumber },
		{
			header: t("frontDesk.movements.nights"),
			value: (row) => String(row.nights),
		},
		{
			header: t("reservations.arrival"),
			value: (row) => date.format(dayToDate(row.checkIn)),
		},
		{
			header: t("reservations.departure"),
			value: (row) => date.format(dayToDate(row.checkOut)),
		},
		{
			header: t("frontDesk.movements.status"),
			value: (row) => t(`reservationStatuses.${row.status}`),
		},
	];
}
