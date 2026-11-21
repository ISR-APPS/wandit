// The schedule view of the reservations page: one row per night of the week, one column per room.
// ReservationsPage renders it for the window that its day navigator chose. It follows the room schedule
// of the kit bookings page: a time column at the start, the room heads on top, and a stay card per cell.
// The grid scrolls sideways inside its card, never the page.
import { WrenchIcon } from "@phosphor-icons/react";
import { dayToDate, fillMessage, type Room, toIsoDay } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card } from "~/shared/ui/card";
import type { ReservationRow } from "../api/reservations.queries";
import { buildSchedule } from "../lib/room-schedule";
import { ScheduleStay } from "./schedule-stay";

type RoomScheduleProps = {
	reservations: ReservationRow[];
	/** Every room, by door number. One column each. */
	rooms: Room[];
	/** The first night of the window, `YYYY-MM-DD`. */
	firstDay: string;
};

/** A 6rem night column and a 12rem column per room, as the narrow time column and the wide room columns of the kit. */
export function RoomSchedule({
	reservations,
	rooms,
	firstDay,
}: RoomScheduleProps) {
	const { t, locale } = useT();
	const rows = buildSchedule(reservations, rooms, firstDay);
	const today = toIsoDay(Date.now());
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayMonth = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<div className="overflow-x-auto">
				<table
					aria-label={t("reservations.scheduleLabel")}
					className="w-max table-fixed border-collapse"
				>
					<colgroup>
						<col className="w-24" />
						{rooms.map((room) => (
							<col key={room.id} className="w-48" />
						))}
					</colgroup>
					<thead>
						<tr>
							<th
								scope="col"
								className="px-4 py-4 text-start font-normal text-muted-foreground text-sm"
							>
								{t("reservations.night")}
							</th>
							{rooms.map((room) => (
								<th
									key={room.id}
									scope="col"
									className="border-s px-2 py-3 text-center font-normal"
								>
									<span className="block font-medium text-sm">
										{fillMessage(t("reservations.roomNumber"), {
											number: room.number,
										})}
									</span>
									<span className="block text-muted-foreground text-xs">
										{t(`roomTypes.${room.type}`)}
									</span>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.day}>
								<th
									scope="row"
									className={cn(
										"border-t px-4 py-3 text-start align-top text-sm",
										row.day === today
											? "font-semibold"
											: "font-normal text-muted-foreground",
									)}
								>
									<span className="block">
										{weekday.format(dayToDate(row.day))}
									</span>
									<span className="block tabular-nums">
										{dayMonth.format(dayToDate(row.day))}
									</span>
								</th>
								{row.cells.map((cell) => (
									<td
										key={cell.roomId}
										className="h-28 border-s border-t p-2 align-top"
									>
										<div className="grid gap-2">
											{cell.isClosed ? (
												<span className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-muted-foreground text-xs">
													<WrenchIcon className="size-3.5 shrink-0" />
													{t("reservations.closed")}
												</span>
											) : null}
											{cell.stays.map((stay) => (
												<ScheduleStay key={stay.id} stay={stay} />
											))}
										</div>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Card>
	);
}
