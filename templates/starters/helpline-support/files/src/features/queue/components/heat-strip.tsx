// The heat strip of the Solved panel: one row of squares, one per day, with the weekday under each square.
// SolvedCard renders it for the 7-day period: a week fills only one column of the calendar.
import { type DailyPoint, dayToDate } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { HEAT_STEPS, heatStep } from "../lib/heat-steps";

type HeatStripProps = {
	/** One point per day, oldest first. */
	points: DailyPoint[];
	/** The text for screen readers: the title, the period, the total, and the busiest day. */
	label: string;
	/** The tooltip of one cell: its date and its count. */
	cellTitle: (point: DailyPoint) => string;
};

/** Seven squares that fill the width, the count inside each square, and the weekday under it. */
export function HeatStrip({ points, label, cellTitle }: HeatStripProps) {
	const { locale } = useT();
	const max = Math.max(0, ...points.map((point) => point.current));
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const number = new Intl.NumberFormat(locale);
	return (
		<div className="grid gap-1.5">
			<div
				role="img"
				aria-label={label}
				className="grid auto-cols-fr grid-flow-col gap-[4px]"
			>
				{points.map((point) => (
					<span
						key={point.day}
						title={cellTitle(point)}
						className={cn(
							"flex h-12 items-center justify-center rounded-sm font-numeric text-sm tabular-nums",
							HEAT_STEPS[heatStep(point.current, max)],
							// The two darkest steps carry the chart color: the count then uses the primary text color.
							heatStep(point.current, max) >= 3
								? "text-primary-foreground"
								: "text-foreground",
						)}
					>
						{number.format(point.current)}
					</span>
				))}
			</div>
			<div
				aria-hidden="true"
				className="grid auto-cols-fr grid-flow-col gap-[4px] text-center text-muted-foreground text-xs"
			>
				{points.map((point) => (
					<span key={point.day}>{weekday.format(dayToDate(point.day))}</span>
				))}
			</div>
		</div>
	);
}
