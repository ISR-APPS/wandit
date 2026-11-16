// The figures and the trend of the home: the KPI items of the last 7 days and the check-ins per day.
// today.queries.ts calls the build functions. The figure and trend panels take the types.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import type { CheckIn, ClassSession, Member } from "~/features/gym";
import { addDays, DAY_MS, toDayKey } from "~/features/gym";
import type { TranslationKey } from "~/shared/i18n";

/** The period choices of the trend panel, in days. The sample keeps 182 days, enough for 90 and the 90 before. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The window of the figures, in days. The previous window has the same length, just before it. */
export const FIGURE_DAYS = 7;

/** One day of a trend. `day` is YYYY-MM-DD in the browser time zone. `previous` is the same day one period earlier. */
export type DailyPoint = { day: string; current: number; previous: number };

/** One KPI figure of the home, before translation. The home turns `labelKey` into a label with t(). */
export type KpiItem = {
	/** Stable id, also the React key and the key of WHOLE_WORDS. */
	id: string;
	labelKey: TranslationKey;
	value: number;
	/** Ratio against the previous window: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for no-shows and late items: a fall is good news. */
	goodWhen: "up" | "down";
	/** The whole of the value: a count of all, a capacity, or the value of the previous window. The meter reads it. */
	target?: number;
};

/** Change against the previous window, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/**
 * Check-ins per day for the last `days` days, today included, oldest first, with the same days one period earlier.
 * `checkIns` holds only the check-ins up to now, so today is the count so far.
 */
export function buildDailyCheckIns(
	checkIns: readonly CheckIn[],
	todayStart: number,
	days: number,
): DailyPoint[] {
	const countOf = new Map<string, number>();
	for (const checkIn of checkIns) {
		const key = toDayKey(checkIn.at);
		countOf.set(key, (countOf.get(key) ?? 0) + 1);
	}
	return Array.from({ length: days }, (_, index) => {
		const dayStart = addDays(todayStart, index - days + 1);
		return {
			day: toDayKey(dayStart),
			current: countOf.get(toDayKey(dayStart)) ?? 0,
			previous: countOf.get(toDayKey(addDays(dayStart, -days))) ?? 0,
		};
	});
}

// Whether `time` is in the window of FIGURE_DAYS days that ends `windowsBack` windows before now.
function isInWindow(time: number, now: number, windowsBack: number): boolean {
	const end = now - windowsBack * FIGURE_DAYS * DAY_MS;
	return time > end - FIGURE_DAYS * DAY_MS && time <= end;
}

/**
 * The 4 figures of the home, the most important first. Each window is the last 7 times 24 hours,
 * so today counts only up to now, and the previous window has the same length.
 */
export function buildWeekKpis(
	members: readonly Member[],
	sessions: readonly ClassSession[],
	checkIns: readonly CheckIn[],
	now: number,
): KpiItem[] {
	const checkInsNow = checkIns.filter((row) =>
		isInWindow(row.at, now, 0),
	).length;
	const checkInsBefore = checkIns.filter((row) =>
		isInWindow(row.at, now, 1),
	).length;
	// A session counts once it starts. A cancelled session has no spot to fill.
	const startedIn = (windowsBack: number) =>
		sessions.filter(
			(row) => !row.isCancelled && isInWindow(row.startsAt, now, windowsBack),
		);
	const spotsOf = (rows: ClassSession[]) =>
		rows.reduce((sum, row) => sum + row.bookedMemberIds.length, 0);
	const sessionsNow = startedIn(0);
	const bookedNow = spotsOf(sessionsNow);
	const capacityNow = sessionsNow.reduce((sum, row) => sum + row.capacity, 0);
	const newNow = members.filter((row) =>
		isInWindow(row.joinedAt, now, 0),
	).length;
	const newBefore = members.filter((row) =>
		isInWindow(row.joinedAt, now, 1),
	).length;

	return [
		{
			id: "check-ins",
			labelKey: "metrics.checkIns",
			value: checkInsNow,
			target: checkInsBefore,
			change: changeRatio(checkInsNow, checkInsBefore),
			goodWhen: "up",
		},
		{
			id: "spots-booked",
			labelKey: "metrics.spotsBooked",
			value: bookedNow,
			target: capacityNow,
			change: changeRatio(bookedNow, spotsOf(startedIn(1))),
			goodWhen: "up",
		},
		// The sample keeps no history of the status, so this count shows no delta.
		{
			id: "active-members",
			labelKey: "metrics.activeMembers",
			value: members.filter((row) => row.status === "active").length,
			target: members.length,
			change: null,
			goodWhen: "up",
		},
		{
			id: "new-members",
			labelKey: "metrics.newMembers",
			value: newNow,
			target: newBefore,
			change: changeRatio(newNow, newBefore),
			goodWhen: "up",
		},
	];
}
