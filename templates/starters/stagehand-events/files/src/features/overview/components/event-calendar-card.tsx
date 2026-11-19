// The event calendar card of the home: a month grid with a dot on each event day, and the events of the chosen day.
// OverviewPage renders it beside the upcoming events table. The month and the day are local state, no query.
// It follows recipe 3.7 of the kit system (calendar-like grid) and computes the month in lib/month-grid.ts.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	EventStatusBadge,
	type EventSummary,
	startOfLocalDay,
	timeFormat,
	toIsoDay,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import { Separator } from "~/shared/ui/separator";
import { firstWeekday, monthGrid, monthStartOf } from "../lib/month-grid";

type EventCalendarCardProps = {
	/** Every event of the programme, from eventsQueryOptions. */
	events: EventSummary[];
	/** The time of the page render, in milliseconds since 1970. */
	now: number;
};

/** Opens on the month of today with today chosen. Cancelled events show too, with their badge. */
export function EventCalendarCard({ events, now }: EventCalendarCardProps) {
	const { t, locale } = useT();
	const [monthStart, setMonthStart] = useState(() => monthStartOf(now));
	const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(now));
	const weekStart = firstWeekday(locale);
	const days = monthGrid(monthStart, weekStart);
	const today = startOfLocalDay(now);
	const month = new Date(monthStart).getMonth();
	const monthLabel = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	});
	const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayLabel = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const time = timeFormat(locale);
	const eventsByDay = new Map<string, EventSummary[]>();
	for (const event of events) {
		const key = toIsoDay(event.startsAt);
		eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
	}
	const selectedEvents = eventsByDay.get(toIsoDay(selectedDay)) ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.calendar")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex items-center justify-between">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t("overview.previousMonth")}
						onClick={() => setMonthStart(monthStartOf(monthStart, -1))}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
					</Button>
					<p className="font-medium text-sm" aria-live="polite">
						{monthLabel.format(monthStart)}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t("overview.nextMonth")}
						onClick={() => setMonthStart(monthStartOf(monthStart, 1))}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
				</div>
				<div className="grid gap-1">
					<div className="grid grid-cols-7 text-center text-muted-foreground text-xs">
						{days.slice(0, 7).map((day) => (
							<span key={day}>{weekdayLabel.format(day)}</span>
						))}
					</div>
					<div className="grid grid-cols-7 gap-1">
						{days.map((day) => {
							const isSelected = day === selectedDay;
							const hasEvents = eventsByDay.has(toIsoDay(day));
							return (
								<button
									key={day}
									type="button"
									aria-pressed={isSelected}
									aria-label={dayLabel.format(day)}
									onClick={() => setSelectedDay(day)}
									className={cn(
										"mx-auto flex size-9 flex-col items-center justify-center gap-0.5 rounded-control text-sm tabular-nums hover:bg-accent",
										new Date(day).getMonth() !== month &&
											"text-muted-foreground",
										day === today && "font-semibold",
										isSelected &&
											"bg-primary text-primary-foreground hover:bg-primary",
									)}
								>
									{new Date(day).getDate()}
									<span
										aria-hidden="true"
										className={cn(
											"size-1 rounded-full",
											hasEvents
												? isSelected
													? "bg-primary-foreground"
													: "bg-primary"
												: "bg-transparent",
										)}
									/>
								</button>
							);
						})}
					</div>
				</div>
				<Separator />
				<div className="grid gap-2">
					<p className="text-muted-foreground text-xs">
						{dayLabel.format(selectedDay)}
					</p>
					{selectedEvents.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("overview.noEventOnDay")}
						</p>
					) : (
						<ul className="grid gap-2">
							{selectedEvents.map((event) => (
								<li key={event.id}>
									<Link
										to="/app/events/$eventId"
										params={{ eventId: event.id }}
										className="flex items-center gap-3 rounded-md border-chart-1 border-s bg-muted px-3 py-2 hover:bg-accent"
									>
										<span className="grid min-w-0 flex-1 gap-0.5">
											<span className="truncate font-medium text-sm">
												{event.name}
											</span>
											<span className="truncate text-muted-foreground text-xs tabular-nums">
												{`${time.format(event.startsAt)} · ${event.venue.name}`}
											</span>
										</span>
										<EventStatusBadge status={event.status} />
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
