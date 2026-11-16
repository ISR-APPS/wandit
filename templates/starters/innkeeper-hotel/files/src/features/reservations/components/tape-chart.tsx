// The calendar view of the reservations (a tape chart): one row per room, one column per day, one bar per stay.
// ReservationsPage renders it. A bar opens the detail page. The buttons move the 14-day window by one week.

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	addDays,
	BOOK_FUTURE_DAYS,
	BOOK_PAST_DAYS,
	type ReservationStatus,
	type Room,
	startOfLocalDay,
	toIsoDay,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import type { ReservationRow } from "../api/reservations.queries";
import { TAPE_DAYS, tapeBarsOfRoom } from "../lib/tape-chart";

// The first view starts 2 days before today, so the stays that just ended still show.
const DEFAULT_START_OFFSET = -2;
// One click moves the window by one week.
const STEP_DAYS = 7;
const FLOORS = [1, 2, 3] as const;

/** The fill of a bar per status. A stay in the house is the one strong color. */
const BAR_STYLE = {
	pending: "border border-dashed border-input bg-background text-foreground",
	confirmed:
		"bg-[color-mix(in_oklch,var(--chart-1)_28%,var(--card))] text-foreground",
	checked_in: "bg-primary text-primary-foreground",
	checked_out: "border border-border bg-muted text-muted-foreground",
	cancelled: "",
	no_show: "",
} satisfies Record<ReservationStatus, string>;

// The fill of the bar of a closed room. The legend shows the same square.
const CLOSED_BAR_STYLE =
	"border border-destructive/30 bg-destructive/10 text-destructive";
// A bar of one half day has room for one letter only. From 2 half days, it shows the name. A shorter bar keeps the name for screen readers.
const MIN_NAME_HALF_DAYS = 2;

/** The statuses of the legend, in the order of a stay. */
const LEGEND_STATUSES = [
	"checked_out",
	"checked_in",
	"confirmed",
	"pending",
] as const satisfies readonly ReservationStatus[];

type TapeChartProps = {
	/** The 18 rooms, by door number. */
	rooms: Room[];
	/** Every reservation of the list query. */
	reservations: ReservationRow[];
};

