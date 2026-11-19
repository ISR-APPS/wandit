// Reads of the event log: the newest single events of today and of yesterday, for all areas or one area.
// The loader of the Events route prefetches "all". EventsPage reads another area when the user picks it.
// The queryFn reads the sample tables. A later turn replaces its body with a SQL read over an `events` table.
import { queryOptions } from "@tanstack/react-query";
import {
	EVENT_TYPES,
	type EventKey,
	type FeatureArea,
	getSampleTables,
	type Platform,
	type ProductArea,
} from "~/features/tracking";

/** How many events each tab of the log lists. */
export const LOG_SIZE = 12;

/** The area filter of the log: one feature area, or every event. */
export type AreaFilter = FeatureArea | "all";

/** One single event of the log. The time is an ISO text before now. */
export type LoggedEvent = {
	id: string;
	occurredAt: string;
	eventKey: EventKey;
	area: ProductArea;
	personName: string;
	accountId: string;
	accountName: string;
	platform: Platform;
};

/** The newest events of today (before now) and of yesterday, each list newest first. */
export type EventLog = {
	today: LoggedEvent[];
	yesterday: LoggedEvent[];
};

/** The LOG_SIZE newest events of today and of yesterday in `area`, newest first. */
export function eventLogQueryOptions(area: AreaFilter) {
	return queryOptions({
		queryKey: ["events", "log", area],
		queryFn: async (): Promise<EventLog> => {
			const tables = getSampleTables();
			const now = Date.now();
			const accountsById = new Map(
				tables.accounts.map((account) => [account.id, account]),
			);
			const log: EventLog = { today: [], yesterday: [] };
			// LIMIT: the newest 12 events of each day only. Upgrade: server paging over the events table (tables-paging.md of the app-dashboard skill).
			for (const event of tables.recentEvents) {
				// The list is newest first. Events after now are the rest of today: the product did not send them yet.
				if (event.at > now) {
					continue;
				}
				const day = event.at >= tables.todayStart ? log.today : log.yesterday;
				const type = EVENT_TYPES[event.eventIndex];
				const person = tables.people[event.personIndex];
				const account = accountsById.get(person?.accountId ?? "");
				if (
					day.length === LOG_SIZE ||
					!type ||
					!person ||
					!account ||
					(area !== "all" && type.area !== area)
				) {
					continue;
				}
				day.push({
					id: `${event.at}-${event.personIndex}-${event.eventIndex}`,
					occurredAt: new Date(event.at).toISOString(),
					eventKey: type.key,
					area: type.area,
					personName: person.name,
					accountId: account.id,
					accountName: account.name,
					platform: person.platform,
				});
				if (log.yesterday.length === LOG_SIZE) {
					break;
				}
			}
			return log;
		},
	});
}
