// The heat calendar of the checks per day: one column per week, one row per weekday, Monday on top.
// OrdersHeatPanel renders it for a period of 30 or 90 days. HeatStrip draws a period under 30 days.
// Plain elements, not recharts: a CSS grid draws the cells, and HEAT_STEPS gives their color.
// The last cell is the running day. A ring marks it, because its count is not final and reads low.
import { cn } from "~/shared/lib/utils";
import { HEAT_STEPS, heatStep } from "../lib/heat";
import type { DailyPoint } from "../lib/series";

// Keys of the blank cells before the first day: at most 6, for a first day on a Sunday.
const BLANK_KEYS = ["b1", "b2", "b3", "b4", "b5", "b6"];
// Keys of the 7 row labels, Monday first.
const ROW_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// md: 14 px cells and 3 px gaps, 16 px and 4 px from @xl/main:, so 90 days (14 columns) fit a phone.
// lg: the same, then 28 px and 5 px from @3xl/main:, where 30 days (6 columns) have a column of their own.
const SIZE_CLASSES = {
	md: {
		gap: "@xl/main:gap-[4px] gap-[3px]",
		cell: "@xl/main:size-[16px] size-[14px]",
		row: "@xl/main:h-[16px] h-[14px]",
	},
	lg: {
		gap: "@3xl/main:gap-[5px] @xl/main:gap-[4px] gap-[3px]",
		cell: "@3xl/main:size-[28px] @xl/main:size-[16px] size-[14px]",
		row: "@3xl/main:h-[28px] @xl/main:h-[16px] h-[14px]",
	},
} as const;

type HeatCalendarProps = {
	/** One point per day, oldest first. The last one is the running business day. */
	points: DailyPoint[];
	/** The text of role="img": the title, the period, the total, and the busiest day. */
	label: string;
	/** The title of one cell: its date and its count. */
	cellTitle: (point: DailyPoint) => string;
	/** Seven row labels, Monday first. An empty text leaves its row without a label. */
	rowLabels: string[];
	/** lg grows the cells in a wide container. OrdersHeatPanel gives lg to 30 days and md to 90. */
	size: keyof typeof SIZE_CLASSES;
};

/**
 * Px cell sizes (SIZE_CLASSES), not the theme scale, so 90 days always fit a phone.
 * rounded-xs gives 2 px corners: a theme radius is too round here.
 */
export function HeatCalendar({
	points,
	label,
	cellTitle,
	rowLabels,
	size,
}: HeatCalendarProps) {
	const sizes = SIZE_CLASSES[size];
	const max = Math.max(0, ...points.map((point) => point.current));
	const first = points[0];
	// Blank cells move the first day down to the row of its weekday. getUTCDay gives 0 for Sunday.
	const blanks = first
		? (new Date(`${first.day}T00:00:00Z`).getUTCDay() + 6) % 7
		: 0;
	return (
		<div className="flex gap-2">
			{/* The row labels use the same rows and gaps as the cells, so each label sits beside its weekday. */}
			<div
				aria-hidden="true"
				className={cn(
					"grid grid-rows-7 text-muted-foreground text-xs",
					sizes.gap,
				)}
			>
				{rowLabels.map((rowLabel, index) => (
					<span
						key={ROW_KEYS[index]}
						className={cn("flex items-center leading-none", sizes.row)}
					>
						{rowLabel}
					</span>
				))}
			</div>
			<div
				role="img"
				aria-label={label}
				className={cn("grid w-fit grid-flow-col grid-rows-7", sizes.gap)}
			>
				{BLANK_KEYS.slice(0, blanks).map((key) => (
					<span key={key} />
				))}
				{points.map((point, index) => (
					<span
						key={point.day}
						title={cellTitle(point)}
						className={cn(
							"rounded-xs",
							sizes.cell,
							HEAT_STEPS[heatStep(point.current, max)],
							index === points.length - 1 && "ring-1 ring-foreground/40",
						)}
					/>
				))}
			</div>
		</div>
	);
}
