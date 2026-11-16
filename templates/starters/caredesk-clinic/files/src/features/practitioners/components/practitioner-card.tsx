// The card of one practitioner: who it is, the day so far, the next or current patient, and the working days.
// PractitionersPage renders one card per practitioner. The footer link opens the list of that practitioner.
// On a day off, the card gives the next working day and its hours in place of the progress of the day.
import { PhoneIcon, TranslateIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	addDays,
	atMinute,
	fillMessage,
	PersonAvatar,
	shiftOn,
	startOfLocalDay,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardFooter } from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import type { PractitionerRow } from "../lib/practitioner-rows";

type PractitionerCardProps = {
	practitioner: PractitionerRow;
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

// The days of the week strip, as Date.getDay() numbers. The strip starts on Monday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** A day off shows the next working day in place of the progress of the day. */
export function PractitionerCard({ practitioner, now }: PractitionerCardProps) {
	const { t, locale } = useT();
	const todayStart = startOfLocalDay(now);
	const number = new Intl.NumberFormat(locale);
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
	const shortWeekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
	// "unit" joins with commas only: "English, Norwegian, German" stays short beside the icon.
	const languages = new Intl.ListFormat(locale, {
		type: "unit",
		style: "short",
	});
	const todayIndex = new Date(todayStart).getDay();
	const { shiftToday, nextAppointment, currentAppointment, nextWorkDay } =
		practitioner;
	// The last patient of the day is still in the room, so the day is not over yet.
	const shownAppointment = nextAppointment ?? currentAppointment;
	const nextShift = shiftOn(practitioner, nextWorkDay);

	return (
		// pb-2: the footer link is 44 px high for a finger, so the card needs less space under it.
		<Card className="gap-5 pb-2">
			<CardContent className="grid gap-5">
				<div className="flex items-start gap-3">
					<PersonAvatar
						name={practitioner.fullName}
						tone="staff"
						className="size-11 [&_[data-slot=avatar-fallback]]:text-sm"
					/>
					<div className="grid min-w-0 flex-1 gap-0.5">
						{/* The badge sits beside the name only, so the two lines under it use the full width. */}
						<div className="flex items-center justify-between gap-2">
							<h2 className="truncate font-semibold">
								{practitioner.fullName}
							</h2>
							<Badge variant={shiftToday ? "success" : "outline"}>
								{t(
									shiftToday
										? "practitioners.onDuty"
										: "practitioners.offToday",
								)}
							</Badge>
						</div>
						<p className="truncate text-muted-foreground text-sm">
							{`${practitioner.credentials} · ${t(`specialties.${practitioner.specialty}`)} · ${practitioner.room}`}
						</p>
						<p className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
							<PhoneIcon className="size-3.5 shrink-0" aria-hidden="true" />
							<span className="sr-only">{t("practitioners.extension")}</span>
							<span className="tabular-nums">{practitioner.extension}</span>
							<TranslateIcon
								className="ms-2 size-3.5 shrink-0"
								aria-hidden="true"
							/>
							<span className="sr-only">{t("practitioners.languages")}</span>
							<span className="truncate">
								{languages.format(practitioner.languages)}
							</span>
						</p>
					</div>
				</div>
				{/* min-h-16: both blocks have one height, so the cards of one row line up. */}
				{shiftToday ? (
					<div className="grid min-h-16 gap-2">
						<div className="flex items-baseline justify-between gap-3 text-sm">
							<span className="text-muted-foreground tabular-nums">
								{time.formatRange(
									atMinute(todayStart, shiftToday[0]),
									atMinute(todayStart, shiftToday[1]),
								)}
							</span>
							<span className="font-medium tabular-nums">
								{fillMessage(t("practitioners.seenOfTotal"), {
									seen: number.format(practitioner.todaySeen),
									total: number.format(practitioner.todayTotal),
								})}
							</span>
						</div>
						{/* The brand color keeps the meter in the theme. Primary on its 15% tint stays above 3:1. */}
						<Progress
							className="bg-primary/15 [&>[data-slot=progress-indicator]]:bg-primary"
							value={practitioner.todaySeen}
							max={practitioner.todayTotal}
							aria-label={t("practitioners.dayProgress")}
						/>
						<p className="truncate text-sm">
							{shownAppointment ? (
								<>
									<span className="text-muted-foreground">
										{`${t(nextAppointment ? "practitioners.next" : "practitioners.withNow")} `}
									</span>
									<Link
										to="/app/appointments"
										search={{ appointment: shownAppointment.id }}
										className="font-medium hover:underline"
									>
										{shownAppointment.patient.fullName}
									</Link>
									<span className="text-muted-foreground tabular-nums">
										{`, ${time.format(shownAppointment.startsAt)}`}
									</span>
								</>
							) : (
								<span className="text-muted-foreground">
									{t("practitioners.noMoreToday")}
								</span>
							)}
						</p>
					</div>
				) : (
					<div className="grid min-h-16 content-start gap-1 text-sm">
						<p className="text-muted-foreground">{t("practitioners.backOn")}</p>
						<p className="font-medium tabular-nums">
							{nextShift
								? `${weekday.format(nextWorkDay)}, ${time.formatRange(
										atMinute(nextWorkDay, nextShift[0]),
										atMinute(nextWorkDay, nextShift[1]),
									)}`
								: weekday.format(nextWorkDay)}
						</p>
					</div>
				)}
				<div className="grid gap-2">
					<span className="text-muted-foreground text-xs">
						{t("practitioners.workingDays")}
					</span>
					<ul className="flex gap-1.5">
						{WEEK_ORDER.map((dayIndex) => {
							const works = practitioner.shifts[dayIndex] != null;
							// A date of the current week with this weekday, for the letter of the day.
							const sample = addDays(todayStart, dayIndex - todayIndex);
							const isToday = dayIndex === todayIndex;
							return (
								<li
									key={dayIndex}
									className={cn(
										"flex size-8 items-center justify-center rounded-md font-medium text-xs",
										// A day off is only an outline, so it does not look like a working day.
										works
											? "bg-accent text-accent-foreground"
											: "border border-dashed bg-transparent text-muted-foreground/50",
										isToday && "ring-2 ring-ring/60",
									)}
									title={isToday ? t("practitioners.today") : undefined}
								>
									<span aria-hidden="true">{shortWeekday.format(sample)}</span>
									<span className="sr-only">
										{`${weekday.format(sample)}${isToday ? ` (${t("practitioners.today")})` : ""}: ${t(works ? "practitioners.works" : "practitioners.dayOff")}`}
									</span>
								</li>
							);
						})}
					</ul>
				</div>
			</CardContent>
			{/* The visits of 30 days are in the panel under the cards, so the footer holds only the link. */}
			<CardFooter className="justify-end border-t pt-2 text-sm">
				<Link
					to="/app/appointments"
					search={{ view: "list", practitioner: practitioner.id }}
					className="inline-flex min-h-11 shrink-0 items-center gap-1.5 font-medium hover:underline"
				>
					{t("practitioners.seeAppointments")}
					<ArrowRightIcon className="size-4 rtl:rotate-180" />
				</Link>
			</CardFooter>
		</Card>
	);
}
