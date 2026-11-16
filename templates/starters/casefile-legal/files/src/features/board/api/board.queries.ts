// Reads of the board home: the matters closed per day, and the four figures of the strip.
// The /app route prefetches them in its loader, with the matter list. BoardPage reads them with useSuspenseQuery.
// The queryFn returns sample rows today. A later turn replaces its body with a Supabase call (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables } from "~/features/practice";
import { buildBoardFigures, closedPerDay } from "../lib/board";

/** Matters closed per day for the last `days` days, with the same days one period earlier. Feeds the mini chart. */
export function closedPerDayQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["matters", "closed-per-day", days],
		queryFn: async () => {
			const now = Date.now();
			return closedPerDay(getSampleTables(now), days, now);
		},
	});
}

/** The four figures of the board strip. Each one compares with the 30 days before. */
export function boardFiguresQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "figures"],
		queryFn: async () => {
			const now = Date.now();
			return buildBoardFigures(getSampleTables(now), now);
		},
	});
}
