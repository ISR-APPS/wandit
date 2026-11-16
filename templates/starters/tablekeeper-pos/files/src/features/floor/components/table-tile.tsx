// One table on the floor wall: its name, its status as a dot and a word, and its live number.
// TableWall renders one tile per table. A click sets `?table=<id>`, and FloorPage opens the table panel.
// The live number depends on the status: the check amount, the booking time, or the minutes since seating.
// A free table in a closed zone shows when the zone opens again, so a room between services does not read as empty.
import { UsersIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	type FloorTable,
	fillMessage,
	formatCents,
	formatClock,
	formatMinutes,
	minutesSince,
	moneyFormat,
	orderSubtotalCents,
	TABLE_STATUS_DOT,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type TableTileProps = {
	/** The table and its live state, from the floor board. */
	entry: FloorTable;
	/** Milliseconds since 1970 at render. The page passes one value, so every tile counts from the same minute. */
	now: number;
};

/** A link tile with a focus ring. An empty table is quieter than a table with guests. */
export function TableTile({ entry, now }: TableTileProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const { table, status, openOrder, seating, reservation, closedZone } = entry;
	const isEmpty = status === "free" || status === "reserved";
	const covers = openOrder?.covers ?? seating?.covers ?? null;

	// The big number of the tile, then one muted line under it.
	let reading: string;
	let detail: string;
	if (openOrder) {
		reading = formatCents(money, orderSubtotalCents(openOrder));
		detail = formatMinutes(minutesSince(openOrder.openedAt, now), locale);
	} else if (seating) {
		const seatedMinutes = minutesSince(seating.seatedAt, now);
		// Under one minute, "0 min" reads like a machine. The tile says the guests just sat down.
		reading =
			seatedMinutes < 1
				? t("floor.justSeated")
				: formatMinutes(seatedMinutes, locale);
		detail = t("floor.seatedNoOrder");
	} else if (reservation) {
		reading = formatClock(reservation.startsAt, locale);
		detail = fillMessage(t("floor.bookingFor"), {
			name: reservation.guestName,
			count: String(reservation.covers),
		});
	} else if (closedZone) {
		reading = fillMessage(t("floor.opensAt"), {
			time: formatClock(closedZone.opensAt, locale),
		});
		detail = t(`services.${closedZone.service}`);
	} else {
		reading = fillMessage(t("floor.seats"), { count: String(table.seats) });
		const freeMinutes = entry.lastPaidAt
			? minutesSince(entry.lastPaidAt, now)
			: null;
		detail =
			freeMinutes === null
				? t("floor.freeAllDay")
				: freeMinutes < 1
					? t("floor.justFreed")
					: fillMessage(t("floor.freeFor"), {
							time: formatMinutes(freeMinutes, locale),
						});
	}

	return (
		<Link
			to="/app"
			search={{ table: table.id }}
			aria-label={fillMessage(t("floor.openTable"), { name: table.name })}
			className={cn(
				"group grid min-h-32 content-between gap-3 rounded-surface border p-4 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
				isEmpty
					? "border-dashed bg-canvas hover:bg-card"
					: "bg-card shadow-surface hover:bg-accent",
				status === "bill" && "border-primary/50 bg-primary/5",
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<span className="font-display font-semibold text-lg leading-none">
					{table.name}
				</span>
				<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
					<span
						aria-hidden="true"
						className={cn("size-2 rounded-full", TABLE_STATUS_DOT[status])}
					/>
					{closedZone ? t("floor.closed") : t(`tableStatuses.${status}`)}
				</span>
			</div>
			<div className="grid gap-1">
				<span
					className={cn(
						"font-numeric font-semibold text-xl tabular-nums leading-tight",
						isEmpty && "text-muted-foreground",
						// A closed room is quieter still: the opening time is a note, not a live number.
						closedZone && "font-medium text-base",
					)}
				>
					{reading}
				</span>
				<span className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
					{covers === null ? null : (
						<span className="flex shrink-0 items-center gap-1 tabular-nums">
							<UsersIcon className="size-3.5" />
							{fillMessage(t("floor.coversOfSeats"), {
								covers: String(covers),
								seats: String(table.seats),
							})}
						</span>
					)}
					<span className="truncate tabular-nums">{detail}</span>
				</span>
			</div>
		</Link>
	);
}
