// Reads of the home page: the live room board, the 2 KPI figures, the check-ins per day, and the check-ins per channel.
// The loader of the /app route prefetches them. FrontDeskPage reads them from the cache.
// Each queryFn returns sample rows of ~/features/hotel. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	listGuests,
	listHousekeepingTasks,
	listReservations,
	listRooms,
} from "~/features/hotel";
import { buildRoomBoard } from "../lib/room-board";
import {
	buildChannelBreakdown,
	buildDailyCheckIns,
	buildFrontDeskKpis,
} from "../lib/series";

/** 30 s. A room changes its status during the day: a check-in, a check-out, a clean room. */
const LIVE_REFETCH_MS = 30_000;

/** The 18 rooms with their live status, in the order of the door numbers. It refetches every 30 s. */
export function roomBoardQueryOptions() {
	return queryOptions({
		queryKey: ["rooms", "board"],
		queryFn: async () => {
			const now = Date.now();
			return buildRoomBoard(
				listRooms(now),
				listReservations(now),
				listGuests(now),
				listHousekeepingTasks(now),
				now,
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** The KPI rows of the home: rooms sold tonight and check-ins done today. It refetches every 30 s. The key has no period. */
export function frontDeskKpisQueryOptions() {
	return queryOptions({
		queryKey: ["front-desk", "kpis"],
		queryFn: async () => {
			const now = Date.now();
			return buildFrontDeskKpis(listRooms(now), listReservations(now), now);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** Check-ins per day for the last `days` days, with the same days one period earlier. Feeds the heat calendar. */
export function dailyCheckInsQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["check-ins", "daily", days],
		queryFn: async () => {
			const now = Date.now();
			return buildDailyCheckIns(listReservations(now), days, now);
		},
	});
}

/** Check-ins per booking channel for the last 14 days and today, the largest first. Feeds the breakdown of the check-ins panel. */
export function checkInsByChannelQueryOptions() {
	return queryOptions({
		queryKey: ["check-ins", "by-channel"],
		queryFn: async () => buildChannelBreakdown(listReservations(Date.now())),
	});
}
