// The two-week planner of the time-off page: one row per person who is off, one column per day from today.
// TimeOffPage renders it with the planner query. A bar spans the days of one leave; a dashed bar waits for approval.
// The days scroll inside the card on a narrow screen, under a sticky name column. The page never scrolls sideways.
import { Link } from "@tanstack/react-router";
import {
	CARD_TITLE_CLASS,
	dayKeyToMs,
	isWeekend,
	PersonAvatar,
	TIME_OFF_TYPE_COLOR,
	TIME_OFF_TYPES,
	TimeOffTypeMark,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { Planner } from "../api/time-off.queries";

// The name column, then one column per day. A day column never gets narrower than a two-digit date.
// The minimums (9rem and 14 × 2rem) fit the two weeks in the main column of a 1024 px screen.
const GRID_COLUMNS =
	"grid-cols-[minmax(9rem,14rem)_repeat(14,minmax(2rem,1fr))]";
// The name cells stay in view while the days scroll under them. The card fill hides the bars below.
const STICKY_CELL = "sticky start-0 z-10 bg-card";

type PlannerCardProps = {
	/** The two-week grid from plannerQueryOptions: the 14 day keys from today, and one row per person who is off. */
	planner: Planner;
};

/** The planner panel: the legend, the day header, and the leave bars. */
export function PlannerCard({ planner }: PlannerCardProps) {
	const { t, locale } = useT();
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const rangeFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const dates = planner.days.map((day) => new Date(dayKeyToMs(day)));
	const firstDate = dates[0];
	const lastDate = dates[dates.length - 1];

	return (
		<Card>
			<CardHeader>
				<CardTitle className={CARD_TITLE_CLASS}>
					{t("timeOff.plannerTitle")}
				</CardTitle>
				<CardDescription>
					{firstDate && lastDate
						? `${t("timeOff.plannerDescription")} ${rangeFormat.formatRange(firstDate, lastDate)}`
						: t("timeOff.plannerDescription")}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
					{TIME_OFF_TYPES.map((type) => (
						<li key={type}>
							<TimeOffTypeMark type={type} />
						</li>
					))}
					<li className="flex items-center gap-2">
						<span
							className="h-2.5 w-4 rounded-badge border border-muted-foreground border-dashed"
							aria-hidden
						/>
						{t("timeOff.plannerPending")}
					</li>
				</ul>
				{/* A phone shows about five days. The hint tells that the second week is to the side. */}
				{planner.rows.length > 0 ? (
					<p className="@md/main:hidden text-muted-foreground text-xs">
						{t("timeOff.plannerScrollHint")}
					</p>
				) : null}
				{planner.rows.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("timeOff.plannerEmpty")}
					</p>
				) : (
					<div className="overflow-x-auto">
						{/* 37rem is the sum of the column minimums. The rows stretch to it, so the sticky names never leave a row. */}
						<div className="grid w-full min-w-[37rem] gap-y-1">
							<div className={cn("grid items-end pb-2 text-xs", GRID_COLUMNS)}>
								<span
									className={cn(
										"label-text flex items-end self-stretch text-muted-foreground",
										STICKY_CELL,
									)}
								>
									{t("timeOff.plannerPerson")}
								</span>
								{dates.map((date, index) => (
									<span
										key={planner.days[index]}
										className={cn(
											"grid justify-items-center gap-1 text-muted-foreground",
											isWeekend(date) && "opacity-60",
										)}
									>
										<span>{weekday.format(date)}</span>
										<span
											className={cn(
												"grid size-6 place-items-center rounded-full font-numeric tabular-nums",
												index === 0
													? "bg-primary font-medium text-primary-foreground"
													: "text-foreground",
											)}
										>
											{dayNumber.format(date)}
										</span>
									</span>
								))}
							</div>
							{planner.rows.map((row) => (
								<div
									key={row.employeeId}
									className={cn(
										"grid items-center border-border border-t py-1.5",
										GRID_COLUMNS,
									)}
								>
									<Link
										to="/app/employees/$employeeId"
										params={{ employeeId: row.employeeId }}
										className={cn(
											"col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 self-stretch pe-3 hover:underline",
											STICKY_CELL,
										)}
									>
										<PersonAvatar name={row.name} className="size-7" />
										<span className="grid min-w-0">
											<span className="truncate font-medium text-sm">
												{row.name}
											</span>
											{/* A phone shows the name only, so more days fit beside it. */}
											<span className="@md/main:block hidden truncate text-muted-foreground text-xs">
												{row.title}
											</span>
										</span>
									</Link>
									{dates.map((date, index) =>
										isWeekend(date) ? (
											<span
												key={planner.days[index]}
												className="row-start-1 h-9 self-stretch bg-muted/60"
												style={{ gridColumn: index + 2 }}
												aria-hidden
											/>
										) : null,
									)}
									{row.spans.map((span) => {
										const color = TIME_OFF_TYPE_COLOR[span.type];
										const first = planner.days[span.from];
										const last = planner.days[span.to];
										// The bar has no text, so its label names the type, the days, and a pending state.
										const label = [
											t(`timeOffTypes.${span.type}`),
											first && last
												? rangeFormat.formatRange(
														new Date(dayKeyToMs(first)),
														new Date(dayKeyToMs(last)),
													)
												: null,
											span.isPending ? t("timeOff.plannerPending") : null,
										]
											.filter((part) => part !== null)
											.join(", ");
										return (
											<Link
												key={span.requestId}
												to="/app/time-off"
												search={{ request: span.requestId }}
												aria-label={label}
												title={label}
												className={cn(
													"row-start-1 mx-0.5 h-6 rounded-badge",
													span.isPending && "border border-dashed",
												)}
												style={{
													gridColumn: `${span.from + 2} / ${span.to + 3}`,
													...(span.isPending
														? {
																borderColor: color,
																background: `color-mix(in oklab, ${color} 18%, transparent)`,
															}
														: { background: color }),
												}}
											/>
										);
									})}
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