/** A grid of half days that scrolls sideways in its panel at 375 px. The room column stays in view. */
export function TapeChart({ rooms, reservations }: TapeChartProps) {
	const { t, locale } = useT();
	const [startOffset, setStartOffset] = useState(DEFAULT_START_OFFSET);
	const todayStart = startOfLocalDay(Date.now());
	const today = toIsoDay(todayStart);
	const days = Array.from({ length: TAPE_DAYS }, (_, index) => {
		const date = new Date(addDays(todayStart, startOffset + index));
		return { date, day: toIsoDay(date.getTime()) };
	});
	const windowStart = days[0]?.day ?? today;
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const range = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	// The sample book holds stays from 14 days ago to 21 days ahead. The window stays inside it.
	const minOffset = -BOOK_PAST_DAYS;
	const maxOffset = BOOK_FUTURE_DAYS - TAPE_DAYS;
	const firstDay = days[0];
	const lastDay = days.at(-1);

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="font-medium text-sm tabular-nums">
					{firstDay && lastDay
						? `${range.format(firstDay.date)} – ${range.format(lastDay.date)}`
						: null}
				</p>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={startOffset <= minOffset}
						onClick={() =>
							setStartOffset(Math.max(minOffset, startOffset - STEP_DAYS))
						}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
						{t("reservations.earlier")}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={startOffset === DEFAULT_START_OFFSET}
						onClick={() => setStartOffset(DEFAULT_START_OFFSET)}
					>
						{t("reservations.today")}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={startOffset >= maxOffset}
						onClick={() =>
							setStartOffset(Math.min(maxOffset, startOffset + STEP_DAYS))
						}
					>
						{t("reservations.later")}
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
				</div>
			</div>
			<div className="overflow-x-auto rounded-surface border">
				{/* 52rem keeps a day column wide enough for a name at 375 px. The panel scrolls sideways. */}
				<div className="grid min-w-208 grid-cols-[5.5rem_minmax(0,1fr)] text-sm">
					<div className="sticky start-0 z-20 border-e border-b bg-card px-3 py-2 text-muted-foreground text-xs">
						{t("reservations.room")}
					</div>
					<div className="grid grid-cols-14 border-b bg-card">
						{days.map((item) => (
							<div
								key={item.day}
								className={cn(
									"grid justify-items-center gap-0.5 border-s py-1.5 text-xs first:border-s-0",
									item.day === today && "bg-primary/10",
								)}
							>
								<span className="text-muted-foreground">
									{weekday.format(item.date)}
								</span>
								<span
									className={cn(
										"flex size-6 items-center justify-center rounded-full font-numeric tabular-nums",
										item.day === today && "bg-primary text-primary-foreground",
									)}
								>
									{dayNumber.format(item.date)}
								</span>
							</div>
						))}
					</div>
					{FLOORS.map((floor) => (
						<div key={floor} className="col-span-2 grid grid-cols-subgrid">
							<div
								className={cn(
									"sticky start-0 z-20 col-span-2 border-b bg-muted px-3 py-1 text-muted-foreground text-xs",
									floor > 1 && "border-t",
								)}
							>
								{t(`floors.floor${floor}`)}
							</div>
							{rooms
								.filter((room) => room.floor === floor)
								.map((room) => (
									<div
										key={room.id}
										className="col-span-2 grid grid-cols-subgrid border-b last:border-b-0"
									>
										<div className="sticky start-0 z-20 grid border-e bg-card px-3 py-1.5">
											<span className="font-numeric tabular-nums leading-tight">
												{room.number}
											</span>
											<span className="truncate text-muted-foreground text-xs leading-tight">
												{t(`roomTypes.${room.type}`)}
											</span>
										</div>
										{/* 28 half-day columns. The day cells and the bars share row 1, so a bar lies over its days. */}
										<div className="grid grid-cols-28">
											{days.map((item, index) => (
												<div
													key={item.day}
													style={{ gridColumn: `${index * 2 + 1} / span 2` }}
													className={cn(
														"row-start-1 border-s first:border-s-0",
														item.day === today && "bg-primary/10",
													)}
												/>
											))}
											{tapeBarsOfRoom(room, reservations, windowStart).map(
												(bar) =>
													bar.reservation ? (
														<Link
															key={bar.id}
															to="/app/reservations/$reservationId"
															params={{ reservationId: bar.reservation.id }}
															style={{
																gridColumn: `${bar.startLine} / ${bar.endLine}`,
															}}
															title={`${bar.reservation.guestName} · ${bar.reservation.code}`}
															className={cn(
																"z-10 row-start-1 mx-0.5 my-1.5 flex min-w-0 items-center rounded-control px-2 text-xs outline-none hover:opacity-85 focus-visible:ring-[3px] focus-visible:ring-ring/50",
																BAR_STYLE[bar.reservation.status],
															)}
														>
															<span
																className={
																	bar.endLine - bar.startLine >=
																	MIN_NAME_HALF_DAYS
																		? "truncate"
																		: "sr-only"
																}
																dir="auto"
															>
																{bar.reservation.guestName}
															</span>
														</Link>
													) : (
														<div
															key={bar.id}
															style={{
																gridColumn: `${bar.startLine} / ${bar.endLine}`,
															}}
															title={t("roomStatuses.out_of_order")}
															className={cn(
																"z-10 row-start-1 mx-0.5 my-1.5 flex min-w-0 items-center rounded-control px-2 text-xs",
																CLOSED_BAR_STYLE,
															)}
														>
															<span
																className={
																	bar.endLine - bar.startLine >=
																	MIN_NAME_HALF_DAYS
																		? "truncate"
																		: "sr-only"
																}
															>
																{t("roomStatuses.out_of_order")}
															</span>
														</div>
													),
											)}
										</div>
									</div>
								))}
						</div>
					))}
				</div>
			</div>
			<ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-xs">
				{LEGEND_STATUSES.map((status) => (
					<li key={status} className="inline-flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className={cn("h-3 w-5 rounded-xs", BAR_STYLE[status])}
						/>
						{t(`reservationStatuses.${status}`)}
					</li>
				))}
				<li className="inline-flex items-center gap-1.5">
					<span
						aria-hidden="true"
						className={cn("h-3 w-5 rounded-xs", CLOSED_BAR_STYLE)}
					/>
					{t("roomStatuses.out_of_order")}
				</li>
			</ul>
		</div>
	);
}
