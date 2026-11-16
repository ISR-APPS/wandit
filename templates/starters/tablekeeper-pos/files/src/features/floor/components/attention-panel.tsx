// The "Needs attention" panel of the floor: bills that wait, late food, guests with no order, tables served
// a while ago, and the bookings of the next hour. Under them, "Coming up" lists the later bookings.
// FloorPage renders it beside the heat panel. A row sets `?table=<id>`, so it opens the table panel.
// It reads the floor board, the later bookings, and the rules of lib/attention.ts. It writes nothing.
import {
	CalendarCheckIcon,
	CookingPotIcon,
	ForkKnifeIcon,
	HourglassMediumIcon,
	ReceiptIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	type FloorTable,
	fillMessage,
	formatClock,
	formatMinutes,
	type Reservation,
	TABLE_STATUS_BADGE,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import { type AttentionReason, buildAttentionItems } from "../lib/attention";

// 3 urgent rows at most. The bookings fill the panel up to 5 rows, so it keeps the height of the heat panel.
const MAX_ATTENTION_ROWS = 3;
const MAX_ROWS = 5;
// The bookings always keep 2 rows, so a busy floor still shows what comes next.
const MIN_BOOKING_ROWS = 2;

/** One icon per reason, named after the object that waits. */
const REASON_ICONS = {
	billWaiting: ReceiptIcon,
	kitchenLate: CookingPotIcon,
	noOrder: HourglassMediumIcon,
	servedLong: ForkKnifeIcon,
	bookingSoon: CalendarCheckIcon,
} satisfies Record<AttentionReason, KitIcon>;

// The classes of one link row: a 44 px touch target with the hover and focus of the kit.
const ROW_CLASS =
	"-mx-2 flex min-h-11 items-center gap-3 rounded-control px-2 py-2 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";

type AttentionPanelProps = {
	/** Every table of the floor with its live status. */
	entries: FloorTable[];
	/** The bookings after the next hour, the earliest first (upcomingBookingsQueryOptions). */
	bookings: Reservation[];
	/** Milliseconds since 1970 at render. */
	now: number;
};

/** A Card with the urgent rows first, then the next bookings. No urgent row is the healthy state. */
export function AttentionPanel({
	entries,
	bookings,
	now,
}: AttentionPanelProps) {
	const { t, locale } = useT();
	const items = buildAttentionItems(entries, now).slice(0, MAX_ATTENTION_ROWS);
	const nextBookings = bookings.slice(
		0,
		Math.max(MIN_BOOKING_ROWS, MAX_ROWS - items.length),
	);
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const today = new Date(now).toDateString();
	// A booking of another day names its weekday, because the clock time alone reads as today.
	const bookingTime = (startsAt: string) => {
		const date = new Date(startsAt);
		const clock = formatClock(startsAt, locale);
		return date.toDateString() === today
			? clock
			: `${weekday.format(date)} ${clock}`;
	};

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("floor.attention")}</CardTitle>
			</CardHeader>
			<CardContent className="grid content-start gap-5">
				<div className="grid gap-1">
					{items.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("floor.attentionEmpty")}
						</p>
					) : (
						items.map((item) => {
							const Icon = REASON_ICONS[item.reason];
							const { table, status, reservation } = item.entry;
							const text =
								item.reason === "bookingSoon" && reservation
									? fillMessage(t("floor.bookingSoon"), {
											time: formatClock(item.since, locale),
											name: reservation.guestName,
											count: String(reservation.covers),
										})
									: fillMessage(t(`floor.${item.reason}`), {
											time: formatMinutes(item.waitMinutes, locale),
										});
							return (
								<Link
									key={table.id}
									to="/app"
									search={{ table: table.id }}
									className={ROW_CLASS}
								>
									<span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">
										<Icon className="size-4" />
									</span>
									<span className="grid min-w-0 flex-1 gap-0.5">
										<span className="font-medium text-sm">{table.name}</span>
										<span className="truncate text-muted-foreground text-xs tabular-nums">
											{text}
										</span>
									</span>
									<Badge variant={TABLE_STATUS_BADGE[status]}>
										{t(`tableStatuses.${status}`)}
									</Badge>
								</Link>
							);
						})
					)}
				</div>
				<section className="grid gap-1 border-t pt-4">
					<h3 className="mb-1 font-medium text-muted-foreground text-xs">
						{t("floor.comingUp")}
					</h3>
					{nextBookings.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("floor.comingUpEmpty")}
						</p>
					) : (
						nextBookings.map((booking) => {
							const table = entries.find(
								(entry) => entry.table.id === booking.tableId,
							)?.table;
							return (
								<Link
									key={booking.id}
									to="/app"
									search={{ table: booking.tableId }}
									className={ROW_CLASS}
								>
									<span className="w-24 shrink-0 font-medium text-sm tabular-nums">
										{bookingTime(booking.startsAt)}
									</span>
									<span className="min-w-0 flex-1 truncate text-sm">
										{booking.guestName}
									</span>
									<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
										{fillMessage(t("floor.bookingGuests"), {
											count: String(booking.covers),
											table: table?.name ?? booking.tableId,
										})}
									</span>
								</Link>
							);
						})
					)}
				</section>
			</CardContent>
		</Card>
	);
}
