// Shapes of the chart data and the pure functions that build them from rows.
// The overview queries build the daily series, the totals, and the breakdowns with these functions.
// periodOf is the one window rule of the app, so every figure and breakdown total of a period agree.
import { calendarDaysFromNow, startOfLocalDay } from "./time";

/** The period choices of the overview, in days. The sample rows cover two periods of the longest one. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The period that the overview opens with. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** The period of a value from a URL or a tab, or undefined when it is not a choice. */
export function parsePeriodDays(value: string): PeriodDays | undefined {
	return PERIOD_DAYS.find((days) => String(days) === value);
}

/** One working day of a trend, oldest first in a list. Zero on a day with no event. */
export type DailyPoint = {
	/** YYYY-MM-DD in the browser time zone. Always Monday to Friday. */
	day: string;
	/** The count of that day. */
	current: number;
	/** The count of the working day at the same place in the working days before the period. */
	previous: number;
};

/** One part of a breakdown. `label` is a project name or the code "other". */
export type BreakdownSlice = { id: string; label: string; value: number };

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/**
 * The window of `timestamp` (ISO) for a period of `days`: "current" for the last `days` full calendar days,
 * yesterday included and today excluded, "previous" for the `days` days before, and null for other times.
 * Every page that counts "the last N days" uses it, so one task never counts on one page and not on another.
 */
export function periodOf(
	timestamp: string,
	days: number,
	now: number,
): "current" | "previous" | null {
	const daysAgo = -calendarDaysFromNow(timestamp, now);
	// Today is not over, so a period of full days stops at yesterday.
	if (daysAgo < 1 || daysAgo > 2 * days) {
		return null;
	}
	return daysAgo <= days ? "current" : "previous";
}

// The local calendar day `daysAgo` days before the day of `now`, at midnight.
function localDay(now: number, daysAgo: number): Date {
	const date = new Date(startOfLocalDay(now));
	// setDate keeps the calendar day across a clock change. A subtraction of 24 hours does not.
	date.setDate(date.getDate() - daysAgo);
	return date;
}

// The day `daysAgo` days before the day of `now`, as YYYY-MM-DD.
function dayKey(now: number, daysAgo: number): string {
	const date = localDay(now, daysAgo);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

// Monday to Friday. The team does not work on Saturday (6) and Sunday (0).
function isWorkday(now: number, daysAgo: number): boolean {
	const weekday = localDay(now, daysAgo).getDay();
	return weekday !== 0 && weekday !== 6;
}

/**
 * The date of a `day` key (YYYY-MM-DD) of a DailyPoint, for an axis tick or a tooltip.
 * It is midnight UTC: format it with `timeZone: "UTC"` to keep the same calendar day.
 */
export function dayToDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

/**
 * Counts `timestamps` (ISO) per working day of the last `days` full days, up to yesterday, as periodOf does.
 * The weekends would drop every line to 0 two days in seven, so the series has only Monday to Friday.
 * `previous` counts the same number of working days just before the period, so both lines have the same points.
 * The totals of a period come from periodOf, not from this series. A SQL read function does the same math later.
 */
export function buildDailySeries(
	timestamps: string[],
	days: number,
	now: number,
): DailyPoint[] {
	const currentDays: number[] = [];
	for (let daysAgo = days; daysAgo >= 1; daysAgo -= 1) {
		if (isWorkday(now, daysAgo)) {
			currentDays.push(daysAgo);
		}
	}
	const previousDays: number[] = [];
	for (
		let daysAgo = days + 1;
		previousDays.length < currentDays.length;
		daysAgo += 1
	) {
		if (isWorkday(now, daysAgo)) {
			previousDays.unshift(daysAgo);
		}
	}
	const points: DailyPoint[] = currentDays.map((daysAgo) => ({
		day: dayKey(now, daysAgo),
		current: 0,
		previous: 0,
	}));
	const slotOf = new Map<
		number,
		{ line: "current" | "previous"; index: number }
	>();
	currentDays.forEach((daysAgo, index) => {
		slotOf.set(daysAgo, { line: "current", index });
	});
	previousDays.forEach((daysAgo, index) => {
		slotOf.set(daysAgo, { line: "previous", index });
	});
	const oldestDay = previousDays[0] ?? 0;
	for (const timestamp of timestamps) {
		let daysAgo = -calendarDaysFromNow(timestamp, now);
		// Today and the future have no point: the series ends yesterday.
		if (daysAgo < 1) {
			continue;
		}
		// A weekend event counts on the Friday before it.
		// LIMIT: the Friday before the first point is in the previous line. Upgrade: a weekend point when the team works weekends.
		while (daysAgo <= oldestDay && !slotOf.has(daysAgo)) {
			daysAgo += 1;
		}
		const slot = slotOf.get(daysAgo);
		const point = slot ? points[slot.index] : undefined;
		if (!slot || !point) {
			continue;
		}
		point[slot.line] += 1;
	}
	return points;
}

/** The count of `timestamps` (ISO) in the current and in the previous period of `days` days, and their change ratio. */
export function periodTotals(
	timestamps: string[],
	days: number,
	now: number,
): { current: number; previous: number; change: number | null } {
	const periods = timestamps.map((timestamp) => periodOf(timestamp, days, now));
	const current = periods.filter((period) => period === "current").length;
	const previous = periods.filter((period) => period === "previous").length;
	return { current, previous, change: changeRatio(current, previous) };
}
