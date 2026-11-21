// The calendar card of the home: a month with a dot on each day that has a first visit, and the first visits of the chosen day.
// DashboardPage renders it first in the row of 3 of the Overview tab, with every appointment of the book.
// The shown month and the chosen day are state of the card. A choice changes no query.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type AppointmentRow,
	AppointmentStatusBadge,
	addMonths,
	fillMessage,
	isLate,
	monthGridDays,
	PersonAvatar,
	startOfLocalDay,
	startOfMonth,
	toIsoDay,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";

type FirstVisitsCalendarCardProps = {
	/** Every appointment of the book, oldest first. */
	rows: AppointmentRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** The dot marks a day with a new patient. A day outside the book (90 days back, 14 ahead) has none. */
export function FirstVisitsCalendarCard({
	rows,
	now,
}: FirstVisitsCalendarCardProps) {
	const { t, locale } = useT();
	const todayStart = startOfLocalDay(now);
	const firstVisits = rows.filter(
		(row) => row.visitType === "first_visit" && row.status !== "cancelled",
	);
	// The card opens on the day with a first visit that is nearest to today, so it rarely opens empty.
	const [selectedDay, setSelectedDay] = useState(
		() =>
			firstVisits
				.map((row) => startOfLocalDay(row.startsAt))
				.sort(
					(first, second) =>
						Math.abs(first - todayStart) - Math.abs(second - todayStart),
				)[0] ?? todayStart,
	);
	const [monthStart, setMonthStart] = useState(() => startOfMonth(selectedDay));
	const days = monthGridDays(monthStart, locale);
	const daysWithVisit = new Set(
		firstVisits.map((row) => toIsoDay(row.startsAt)),
	);
	const selectedRows = firstVisits.filter(
		(row) => toIsoDay(row.startsAt) === toIsoDay(selectedDay),
	);
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
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
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
						aria-label={t("appointments.previousMonth")}
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
						aria-label={t("appointments.nextMonth")}
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
						const hasVisit = daysWithVisit.has(toIsoDay(dayStart));
						return (
							<button
								key={dayStart}
								type="button"
								onClick={() => setSelectedDay(dayStart)}
								aria-pressed={isSelected}
								aria-label={
									hasVisit
										? `${fullDay.format(dayStart)}, ${t("dashboard.hasFirstVisit")}`
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
								{hasVisit ? (
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
					{fillMessage(t("dashboard.firstVisitsOf"), {
						day: shortDay.format(selectedDay),
					})}
				</p>
				{selectedRows.length === 0 ? (
					<p className="px-4 py-8 text-center text-muted-foreground text-sm">
						{t("dashboard.noFirstVisit")}
					</p>
				) : (
					<ul className="divide-y">
						{selectedRows.map((row) => (
							<li key={row.id}>
								<Link
									to="/app/patients/$patientId"
									params={{ patientId: row.patient.id }}
									className="flex items-center gap-3 p-4 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
								>
									<PersonAvatar
										name={row.patient.fullName}
										className="size-9"
									/>
									<span className="grid min-w-0 flex-1 gap-1">
										<span
											className="truncate font-medium text-sm leading-none"
											dir="auto"
										>
											{row.patient.fullName}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											{fillMessage(t("dashboard.withAt"), {
												practitioner: row.practitioner.fullName,
												time: time.format(row.startsAt),
											})}
										</span>
									</span>
									<AppointmentStatusBadge
										status={row.status}
										isLate={isLate(row, now)}
									/>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</Card>
	);
}
