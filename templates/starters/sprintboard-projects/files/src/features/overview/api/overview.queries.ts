// Reads of the home: the summary of one period, and the daily work series of the chart card.
// The /app loader prefetches the default period. The page reads the other periods after a choice in a Select.
// Each queryFn reads the sample tables. A later turn replaces its body with SQL read functions that return the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	buildDailySeries,
	getSampleTables,
	type PeriodDays,
} from "~/features/tracker";
import {
	buildSummary,
	type OverviewSummary,
	type WorkPoint,
} from "../lib/overview-data";

/** The period that the home opens with, in days. */
export const OVERVIEW_DEFAULT_DAYS: PeriodDays = 30;

/** The period that the work chart opens with: the longest one, as in the kit chart. */
export const WORK_CHART_DEFAULT_DAYS: PeriodDays = 90;

/** The summary of the last `days` days. The period is in the key, so each period has its own cache entry. */
export function overviewSummaryQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "summary", days],
		queryFn: async (): Promise<OverviewSummary> => {
			const tables = getSampleTables();
			return buildSummary(
				tables.tasks,
				tables.projects,
				tables.members,
				days,
				Date.now(),
			);
		},
	});
}

/** The tasks done per working day of the last `days` days, split in features and fixes (bugs and chores). */
export function workSeriesQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "work", days],
		queryFn: async (): Promise<WorkPoint[]> => {
			const now = Date.now();
			const done = getSampleTables().tasks.filter(
				(task) => task.completedAt !== null,
			);
			const timesOf = (isFeature: boolean) =>
				done.flatMap((task) =>
					(task.kind === "feature") === isFeature && task.completedAt
						? [task.completedAt]
						: [],
				);
			const features = buildDailySeries(timesOf(true), days, now);
			const fixes = buildDailySeries(timesOf(false), days, now);
			// Both series have the same working days, so the index matches.
			return features.map((point, index) => ({
				day: point.day,
				features: point.current,
				fixes: fixes[index]?.current ?? 0,
			}));
		},
	});
}
