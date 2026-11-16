// The heat calendar of the Solved panel: one column per week, one row per weekday, one square per day.
// SolvedCard renders it for a period of 30 or 90 days. Plain elements on a CSS grid, with no chart library.
import { DAY_MS, type DailyPoint, dayToDate } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { HEAT_STEPS, heatStep } from "../lib/heat-steps";

type HeatCalendarProps = {
	/** One point per day, oldest first. */
	points: DailyPoint[];
	/** The text for screen readers: the title, the period, the total, and the busiest day. */
	label: string;
	/** The tooltip of one cell: its date and its count. */
	cellTitle: (point: DailyPoint) => string;
};

// The rows that get a weekday name, Monday on top. Three names keep the column narrow.
const LABELED_ROWS = [0, 2, 4];
// A Monday in UTC. Row n of the calendar is this day plus n days.
const MONDAY_UTC_MS = Date.UTC(2024, 0, 1);

// Up to this many days (5 weeks), the calendar is narrow, so it gets the large cells.
const LARGE_CELL_MAX_DAYS = 35;

// The px sizes of the cells, the label rows, and the gaps. Px keeps the calendar size when the theme scale changes.
const CELL_SIZES = {
	small: {
		cell: "@xl/main:size-[16px] size-[14px]",
		row: "@xl/main:h-[16px] h-[14px] @xl/main:leading-[16px] leading-[14px]",
		column: "@xl/main:auto-cols-[16px] auto-cols-[14px]",
		gap: "@xl/main:gap-[4px] gap-[3px]",
	},
	large: {
		cell: "@xl/main:size-[28px] size-[24px]",
		row: "@xl/main:h-[28px] h-[24px] @xl/main:leading-[28px] leading-[24px]",
		column: "@xl/main:auto-cols-[28px] auto-cols-[24px]",
		gap: "gap-[4px]",
	},
} as const;

/**
 * 24 to 28 px cells for a period of 30 days, 14 to 16 px cells for 90 days.
 * rounded-xs gives 2 px corners: a theme radius step is too round for a 14 px cell.
 */
export function HeatCalendar({ points, label, cellTitle }: HeatCalendarProps) {
	const { locale } = useT();
	const sizes =
		CELL_SIZES[points.length <= LARGE_CELL_MAX_DAYS ? "large" : "small"];
	const max = Math.max(0, ...points.map((point) => point.current));
	const first = points[0];
	// Blank cells move the first day down to the row of its weekday. getUTCDay gives 0 for Sunday.
	const blanks = first ? (dayToDate(first.day).getUTCDay() + 6) % 7 : 0;
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const month = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	const weekCount = Math.ceil((blanks + points.length) / 7);
	// A week column gets a month name when it holds the first day of a month, or when it is the first column.
	const monthLabels = Array.from({ length: weekCount }, (_, week) => {
		const days = points.slice(
			Math.max(0, week * 7 - blanks),
			Math.max(0, (week + 1) * 7 - blanks),
		);
		const firstOfMonth = days.find((point) => point.day.endsWith("-01"));
		const named = firstOfMonth ?? (week === 0 ? days[0] : undefined);
		return {
			key: `week-${week}`,
			text: named ? month.format(dayToDate(named.day)) : "",
		};
	});

	return (
		<div className="flex gap-2">
			<div
				aria-hidden="true"
				className={cn(
					"grid grid-rows-7 pt-5 text-muted-foreground text-xs",
					sizes.gap,
				)}
			>
				{Array.from({ length: 7 }, (_, row) => `row-${row}`).map((key, row) => (
					<span key={key} className={sizes.row}>
						{LABELED_ROWS.includes(row)
							? weekday.format(new Date(MONDAY_UTC_MS + row * DAY_MS))
							: ""}
					</span>
				))}
			</div>
			<div className="grid gap-1">
				<div
					aria-hidden="true"
					className={cn(
						"grid h-4 grid-flow-col text-muted-foreground text-xs",
						sizes.column,
						sizes.gap,
					)}
				>
					{monthLabels.map((item) => (
						<span key={item.key} className="whitespace-nowrap leading-4">
							{item.text}
						</span>
					))}
				</div>
				<div
					role="img"
					aria-label={label}
					className={cn("grid w-fit grid-flow-col grid-rows-7", sizes.gap)}
				>
					{Array.from({ length: blanks }, (_, blank) => `blank-${blank}`).map(
						(key) => (
							<span key={key} />
						),
					)}
					{points.map((point) => (
						<span
							key={point.day}
							title={cellTitle(point)}
							className={cn(
								"rounded-xs",
								sizes.cell,
								HEAT_STEPS[heatStep(point.current, max)],
							)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
