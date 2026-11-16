// The load of the week ahead on the classes page: one line per day with its booked spots and its waitlist.
// ClassesPage renders it under the timetable. Each line opens that day in the timetable through the URL.
// Cancelled sessions have no spot, so they do not count.
import { Link } from "@tanstack/react-router";
import type { SessionRow } from "~/features/gym";
import { toDayKey } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { TimetableDay } from "../lib/class-fill";

type WeekAheadCardProps = {
	/** Today and the next 6 days. */
	days: TimetableDay[];
	/** Every session of those days. */
	sessions: SessionRow[];
	/** The day that the timetable shows, `YYYY-MM-DD`. Its line is marked. */
	activeKey: string;
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** Seven lines. The marked line is the day of the timetable above. */
export function WeekAheadCard({
	days,
	sessions,
	activeKey,
	now,
}: WeekAheadCardProps) {
	const { t, locale } = useT();
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const number = new Intl.NumberFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("classes.weekTitle")}</CardTitle>
				<CardDescription>{t("classes.weekDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-1">
					{days.map((day) => {
						const held = sessions.filter(
							(row) => toDayKey(row.startsAt) === day.key && !row.isCancelled,
						);
						const booked = held.reduce(
							(sum, row) => sum + row.roster.length,
							0,
						);
						const capacity = held.reduce((sum, row) => sum + row.capacity, 0);
						// A class that started has no use for its waitlist. The Today card of the home counts the same way.
						const waitlist = held
							.filter((row) => row.startsAt > now)
							.reduce((sum, row) => sum + row.waitlistCount, 0);
						const isActive = day.key === activeKey;
						return (
							<li key={day.key}>
								<Link
									to="/app/classes"
									search={{ day: day.key }}
									replace
									aria-current={isActive ? "true" : undefined}
									className={cn(
										"grid @xl/main:grid-cols-[10rem_1fr_11rem] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-control px-3 py-2.5 hover:bg-muted",
										isActive && "bg-muted",
									)}
								>
									<span className="text-sm">
										<span className="font-medium">
											{day === days[0]
												? t("classes.today")
												: weekday.format(day.start)}
										</span>
										<span className="text-muted-foreground">{` · ${date.format(day.start)}`}</span>
									</span>
									<Progress
										value={booked}
										max={capacity}
										aria-hidden="true"
										className="@xl/main:col-span-1 col-span-2 @xl/main:col-start-2 @xl/main:row-start-1 row-start-2 h-1.5"
									/>
									<span className="whitespace-nowrap text-end text-sm tabular-nums">
										{`${number.format(booked)} / ${number.format(capacity)}`}
										{waitlist > 0 ? (
											<span className="text-muted-foreground">{` · ${t("classes.waitlist")} ${number.format(waitlist)}`}</span>
										) : null}
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
