// The "Today" panel of the home: the classes done of all classes today as a meter, then the counts of the floor.
// TodayPage renders it with buildDayProgress, so the meter moves when a class ends.
// The counts read the booked members of today's classes only. Open gym visits are in the 7-day figures.
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { DayProgress } from "../lib/day-brief";

type DayProgressCardProps = {
	progress: DayProgress;
	/** The grid span of the home page. */
	className?: string;
};

/** A meter with "3 of 6" above it and a row of three counts under it. */
export function DayProgressCard({ progress, className }: DayProgressCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const counts = [
		{
			id: "checked-in",
			label: t("today.checkedIn"),
			value: number.format(progress.checkedIn),
		},
		{
			id: "booked",
			label: t("today.spotsBooked"),
			value: `${number.format(progress.booked)} / ${number.format(progress.capacity)}`,
		},
		{
			id: "no-shows",
			label: t("today.noShows"),
			value: number.format(progress.noShows),
		},
	];

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("today.progressTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<p className="flex flex-wrap items-baseline gap-x-2">
					<span className="font-numeric text-4xl tabular-nums">
						{number.format(progress.done)}
					</span>
					<span className="text-muted-foreground">
						{`${t("today.of")} ${number.format(progress.total)} ${t("today.classesDone")}`}
					</span>
				</p>
				<Progress
					value={progress.done}
					max={progress.total}
					aria-label={t("today.classesDone")}
				/>
				<dl className="grid grid-cols-3 gap-3 border-t pt-4">
					{counts.map((count) => (
						<div key={count.id} className="grid content-start gap-1">
							<dt className="label-text text-muted-foreground text-xs">
								{count.label}
							</dt>
							<dd className="font-numeric text-lg tabular-nums">
								{count.value}
							</dd>
						</div>
					))}
				</dl>
				{progress.waitlist > 0 ? (
					<p className="text-muted-foreground text-sm">
						<span className="font-medium text-foreground tabular-nums">
							{number.format(progress.waitlist)}
						</span>
						{` ${t("today.onWaitlist")}`}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
