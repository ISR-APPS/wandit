// The body of the Solved panel: the heat of tickets solved per day, its three facts, and the legend.
// SolvedCard renders it when the series of the period is loaded.
import {
	type DailyPoint,
	dayToDate,
	fillMessage,
	type PeriodDays,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { HeatCalendar } from "./heat-calendar";
import { HeatLegend } from "./heat-legend";
import { HeatStrip } from "./heat-strip";

type SolvedHeatProps = {
	points: DailyPoint[];
	days: PeriodDays;
	/** The tooltip of one cell. */
	cellTitle: (point: DailyPoint) => string;
};

/** The calendar (or the strip under 30 days), then the daily average, the busiest day, and today's solves. */
export function SolvedHeat({ points, days, cellTitle }: SolvedHeatProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const longDate = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	});
	const shortDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const busiest = points.reduce<DailyPoint | null>(
		(best, point) => (point.current > (best?.current ?? 0) ? point : best),
		null,
	);
	const label = fillMessage(t("chart.solvedLabel"), {
		days: String(days),
		total: number.format(total),
		busiest: busiest ? longDate.format(dayToDate(busiest.day)) : "—",
	});
	const today = points.at(-1);
	const facts = [
		{
			key: "average",
			label: t("chart.dailyAverage"),
			value: number.format(total / days),
			note: null,
		},
		{
			key: "busiest",
			label: t("chart.busiestDay"),
			value: busiest ? number.format(busiest.current) : "—",
			note: busiest ? shortDate.format(dayToDate(busiest.day)) : null,
		},
		{
			key: "today",
			label: t("chart.solvedToday"),
			value: today ? number.format(today.current) : "—",
			note: null,
		},
	];
	return (
		<>
			<div className="flex @xl/main:flex-row flex-col @xl/main:gap-8 gap-5">
				{/* The strip fills the width. The calendar keeps its cell size, and the facts fill the rest. */}
				<div className={cn("min-w-0", days < 30 && "@xl/main:flex-1")}>
					{days < 30 ? (
						<HeatStrip points={points} label={label} cellTitle={cellTitle} />
					) : (
						<HeatCalendar points={points} label={label} cellTitle={cellTitle} />
					)}
				</div>
				<dl
					className={cn(
						"grid @xl/main:grid-cols-1 grid-cols-3 @xl/main:content-around gap-4 @xl/main:border-s @xl/main:ps-8",
						days >= 30 && "@xl/main:flex-1",
					)}
				>
					{facts.map((fact) => (
						<div key={fact.key} className="grid content-start gap-0.5">
							<dt className="text-muted-foreground text-xs">{fact.label}</dt>
							<dd className="font-numeric text-2xl tabular-nums">
								{fact.value}
								{fact.note ? (
									<span className="block font-sans text-muted-foreground text-xs">
										{fact.note}
									</span>
								) : null}
							</dd>
						</div>
					))}
				</dl>
			</div>
			<HeatLegend />
		</>
	);
}
