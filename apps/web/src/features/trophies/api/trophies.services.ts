/**
 * HTTP calls of the trophies feature. The queries and mutations of this feature call them.
 * They call the routes of `trophiesRoutes`. Both routes read the session user and ignore the workspace.
 */
import {
	type MarkTrophiesSeenBody,
	type TrophiesResponse,
	trophiesResponseSchema,
	trophiesRoutes,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";

/** Loads the points, the level, the build weeks, and every trophy of the user. The API stores new unlocks on this read. */
export async function getTrophies(): Promise<TrophiesResponse> {
	const data = await ApiService.get<unknown>(trophiesRoutes.list);
	return trophiesResponseSchema.parse(data);
}

/** Marks trophies as seen, so their unlock toast does not show again. The API answers 204. */
export async function markTrophiesSeen(
	body: MarkTrophiesSeenBody,
): Promise<void> {
	await ApiService.post(trophiesRoutes.seen, body);
}
