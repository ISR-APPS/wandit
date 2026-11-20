/**
 * Pure streak math of build weeks. A build week is an ISO week (Monday to Sunday, UTC) with one settled build or more.
 * TrophiesService calls it with the week starts that TrophiesRepository reads. It calls nothing.
 */
import { TROPHY_RECENT_BUILD_WEEKS } from "@wandit/contracts";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Streaks of build weeks, in whole weeks. The trophies response sends it as `buildWeeks`. */
export type BuildWeekStreaks = {
	/** Weeks in a row up to this week, or up to last week when this week has no build yet. */
	currentStreak: number;
	/** Longest run of weeks in a row in the input. */
	bestStreak: number;
	/** One item per week, oldest first. The last item is this week. True when the week has a build. */
	recent: boolean[];
};

/** Start of the ISO week of `now` in UTC (Monday 00:00), in epoch milliseconds. */
function utcWeekStartMs(now: Date): number {
	const dayStartMs = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
	);
	// getUTCDay gives 0 for Sunday. The ISO week starts on Monday, so Sunday is 6 days after it.
	const daysSinceMonday = (now.getUTCDay() + 6) % 7;
	return dayStartMs - daysSinceMonday * DAY_MS;
}

/**
 * Computes the streaks from the Monday of each build week.
 * `weekStarts` holds `YYYY-MM-DD` dates (UTC Mondays), in any order. A repeated date counts one time.
 */
export function buildWeekStreaks(
	weekStarts: readonly string[],
	now: Date,
): BuildWeekStreaks {
	const thisWeekMs = utcWeekStartMs(now);
	// Offset 0 is this week, -1 is last week. Each Monday is a whole number of weeks from this Monday.
	const offsets = new Set(
		weekStarts.map((weekStart) =>
			Math.round(
				(Date.parse(`${weekStart}T00:00:00.000Z`) - thisWeekMs) / WEEK_MS,
			),
		),
	);

	// A week with no build yet does not break the streak until the week ends.
	const firstOffset = offsets.has(0) ? 0 : -1;
	let currentStreak = 0;
	while (offsets.has(firstOffset - currentStreak)) {
		currentStreak += 1;
	}

	let bestStreak = 0;
	let run = 0;
	let previousOffset: number | null = null;
	for (const offset of [...offsets].sort((left, right) => left - right)) {
		run =
			previousOffset !== null && offset === previousOffset + 1 ? run + 1 : 1;
		bestStreak = Math.max(bestStreak, run);
		previousOffset = offset;
	}

	const recent = Array.from({ length: TROPHY_RECENT_BUILD_WEEKS }, (_, index) =>
		offsets.has(index - (TROPHY_RECENT_BUILD_WEEKS - 1)),
	);

	return { bestStreak, currentStreak, recent };
}
