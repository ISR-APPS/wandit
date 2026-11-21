// One stay in a cell of the room schedule: the booking code, a row menu, the guest, and the dates.
// RoomSchedule renders one per stay of a cell. It follows the booking card of the kit schedule:
// a tinted box with a colored start strip. The status word is in the menu label and in the list view too.
import { ClockIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	copyToClipboard,
	countLabel,
	dayToDate,
	fillMessage,
	type ReservationStatus,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import type { ReservationRow } from "../api/reservations.queries";

/** The ground and the strip of each status. The same colors as the status badges. */
export const STAY_TINT = {
	pending: { box: "bg-warning/12", strip: "bg-warning" },
	confirmed: { box: "bg-info/12", strip: "bg-info" },
	checked_in: { box: "bg-success/12", strip: "bg-success" },
	checked_out: { box: "bg-muted", strip: "bg-muted-foreground" },
	cancelled: { box: "bg-muted", strip: "bg-border" },
	no_show: { box: "bg-destructive/12", strip: "bg-destructive" },
} satisfies Record<ReservationStatus, { box: string; strip: string }>;

type ScheduleStayProps = {
	/** One reservation with its guest and room names, from the list query. */
	stay: ReservationRow;
};

/** The guest name opens the reservation. The menu opens it too, or copies the booking code. */
export function ScheduleStay({ stay }: ScheduleStayProps) {
	const { t, locale } = useT();
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const tint = STAY_TINT[stay.status];

	return (
		<div
			className={cn(
				"relative grid gap-1 overflow-hidden rounded-md border p-2 ps-3 text-xs",
				tint.box,
			)}
		>
			<span
				aria-hidden="true"
				className={cn("absolute inset-y-0 start-0 w-1", tint.strip)}
			/>
			<div className="flex items-center justify-between gap-2">
				<span className="tabular-nums">{stay.code}</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="-my-1 size-6"
							aria-label={fillMessage(t("reservations.stayActions"), {
								code: stay.code,
							})}
						>
							<DotsThreeIcon />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-40">
						<DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
							{t(`reservationStatuses.${stay.status}`)}
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link
								to="/app/reservations/$reservationId"
								params={{ reservationId: stay.id }}
							>
								{t("reservations.open")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(stay.code, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("reservations.copyCode")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<Link
				to="/app/reservations/$reservationId"
				params={{ reservationId: stay.id }}
				className="truncate font-semibold text-sm hover:underline"
				dir="auto"
			>
				{stay.guestName}
			</Link>
			<span className="flex items-center gap-1 text-muted-foreground tabular-nums">
				<ClockIcon className="size-3.5 shrink-0" />
				<span className="truncate">
					{`${shortDate.format(dayToDate(stay.checkIn))} – ${shortDate.format(dayToDate(stay.checkOut))} · ${countLabel(stay.nights, t("units.nightOne"), t("units.nightOther"), locale)}`}
				</span>
			</span>
		</div>
	);
}
