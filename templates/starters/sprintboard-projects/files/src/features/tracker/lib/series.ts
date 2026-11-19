// The period choices, the one window rule of the app (periodOf), and the daily series of a chart.
// The overview queries, the board, and the Team page call them, so every figure of a period agrees.
import { calendarDaysFromNow, startOfLocalDay } from "./time";

/** The period choices of the Select controls, in days. The sample rows cover two periods of the longest one. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** One working day of a trend, oldest first in a list. Zero on a day with no event. */
export type DailyPoint = {
	/** YYYY-MM-DD in the browser time zone. Always Monday to Friday. */
	day: string;
	/** The count of that day. */
	current: number;
	/** The count of the working day at the same place in the working days before the period. */
	previous: number;
};

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
