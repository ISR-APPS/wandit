// Shapes and math of the chart and figure data: the period choices, daily points, and the change ratio.
// The query files of the home and the item list build their series and deltas with these functions.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import type { MovementRow } from "./sample-data";
import { addLocalDays, dayKeyOf } from "./time";

/** The period choices of a trend card, in days. The history holds 180 days, so 90 days still has a previous period. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** One day of a trend. `day` is YYYY-MM-DD in the browser time zone. `previous` is the same day one period earlier. */
export type DailyPoint = {
	day: string;
	current: number;
	previous: number;
};

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/**
 * Units picked per day for the `days` full days before today, oldest first, with the same days one period earlier.
 * Today is not in the series: the tables hold no event of today. A day with no pick is 0.
 */
export function buildDailyPicks(
	movements: MovementRow[],
	todayStart: number,
	days: number,
): DailyPoint[] {
	const unitsByDay = new Map<string, number>();
	for (const movement of movements) {
		if (movement.reason !== "pick") {
			continue;
		}
		const day = dayKeyOf(Date.parse(movement.occurredAt));
		// A pick is a negative movement. The chart shows the units that left the shelf.
		unitsByDay.set(day, (unitsByDay.get(day) ?? 0) - movement.quantity);
	}
	return Array.from({ length: days }, (_, index) => {
		const offset = index - days;
		const day = dayKeyOf(addLocalDays(todayStart, offset));
		const previousDay = dayKeyOf(addLocalDays(todayStart, offset - days));
		return {
			day,
			current: unitsByDay.get(day) ?? 0,
			previous: unitsByDay.get(previousDay) ?? 0,
		};
	});
}
