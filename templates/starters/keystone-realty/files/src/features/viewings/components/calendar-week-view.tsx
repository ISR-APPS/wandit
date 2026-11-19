// The week view of the viewings calendar: 7 columns, each with its day head and every viewing of the day.
// ViewingsPage renders it inside the calendar card. The columns scroll inside the card on a phone.
import type { ViewingRow } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { dateOfDay, WEEK_DAYS, weekStartDayOf } from "../lib/calendar";
import { ViewingChip } from "./viewing-chip";

type CalendarWeekViewProps = {
	/** Any day of the week on screen, as a day number. */
	anchorDay: number;
	/** Today, as a day number. Its head is marked. */
	today: number;
	/** The first weekday of the locale: 0 is Sunday. */
	weekStart: number;
	/** The viewings of each day number, by start time. */
	days: Map<number, ViewingRow[]>;
};

/** A day shows all its viewings: a week has room for them, so no "+N more". */
export function CalendarWeekView({
	anchorDay,
	today,
	weekStart,
	days,
}: CalendarWeekViewProps) {
	const { t, locale } = useT();
	const first = weekStartDayOf(anchorDay, weekStart);
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayOfMonth = new Intl.DateTimeFormat(locale, { day: "numeric" });

	return (
		<div className="overflow-x-auto">
			<div className="grid min-w-3xl grid-cols-7">
				{Array.from({ length: WEEK_DAYS }, (_, index) => {
					const dayNumber = first + index;
					const viewings = days.get(dayNumber) ?? [];
					const isToday = dayNumber === today;
					return (
						<div
							key={dayNumber}
							className={cn(
								"grid min-h-96 content-start gap-1.5 p-2",
								// The last column has no end rule: the card edge closes the grid.
								index < WEEK_DAYS - 1 && "border-e",
							)}
						>
							<p className="flex items-center gap-2 border-b pb-2 text-sm">
								<span className="text-muted-foreground">
									{weekday.format(dateOfDay(dayNumber))}
								</span>
								<span
									className={cn(
										"flex size-6 items-center justify-center tabular-nums",
										isToday &&
											"rounded-full bg-primary font-semibold text-primary-foreground",
									)}
								>
									{dayOfMonth.format(dateOfDay(dayNumber))}
								</span>
							</p>
							{viewings.length === 0 ? (
								<p className="text-muted-foreground text-xs">
									{t("viewings.emptyDayShort")}
								</p>
							) : (
								viewings.map((viewing) => (
									<ViewingChip key={viewing.id} viewing={viewing} />
								))
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
