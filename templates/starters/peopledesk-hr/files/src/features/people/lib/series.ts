// The period of the home and the pure functions of its figures: the period choices, the change ratio, and the day keys.
// The dashboard query builds the KPI deltas with them. The period select of the home header reads PERIOD_DAYS.
// A period is the `days` full days before today: today is not over, so it never counts.
import { shiftDays, toDayKey } from "./time";

/** The period choices of the home header, in days: a week, a month, a quarter. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period of the home, in days. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** The day keys of the last `days` full days, oldest first. The last one is yesterday. */
export function periodDayKeys(days: number, dayStart: number): string[] {
	return Array.from({ length: days }, (_, index) =>
		toDayKey(shiftDays(dayStart, index - days)),
	);
}
