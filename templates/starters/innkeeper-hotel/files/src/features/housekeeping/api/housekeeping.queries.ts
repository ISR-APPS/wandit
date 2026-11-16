// Reads of housekeeping: the tasks of today with their room and their attendant.
// The /app/housekeeping route prefetches it in its loader. The page reads it with useSuspenseQuery.
// The queryFn returns sample rows of ~/features/hotel. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import { listHousekeepingTasks, listRooms } from "~/features/hotel";
import { buildTaskRows } from "../lib/task-board";

/** 30 s. A task changes its status during the shift. */
const LIVE_REFETCH_MS = 30_000;

/** Every task of today, in the order of the rooms. It refetches every 30 s. */
export function housekeepingTasksQueryOptions() {
	return queryOptions({
		queryKey: ["housekeeping", "tasks"],
		queryFn: async () => {
			const now = Date.now();
			return buildTaskRows(listHousekeepingTasks(now), listRooms(now));
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
