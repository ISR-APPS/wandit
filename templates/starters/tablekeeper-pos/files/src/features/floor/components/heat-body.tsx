// The body of the "Checks per day" panel: the figures and the facts, then the calendar or the strip with the legend.
// OrdersHeatPanel renders it when the checks per day have loaded. It fills two cells of the panel grid.
// It reads the day points that the panel passes. HeatCalendar and HeatStrip draw the cells.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { fillMessage } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { HEAT_STEPS } from "../lib/heat";
import type { DailyPoint } from "../lib/series";
import { HeatCalendar } from "./heat-calendar";
import { HeatStrip } from "./heat-strip";

// A period under 30 days fills one calendar column only, so it draws the strip.
const CALENDAR_MIN_DAYS = 30;

type HeatBodyProps = {
	/** One point per day, oldest first, the business day of now last. */
	points: DailyPoint[];
	/** The period, in days. Under 30 it draws the strip. */
	days: number;
	/** The KPI figures and their comparison line. They open the first column, above the facts. */
	figures: ReactNode;
};

/** Two grid cells. The facts sit right under the figures; the heat takes the second column from 3xl. */
export function HeatBody({ points, days, figures }: HeatBodyProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	// Midnight UTC, shown in UTC, keeps the same calendar day.
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "narrow",
		timeZone: "UTC",
	});
	const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
	// Monday, Wednesday, and Friday name their rows. 2024-01-01 is a Monday, so day N + 1 is the row N weekday.
	const shortWeekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const rowLabels = [0, 1, 2, 3, 4, 5, 6].map((row) =>
		row % 2 === 0 && row < 6
			? shortWeekday.format(toDate(`2024-01-0${row + 1}`))
			: "",
	);
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const busiest = points.reduce<DailyPoint | undefined>(
		(best, point) =>
			best === undefined || point.current > best.current ? point : best,
		undefined,
	);
	const busiestText = busiest ? shortDate.format(toDate(busiest.day)) : "";
	const label = fillMessage(t("floor.heatLabel"), {
		title: t("floor.checksPerDay"),
		days: number.format(days),
		total: number.format(total),
		day: busiestText,
		count: number.format(busiest?.current ?? 0),
	});
	const today = points.at(-1);
	// The last cell is the running day, so its title says that the count is not final.
	const cellTitle = (point: DailyPoint) =>
		fillMessage(
			t(point === today ? "floor.cellTitleToday" : "floor.cellTitle"),
			{
				date: shortDate.format(toDate(point.day)),
				count: number.format(point.current),
			},
		);

	return (
		<>
			<div className="grid content-start gap-6">
				{figures}
				<dl className="flex flex-wrap gap-x-10 gap-y-3">
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">
							{t("chart.total")}
						</dt>
						<dd className="font-numeric font-semibold text-lg tabular-nums">
							{number.format(total)}
						</dd>
					</div>
					{busiest && busiest.current > 0 ? (
						<div className="grid gap-0.5">
							<dt className="text-muted-foreground text-xs">
								{t("chart.busiestDay")}
							</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{busiestText}
								<span className="ms-2 font-normal text-muted-foreground text-sm">
									{number.format(busiest.current)}
								</span>
							</dd>
						</div>
					) : null}
				</dl>
				{total === 0 ? (
					<div className="grid justify-items-start gap-1">
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
						<Button asChild variant="link" className="h-auto px-0">
							<Link to="/app/order">{t("chart.emptyAction")}</Link>
						</Button>
					</div>
				) : null}
			</div>
			<div className="grid @3xl/main:justify-items-end gap-4">
				{days < CALENDAR_MIN_DAYS ? (
					<HeatStrip
						points={points}
						label={label}
						cellTitle={cellTitle}
						dayLabel={(point) => weekday.format(toDate(point.day))}
					/>
				) : (
					<HeatCalendar
						points={points}
						label={label}
						cellTitle={cellTitle}
						rowLabels={rowLabels}
						size={days <= CALENDAR_MIN_DAYS ? "lg" : "md"}
					/>
				)}
				<div
					aria-hidden="true"
					className="flex items-center gap-1.5 text-muted-foreground text-xs"
				>
					{t("chart.less")}
					{HEAT_STEPS.map((step) => (
						<span key={step} className={`size-3 rounded-xs ${step}`} />
					))}
					{t("chart.more")}
				</div>
			</div>
		</>
	);
}
