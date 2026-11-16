// The day groups and the side lists of the Recent page, from the feed entries.
// RecentPage calls these pure functions during render.
import {
	type ActivityItem,
	addLocalDays,
	localDayKey,
} from "~/features/workspace";

/** The entries of one local day, newest first. */
export type FeedDay = {
	/** Local day as YYYY-MM-DD. */
	day: string;
	items: ActivityItem[];
};

/** The entries of the last `days` days, grouped by local day, newest day first. Days with no entry are left out. */
export function groupByDay(
	items: ActivityItem[],
	days: number,
	now: number,
): FeedDay[] {
	const startMs = addLocalDays(now, -(days - 1));
	const groups = new Map<string, ActivityItem[]>();
	for (const item of items) {
		const atMs = Date.parse(item.at);
		if (atMs < startMs) {
			continue;
		}
		const day = localDayKey(atMs);
		const dayItems = groups.get(day) ?? [];
		dayItems.push(item);
		groups.set(day, dayItems);
	}
	return [...groups].map(([day, dayItems]) => ({ day, items: dayItems }));
}

/** One row of a "most" list: a name and its count of entries. */
export type RankRow = { key: string; name: string; count: number };

/** The `limit` names with the most entries since `sinceMs`, the most first. Ties keep the newest first. */
export function rankBy(
	items: ActivityItem[],
	sinceMs: number,
	keyOf: (item: ActivityItem) => { key: string; name: string },
	limit: number,
): RankRow[] {
	const rows = new Map<string, RankRow>();
	for (const item of items) {
		if (Date.parse(item.at) < sinceMs) {
			continue;
		}
		const { key, name } = keyOf(item);
		const row = rows.get(key) ?? { key, name, count: 0 };
		row.count += 1;
		rows.set(key, row);
	}
	return [...rows.values()]
		.sort((first, second) => second.count - first.count)
		.slice(0, limit);
}
