// The week board of the schedule: seven day columns with the posts of each day, and a status legend.
// SchedulePage renders it under the header. Under the 4xl container width it becomes an agenda: one row per day.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { CHIP_STATUS } from "../lib/chip-status";
import type { WeekDay } from "../lib/week";
import { PostChip } from "./post-chip";

type WeekBoardProps = {
	/** The seven days of the shown week, Monday first. */
	days: WeekDay[];
};

// The legend lists the three statuses that a day can hold. Drafts have no day.
const LEGEND = ["published", "scheduled", "failed"] as const;

/** A wide main area shows seven columns. A narrow one stacks the days, so no column is cut. */
export function WeekBoard({ days }: WeekBoardProps) {
	const { t, locale } = useT();
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const number = new Intl.NumberFormat(locale);

	return (
		<Card className="gap-4 py-4">
			<CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 text-muted-foreground text-xs">
				{LEGEND.map((status) => {
					const { icon: Icon, className } = CHIP_STATUS[status];
					return (
						<span key={status} className="flex items-center gap-1.5">
							<Icon className={cn("size-3.5", className)} />
							{t(`posts.statuses.${status}`)}
						</span>
					);
				})}
			</CardContent>
			<CardContent className="px-4">
				<ol className="grid @4xl/main:grid-cols-7 grid-cols-1 gap-2">
					{days.map((day) => (
						<li
							key={day.start}
							className={cn(
								"grid @4xl/main:min-h-48 @4xl/main:grid-cols-1 grid-cols-[4.5rem_1fr] @4xl/main:content-start gap-2 rounded-surface border border-border/60 p-2",
								day.isToday && "border-primary/50 bg-primary/5",
							)}
						>
							<div className="flex @4xl/main:flex-row flex-col items-start @4xl/main:items-center @4xl/main:justify-between gap-1 px-1 pt-1">
								<span className="flex items-center gap-2">
									<span className="text-muted-foreground text-xs">
										{weekday.format(day.start)}
									</span>
									<span
										className={cn(
											"flex size-7 items-center justify-center rounded-full font-numeric text-sm tabular-nums",
											day.isToday && "bg-primary text-primary-foreground",
										)}
									>
										{dayNumber.format(day.start)}
									</span>
								</span>
								{/* The agenda shows every chip in a row, so only the tall columns need the count. */}
								{day.posts.length > 0 ? (
									<span className="@4xl/main:inline hidden text-muted-foreground text-xs tabular-nums">
										{number.format(day.posts.length)}
									</span>
								) : null}
								{day.isToday ? (
									<span className="sr-only">{t("schedule.today")}</span>
								) : null}
							</div>
							{day.posts.length === 0 ? (
								<p className="@4xl/main:self-start self-center px-1 @4xl/main:pt-2 text-muted-foreground text-xs">
									{day.isPast
										? t("schedule.nothingPosted")
										: t("schedule.nothingPlanned")}
								</p>
							) : (
								<div className="grid @4xl/main:grid-cols-1 @xl/main:grid-cols-2 grid-cols-1 @4xl/main:content-start gap-1.5">
									{day.posts.map((post) => (
										<PostChip key={post.id} post={post} />
									))}
								</div>
							)}
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
