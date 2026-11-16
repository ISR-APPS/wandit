// Reads of the Recent page: the feed of the last FEED_DAYS days, newest first.
// The /app/recent route prefetches it in its loader. RecentPage reads it with useSuspenseQuery.
// The queryFn reads the sample workspace now. A later turn replaces its body with one Supabase select.
import { queryOptions } from "@tanstack/react-query";
import {
	addLocalDays,
	buildActivity,
	readWorkspace,
} from "~/features/workspace";

/** The feed covers today and the 29 days before: the life of a file in the trash. */
export const FEED_DAYS = 30;

/** Every feed entry since the start of the first feed day. */
export function activityQueryOptions() {
	return queryOptions({
		queryKey: ["activity", "list", FEED_DAYS],
		queryFn: async () => {
			const now = Date.now();
			return buildActivity(
				readWorkspace(now),
				addLocalDays(now, -(FEED_DAYS - 1)),
			);
		},
	});
}
