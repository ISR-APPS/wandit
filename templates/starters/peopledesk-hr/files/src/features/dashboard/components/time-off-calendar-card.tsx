// The calendar card of the home: a month with a dot on each working day with more people on leave than usual,
// then the people away on the chosen day. DashboardPage renders it beside the upcoming time-off table.
// It follows the month card of recipe 3.7. The shown month and the chosen day are state; a choice changes no query.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	addMonths,
	fillMessage,
	monthGridDays,
	PersonAvatar,
	TimeOffTypeMark,
	toDayKey,
	workingDayKeys,
} from "~/features/people";
import type { TimeOffRequest } from "~/features/time-off";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";

// Four people keep the card as tall as the table beside it. A link opens the rest on the time-off page.
const SHOWN_PEOPLE = 4;

type TimeOffCalendarCardProps = {
	/** Every time-off request. The card keeps the approved and the pending ones. */
	requests: TimeOffRequest[];
	/** Local midnight of today, in milliseconds since 1970. */
	todayStart: number;
};

/** A dot marks a busy day: more people on approved leave than the mean. The list also shows pending requests. */
export function TimeOffCalendarCard({
	requests,
	todayStart,
}: TimeOffCalendarCardProps) {
	const { t, locale } = useT();
	const [selectedDay, setSelectedDay] = useState(todayStart);
	const [monthStart, setMonthStart] = useState(() => addMonths(todayStart, 0));
	const days = monthGridDays(monthStart, locale);
	const live = requests.filter(
		(request) => request.status === "approved" || request.status === "pending",
	);
	// People on approved leave per working day, by day key.
	const awayCount = new Map<string, number>();
	for (const request of live) {
		if (request.status !== "approved") {
			continue;
		}
		for (const day of workingDayKeys(request.startDate, request.endDate)) {
			awayCount.set(day, (awayCount.get(day) ?? 0) + 1);
		}
	}
	// Most working days have someone away. A dot only on days above the mean tells the user something.
	const counts = [...awayCount.values()];
	const meanAway =
		counts.length === 0
			? 0
			: counts.reduce((sum, count) => sum + count, 0) / counts.length;
	const selectedKey = toDayKey(new Date(selectedDay));
	// A request covers its working days only, so nobody is away on a weekend.
	const away = live.filter((request) =>
		workingDayKeys(request.startDate, request.endDate).includes(selectedKey),
	);
	const number = new Intl.NumberFormat(locale);
	const monthName = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	});
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const fullDay = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const shortDay = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const month = new Date(monthStart).getMonth();

	return (
		<Card className="gap-0 py-0">
			<div className="grid gap-3 p-4">
				<div className="flex items-center justify-between">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("calendar.previousMonth")}
						onClick={() => setMonthStart((current) => addMonths(current, -1))}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
					</Button>
					<h2 className="font-medium text-sm">
						{monthName.format(monthStart)}
					</h2>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("calendar.nextMonth")}
						onClick={() => setMonthStart((current) => addMonths(current, 1))}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
				</div>
				<div className="grid grid-cols-7 text-center text-muted-foreground text-xs">
					{days.slice(0, 7).map((dayStart) => (
						<span key={dayStart} className="py-1">
							{weekday.format(dayStart)}
						</span>
					))}
				</div>
				<div className="grid grid-cols-7 gap-y-1">
					{days.map((dayStart) => {
						const isSelected = dayStart === selectedDay;
						const isBusy =
							(awayCount.get(toDayKey(new Date(dayStart))) ?? 0) > meanAway;
						return (
							<button
								key={dayStart}
								type="button"
								onClick={() => setSelectedDay(dayStart)}
								aria-pressed={isSelected}
								aria-label={
									isBusy
										? `${fullDay.format(dayStart)}, ${t("calendar.busyDay")}`
										: fullDay.format(dayStart)
								}
								className={cn(
									"relative mx-auto flex size-9 flex-col items-center justify-center rounded-control text-sm tabular-nums outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
									new Date(dayStart).getMonth() !== month &&
										"text-muted-foreground",
									dayStart === todayStart && "font-semibold",
									isSelected &&
										"bg-primary text-primary-foreground hover:bg-primary",
								)}
							>
								{new Date(dayStart).getDate()}
								{isBusy ? (
									<span
										aria-hidden="true"
										className={cn(
											"absolute bottom-1 size-1 rounded-full",
											isSelected ? "bg-primary-foreground" : "bg-primary",
										)}
									/>
								) : null}
							</button>
						);
					})}
				</div>
			</div>
			<div className="border-t">
				<p className="px-4 pt-3 text-muted-foreground text-xs">
					{fillMessage(t("calendar.awayOn"), {
						day: shortDay.format(selectedDay),
					})}
				</p>
				{away.length === 0 ? (
					<p className="px-4 py-8 text-center text-muted-foreground text-sm">
						{t("calendar.nobodyAway")}
					</p>
				) : (
					<ul className="divide-y">
						{away.slice(0, SHOWN_PEOPLE).map((request) => (
							<li key={request.id}>
								<Link
									to="/app/time-off"
									search={{ request: request.id }}
									className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
								>
									<PersonAvatar
										name={request.employeeName}
										className="size-9"
									/>
									<span className="grid min-w-0 flex-1 gap-1">
										<span
											className="truncate font-medium text-sm leading-none"
											dir="auto"
										>
											{request.employeeName}
										</span>
										<TimeOffTypeMark
											type={request.type}
											className="text-muted-foreground text-xs"
										/>
									</span>
									{request.status === "pending" ? (
										<Badge variant="warning">
											{t("timeOffStatuses.pending")}
										</Badge>
									) : null}
								</Link>
							</li>
						))}
					</ul>
				)}
				{away.length > SHOWN_PEOPLE ? (
					<Link
						to="/app/time-off"
						className="block border-t px-4 py-3 text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:text-foreground"
					>
						{fillMessage(t("calendar.morePeople"), {
							count: number.format(away.length - SHOWN_PEOPLE),
						})}
					</Link>
				) : null}
			</div>
		</Card>
	);
}
