// The heat strip of the checks per day: one row of cells, one per day.
// OrdersHeatPanel renders it for a period under 30 days, where a calendar would fill one column only.
// The cells share the width of the panel, so 7 days fill the same width as 30.
// The last cell is the running day. A ring marks it, as in HeatCalendar.
import { cn } from "~/shared/lib/utils";
import { HEAT_STEPS, heatStep } from "../lib/heat";
import type { DailyPoint } from "../lib/series";

type HeatStripProps = {
	/** One point per day, oldest first. The last one is the running business day. */
	points: DailyPoint[];
	/** The text of role="img": the title, the period, the total, and the busiest day. */
	label: string;
	/** The title of one cell: its date and its count. */
	cellTitle: (point: DailyPoint) => string;
	/** The weekday letter under each cell, from the date. */
	dayLabel: (point: DailyPoint) => string;
};

/** One row of cells with the weekday under each one. */
export function HeatStrip({
	points,
	label,
	cellTitle,
	dayLabel,
}: HeatStripProps) {
	const max = Math.max(0, ...points.map((point) => point.current));
	return (
		<div
			role="img"
			aria-label={label}
			className="grid w-full auto-cols-fr grid-flow-col gap-[4px]"
		>
			{points.map((point, index) => (
				<span key={point.day} className="grid gap-1.5 text-center">
					<span
						title={cellTitle(point)}
						className={cn(
							"h-10 rounded-xs",
							HEAT_STEPS[heatStep(point.current, max)],
							index === points.length - 1 && "ring-1 ring-foreground/40",
						)}
					/>
					<span className="text-muted-foreground text-xs">
						{dayLabel(point)}
					</span>
				</span>
			))}
		</div>
	);
}
