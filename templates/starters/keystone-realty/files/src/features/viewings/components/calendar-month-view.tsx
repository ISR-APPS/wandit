// The month view of the viewings calendar: a row of weekday names, then one row of 7 day cells per week of the month.
// ViewingsPage renders it inside the calendar card. Each cell lists the viewings of its day as chips.
// A cell shows 3 chips at most. "+N more" opens a menu with every viewing of that day.
import { Link } from "@tanstack/react-router";
import { countLabel, fillMessage, type ViewingRow } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { buildMonthGrid, dateOfDay, WEEK_DAYS } from "../lib/calendar";
import { ViewingChip } from "./viewing-chip";

// Three chips fill a cell of min-h-32. A fourth chip turns the last row into "+N more".
const SHOWN_CHIPS = 3;

type CalendarMonthViewProps = {
	/** Any day of the month on screen, as a day number. */
	anchorDay: number;
	/** Today, as a day number. Its number sits in a filled circle. */
	today: number;
	/** The first weekday of the locale: 0 is Sunday. */
	weekStart: number;
	/** The viewings of each day number, by start time. */
	days: Map<number, ViewingRow[]>;
};

/** Below the @3xl container width, a cell shows dots in place of chips: a chip needs about 9rem. */
export function CalendarMonthView({
	anchorDay,
	today,
	weekStart,
	days,
}: CalendarMonthViewProps) {
	const { t, locale } = useT();
	const grid = buildMonthGrid(anchorDay, weekStart);
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayOfMonth = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const longDate = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	return (
		<div className="grid">
			<div className="grid grid-cols-7 border-b">
				{grid.slice(0, WEEK_DAYS).map((cell) => (
					<span
						key={cell.dayNumber}
						className="py-2 text-center text-muted-foreground text-sm"
					>
						{weekday.format(dateOfDay(cell.dayNumber))}
					</span>
				))}
			</div>
			<div className="grid grid-cols-7">
				{grid.map((cell, index) => {
					const viewings = days.get(cell.dayNumber) ?? [];
					const isToday = cell.dayNumber === today;
					// A full cell keeps one row for "+N more", so it shows one chip less.
					const shown =
						viewings.length > SHOWN_CHIPS
							? viewings.slice(0, SHOWN_CHIPS - 1)
							: viewings;
					return (
						<div
							key={cell.dayNumber}
							className={cn(
								"grid @3xl/main:min-h-32 min-h-20 content-start gap-1 border-b p-1.5",
								// The last column has no end rule: the card edge closes the grid.
								index % WEEK_DAYS === WEEK_DAYS - 1 ? "" : "border-e",
								// The last row has no bottom rule for the same reason.
								index >= grid.length - WEEK_DAYS && "border-b-0",
								cell.isInMonth ? "" : "bg-muted/40 text-muted-foreground",
							)}
						>
							<time
								dateTime={dateOfDay(cell.dayNumber).toISOString()}
								className={cn(
									"flex size-6 items-center justify-center text-sm tabular-nums",
									isToday &&
										"rounded-full bg-primary font-semibold text-primary-foreground",
								)}
							>
								<span aria-hidden="true">
									{dayOfMonth.format(dateOfDay(cell.dayNumber))}
								</span>
								<span className="sr-only">
									{longDate.format(dateOfDay(cell.dayNumber))}
								</span>
							</time>
							{viewings.length > 0 ? (
								<span className="flex @3xl/main:hidden gap-0.5 ps-1">
									{viewings.slice(0, SHOWN_CHIPS).map((viewing) => (
										<span
											key={viewing.id}
											aria-hidden="true"
											className="size-1.5 rounded-full bg-primary"
										/>
									))}
									<span className="sr-only">
										{countLabel(
											viewings.length,
											t("viewings.countOne"),
											t("viewings.countOther"),
											locale,
										)}
									</span>
								</span>
							) : null}
							<div className="@3xl/main:grid hidden gap-1">
								{shown.map((viewing) => (
									<ViewingChip key={viewing.id} viewing={viewing} />
								))}
								{viewings.length > shown.length ? (
									<DropdownMenu>
										<DropdownMenuTrigger className="w-fit rounded-sm px-1.5 text-start text-muted-foreground text-xs hover:text-foreground">
											{fillMessage(t("viewings.more"), {
												count: viewings.length - shown.length,
											})}
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start" className="w-64">
											<DropdownMenuLabel>
												{longDate.format(dateOfDay(cell.dayNumber))}
											</DropdownMenuLabel>
											<DropdownMenuSeparator />
											{viewings.map((viewing) => (
												<DropdownMenuItem key={viewing.id} asChild>
													<Link
														to="/app/listings/$listingId"
														params={{ listingId: viewing.listingId }}
														className="grid gap-0.5"
													>
														<span className="truncate text-sm" dir="auto">
															{viewing.listingStreet}
														</span>
														<span className="truncate text-muted-foreground text-xs">
															{`${time.format(new Date(viewing.startsAt))} · ${viewing.leadName} · ${t(`agency.viewingStatuses.${viewing.status}`)}`}
														</span>
													</Link>
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
