// The heat form of the check-ins trend: a calendar of days in 5 color steps, a strip for a short period, the legend,
// and the step square of the breakdown list.
// CheckInsPanel renders them. They are plain elements on a CSS grid, with no chart library.
import { DAY_MS } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { DailyPoint } from "../lib/series";

/** The 5 steps from `--muted` (no check-in) to `--chart-1` (the busiest day). The legend shows the same 5. */
const HEAT_STEPS = [
	"bg-muted",
	"bg-[color-mix(in_oklch,var(--chart-1)_25%,var(--muted))]",
	"bg-[color-mix(in_oklch,var(--chart-1)_50%,var(--muted))]",
	"bg-[color-mix(in_oklch,var(--chart-1)_75%,var(--muted))]",
	"bg-chart-1",
] as const;

/**
 * Step of one cell: 0 to 4, an index of HEAT_STEPS. value / max is a share from 0 to 1.
 * Any check-in gives step 1 or more, so a quiet day never looks empty. A max of 0 gives step 0.
 */
function heatStep(value: number, max: number): number {
	return value <= 0 || max <= 0
		? 0
		: Math.min(
				HEAT_STEPS.length - 1,
				Math.ceil((value / max) * (HEAT_STEPS.length - 1)),
			);
}

/** The Date of a `YYYY-MM-DD` day at midnight UTC. Format it with `timeZone: "UTC"`: it then keeps the same calendar day. */
export function utcDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

type HeatProps = {
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

/**
 * One column per week, Monday on top: 14 px cells and 3 px gaps, 16 px and 4 px from @xl/main:.
 * The sizes are in px, so the theme scale does not resize the calendar. rounded-xs gives 2 px corners.
 */
export function HeatCalendar({ points, label, cellTitle }: HeatProps) {
	const { locale } = useT();
	const max = Math.max(0, ...points.map((point) => point.current));
	const first = points[0];
	// Blank cells move the first day down to the row of its weekday. getUTCDay gives 0 for Sunday.
	const blanks = first ? (utcDate(first.day).getUTCDay() + 6) % 7 : 0;
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const month = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	const weekCount = Math.ceil((blanks + points.length) / 7);
	// A week column gets a month name when it holds the first day of that month, or when it is the first column.
	const monthLabels = Array.from({ length: weekCount }, (_, week) => {
		const days = points.slice(
			Math.max(0, week * 7 - blanks),
			Math.max(0, (week + 1) * 7 - blanks),
		);
		const firstOfMonth = days.find((point) => point.day.endsWith("-01"));
		const named = firstOfMonth ?? (week === 0 ? days[0] : undefined);
		return {
			key: `week-${week}`,
			text: named ? month.format(utcDate(named.day)) : "",
		};
	});

	return (
		<div className="flex gap-2">
			<div
				aria-hidden="true"
				className="grid grid-rows-7 @xl/main:gap-[4px] gap-[3px] pt-5 text-muted-foreground text-xs"
			>
				{Array.from({ length: 7 }, (_, row) => `row-${row}`).map((key, row) => (
					<span
						key={key}
						className="@xl/main:h-[16px] h-[14px] @xl/main:leading-[16px] leading-[14px]"
					>
						{LABELED_ROWS.includes(row)
							? weekday.format(new Date(MONDAY_UTC_MS + row * DAY_MS))
							: ""}
					</span>
				))}
			</div>
			<div className="grid gap-1">
				<div
					aria-hidden="true"
					className="grid h-4 @xl/main:auto-cols-[16px] auto-cols-[14px] grid-flow-col @xl/main:gap-[4px] gap-[3px] text-muted-foreground text-xs"
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
					className="grid w-fit grid-flow-col grid-rows-7 @xl/main:gap-[4px] gap-[3px]"
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
								"@xl/main:size-[16px] size-[14px] rounded-xs",
								HEAT_STEPS[heatStep(point.current, max)],
							)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

/** One row of cells, one per day. A period under 30 days uses it: a week fills only one calendar column. */
export function HeatStrip({ points, label, cellTitle }: HeatProps) {
	const { locale } = useT();
	const max = Math.max(0, ...points.map((point) => point.current));
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const number = new Intl.NumberFormat(locale);

	return (
		<div
			role="img"
			aria-label={label}
			className="grid w-full max-w-md auto-cols-fr grid-flow-col gap-1.5"
		>
			{points.map((point) => (
				<div
					key={point.day}
					title={cellTitle(point)}
					className="grid justify-items-center gap-1"
				>
					<span
						className={cn(
							"h-10 w-full rounded-sm",
							HEAT_STEPS[heatStep(point.current, max)],
						)}
					/>
					<span className="font-numeric text-sm tabular-nums leading-none">
						{number.format(point.current)}
					</span>
					<span className="text-muted-foreground text-xs">
						{weekday.format(utcDate(point.day))}
					</span>
				</div>
			))}
		</div>
	);
}

/** The word "Less", the 5 step squares, and the word "More". Screen readers skip it. */
export function HeatLegend() {
	const { t } = useT();
	return (
		<div
			aria-hidden="true"
			className="flex items-center gap-1.5 text-muted-foreground text-xs"
		>
			{t("chart.less")}
			{HEAT_STEPS.map((step) => (
				<span key={step} className={cn("size-[14px] rounded-xs", step)} />
			))}
			{t("chart.more")}
		</div>
	);
}

type HeatSquareProps = {
	/** The value of the part. */
	value: number;
	/** The value of the largest part. It gets the darkest step. */
	max: number;
};

/** One step square of the breakdown list: the step of a part against the largest part. Screen readers skip it. */
export function HeatSquare({ value, max }: HeatSquareProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"size-[14px] shrink-0 rounded-xs",
				HEAT_STEPS[heatStep(value, max)],
			)}
		/>
	);
}
