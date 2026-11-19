// Shapes and math of the figures and charts: daily points, period choices, bar corners, and the change ratio.
// The dashboard and billing lib files build their series with buildDailySeries.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import type { AppThemeFile } from "~/styles/theme";
import { addLocalDays, dayKeyOf, startOfLocalDay } from "./time";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
export const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** The period choices of a trend panel, in days. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** One day of a trend. `day` is YYYY-MM-DD in the browser time zone. `previous` is the same day one period earlier. */
export type DailyPoint = { day: string; current: number; previous: number };

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/**
 * The last `days` local days up to today, oldest first, each with the value of the same day one period earlier.
 * `valueByDay` maps a YYYY-MM-DD key to the total of that day. A day with no key gives 0.
 */
export function buildDailySeries(
	days: number,
	now: number,
	valueByDay: Map<string, number>,
): DailyPoint[] {
	const today = startOfLocalDay(now);
	return Array.from({ length: days }, (_, index) => {
		const offset = days - 1 - index;
		return {
			day: dayKeyOf(addLocalDays(today, -offset)),
			current: valueByDay.get(dayKeyOf(addLocalDays(today, -offset))) ?? 0,
			previous:
				valueByDay.get(dayKeyOf(addLocalDays(today, -offset - days))) ?? 0,
		};
	});
}
