// Reads of events: the catalog with the totals of a period, the detail of one event, and the newest single events.
// The loader of the Events route prefetches them. The cards of EventsPage read them again when the period or the event changes.
// Each queryFn reads the sample tables. A later turn replaces its body with a SQL read function over an `events` table.
import { queryOptions } from "@tanstack/react-query";
import {
	changeRatio,
	type DailyPoint,
	EVENT_TYPES,
	type EventKey,
	eventIndexOf,
	getSampleTables,
	latestEventsBefore,
	type PeriodDays,
	type PeriodTotals,
	PLATFORMS,
	type Platform,
	type ProductArea,
	periodIndexOf,
	shareOf,
	sumPeriod,
	toDailyPoints,
	wholeShares,
} from "~/features/tracking";

/** How many single events the stream card lists. */
export const STREAM_SIZE = 100;

/** The event of the detail card on the first load: the event that marks an activated person. */
export const DEFAULT_EVENT: EventKey = "task_completed";

/** How many accounts the detail of an event ranks. */
const TOP_ACCOUNTS = 5;

/** One tracked event with its totals of a period. `id` is the event name, so DataTable can key the row. */
export type CatalogEvent = {
	id: EventKey;
	area: ProductArea;
	/** How many times the event happened in the period. */
	volume: number;
	/** Ratio of `volume` against the period before. null when that period had none. */
	change: number | null;
	/** The people that did the event one time or more in the period. */
	people: number;
	/** `volume` per day, oldest first: the small trend of the row. */
	trend: number[];
};

/** The catalog of a period: every event, and the totals of the summary strip. */
export type EventCatalog = {
	/** Every tracked event, the largest volume first. */
	events: CatalogEvent[];
	/** All events of the period, and of the period before. It is the sum of the rows. */
	volume: PeriodTotals;
	/** The people with one event or more in the period. */
	activePeople: number;
	/** The day with the most events. null when the period has no event. */
	busiestDay: { day: string; volume: number } | null;
};

/** One event in depth: its daily volume, the accounts that send it most, and its platforms. */
export type EventDetail = {
	points: DailyPoint[];
	/** The accounts with the most events of this type in the period, the largest first. */
	topAccounts: { id: string; name: string; volume: number; share: number }[];
	/** The volume per platform, in the order of PLATFORMS. `share` is over the volume of the period, in whole percents that add up to 1. */
	platforms: { platform: Platform; volume: number; share: number }[];
};

/** One single event of the stream. The time is an ISO text before now. */
export type StreamEvent = {
	id: string;
	occurredAt: string;
	eventKey: EventKey;
	personName: string;
	accountId: string;
	accountName: string;
	platform: Platform;
};

/** Every tracked event with its totals of the last `days` complete days, and the totals of all events. */
export function eventCatalogQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["events", "catalog", days],
		queryFn: async (): Promise<EventCatalog> => {
			const tables = getSampleTables();
			const { usage } = tables;
			const period = periodIndexOf(days);
			const events = EVENT_TYPES.map((type, eventIndex): CatalogEvent => {
				const dayTable = usage.eventCounts[eventIndex] ?? [];
				const volume = sumPeriod(dayTable, days);
				return {
					id: type.key,
					area: type.area,
					volume: volume.current,
					change: changeRatio(volume.current, volume.previous),
					people: usage.eventPeople[eventIndex]?.[period] ?? 0,
					trend: toDailyPoints(dayTable, days, tables.todayStart).map(
						(point) => point.current,
					),
				};
			}).sort((first, second) => second.volume - first.volume);

			// The total of each day over all events, to find the busiest day.
			const allEvents = toDailyPoints(
				usage.eventCounts.reduce<number[]>(
					(total, dayTable) =>
						dayTable.map((count, daysAgo) => count + (total[daysAgo] ?? 0)),
					[],
				),
				days,
				tables.todayStart,
			);
			const busiest = allEvents.reduce<DailyPoint | null>(
				(best, point) => (point.current > (best?.current ?? 0) ? point : best),
				null,
			);
			return {
				events,
				volume: {
					current: allEvents.reduce((sum, point) => sum + point.current, 0),
					previous: allEvents.reduce((sum, point) => sum + point.previous, 0),
				},
				activePeople: usage.uniquePeople[period]?.current ?? 0,
				busiestDay: busiest
					? { day: busiest.day, volume: busiest.current }
					: null,
			};
		},
	});
}

/** The daily volume, the top accounts, and the platforms of one event for the last `days` complete days. */
export function eventDetailQueryOptions(eventKey: EventKey, days: PeriodDays) {
	return queryOptions({
		queryKey: ["events", "detail", eventKey, days],
		queryFn: async (): Promise<EventDetail> => {
			const tables = getSampleTables();
			const eventIndex = eventIndexOf(eventKey);
			const period = periodIndexOf(days);
			const dayTable = tables.usage.eventCounts[eventIndex] ?? [];
			const volume = sumPeriod(dayTable, days).current;
			const platformVolumes = PLATFORMS.map(
				(_, platformIndex) =>
					tables.usage.eventPlatformCounts[eventIndex]?.[platformIndex]?.[
						period
					] ?? 0,
			);
			const platformShares = wholeShares(platformVolumes);
			return {
				points: toDailyPoints(dayTable, days, tables.todayStart),
				topAccounts: tables.accounts
					.map((account, accountIndex) => {
						const count =
							tables.accountUsage[accountIndex]?.eventCounts[eventIndex]?.[
								period
							] ?? 0;
						return {
							id: account.id,
							name: account.name,
							volume: count,
							share: shareOf(count, volume),
						};
					})
					.filter((account) => account.volume > 0)
					.sort((first, second) => second.volume - first.volume)
					.slice(0, TOP_ACCOUNTS),
				platforms: PLATFORMS.map((platform, platformIndex) => ({
					platform,
					volume: platformVolumes[platformIndex] ?? 0,
					share: platformShares[platformIndex] ?? 0,
				})),
			};
		},
	});
}

/** The newest STREAM_SIZE single events before now, newest first. */
export function eventStreamQueryOptions() {
	return queryOptions({
		queryKey: ["events", "stream"],
		queryFn: async (): Promise<StreamEvent[]> => {
			const tables = getSampleTables();
			const accountsById = new Map(
				tables.accounts.map((account) => [account.id, account]),
			);
			// LIMIT: the newest 100 events only. Upgrade: server paging over the events table (tables-paging.md of the app-dashboard skill).
			return latestEventsBefore(tables, Date.now(), STREAM_SIZE).flatMap(
				(event, place) => {
					const person = tables.people[event.personIndex];
					const type = EVENT_TYPES[event.eventIndex];
					const account = accountsById.get(person?.accountId ?? "");
					if (!person || !type || !account) {
						return [];
					}
					return {
						id: `${event.at}-${event.personIndex}-${place}`,
						occurredAt: new Date(event.at).toISOString(),
						eventKey: type.key,
						personName: person.name,
						accountId: account.id,
						accountName: account.name,
						platform: person.platform,
					};
				},
			);
		},
	});
}
