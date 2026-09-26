/**
 * TanStack Query keys and options of the Android APK builds (WANDIT-194).
 * queryFn delegates to mobile-builds.services.ts and refreshes the credits
 * when a build ends. Read by the mobile body of publish-popover.tsx, by
 * android-build-card.tsx, and by mobile-builds.mutations.ts.
 */

import { queryOptions } from "@tanstack/react-query";
import {
	type ListMobileBuildsResponse,
	liveMobileBuildStatuses,
	type MobileBuildStatus,
} from "@wandit/contracts";

import { creditsKeys } from "@/features/credits";
import type { apiClient } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import { listMobileBuilds } from "./mobile-builds.services";

/** Keys of the mobile builds, under `appBuilderKeys.all`. One list per project. */
export const mobileBuildsKeys = {
	list: (projectId: string) =>
		[...appBuilderKeys.all, "mobile-builds", projectId] as const,
};

/**
 * The latest build and the five older builds of the popover history. The
 * list read asks for this count, and android-build-card.tsx shows no more.
 */
export const MOBILE_BUILDS_LIMIT = 6;

/** 10 s between two list reads while a build runs. An EAS build takes minutes. */
const MOBILE_BUILDS_POLL_MS = 10_000;

/** The statuses of a build that has not ended, from the contract. The card reads it too. */
export const LIVE_STATUSES: ReadonlySet<MobileBuildStatus> = new Set(
	liveMobileBuildStatuses,
);

/**
 * The poll delay for one list answer: 10 s while a build is `queued` or
 * `building`, no poll when every build ended or before the first answer.
 */
export function mobileBuildsPollMs(
	list: ListMobileBuildsResponse | undefined,
): number | false {
	// The server pushes no event when a build ends, so the list polls until it does.
	return list?.items.some((build) => LIVE_STATUSES.has(build.status))
		? MOBILE_BUILDS_POLL_MS
		: false;
}

/**
 * The newest builds of one project, newest first. The popover body mounts
 * it only while the popover is open, so the poll stops when it closes.
 * `get` is the test seam.
 */
export const mobileBuildsQuery = (
	projectId: string,
	get?: typeof apiClient.get,
) =>
	queryOptions({
		queryKey: mobileBuildsKeys.list(projectId),
		queryFn: async ({ client, queryKey }) => {
			const cached = client.getQueryData<ListMobileBuildsResponse>(queryKey);
			const list = await listMobileBuilds(projectId, MOBILE_BUILDS_LIMIT, get);
			// A build end settles or refunds its held credits. No other surface
			// refreshes the balance and the activity list then.
			const liveIds = new Set(
				cached?.items
					.filter((build) => LIVE_STATUSES.has(build.status))
					.map((build) => build.id),
			);
			const hasEndedBuild = list.items.some(
				(build) => liveIds.has(build.id) && !LIVE_STATUSES.has(build.status),
			);
			if (hasEndedBuild) {
				void client.invalidateQueries({ queryKey: creditsKeys.scope() });
			}
			return list;
		},
		refetchInterval: (query) => mobileBuildsPollMs(query.state.data),
	});
