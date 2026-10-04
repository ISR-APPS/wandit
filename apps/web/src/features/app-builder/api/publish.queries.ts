/**
 * TanStack Query key and options of the web app publish status (WANDIT-178).
 * queryFn delegates to publish.services.ts. Read by the web body of
 * publish-popover.tsx and written by publish.mutations.ts. The query polls
 * while a publish runs and refreshes the project when one ends.
 */

import { queryOptions } from "@tanstack/react-query";
import {
	type AppBuildStatus,
	type AppPublishStatus,
	liveAppBuildStatuses,
} from "@wandit/contracts";

import type { apiClient } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import { getAppPublishStatus } from "./publish.services";

/** Key of the publish status, under `appBuilderKeys.all`. One status per project. */
export const appPublishKeys = {
	status: (projectId: string) =>
		[...appBuilderKeys.all, "publish", projectId] as const,
};

/** 5 s between two reads while a publish runs. A build takes about one minute. */
const PUBLISH_POLL_MS = 5_000;

/** The statuses of a publish that has not ended, from the contract. The popover reads it too. */
export const LIVE_PUBLISH_STATUSES: ReadonlySet<AppBuildStatus> = new Set(
	liveAppBuildStatuses,
);

/** True while the newest attempt of `status` has not ended. */
export function isPublishRunning(
	status: AppPublishStatus | undefined,
): boolean {
	const latest = status?.latestBuild;
	return latest ? LIVE_PUBLISH_STATUSES.has(latest.status) : false;
}

/**
 * The publish status of one project. The publish popover body and the
 * Domains panel mount it, so the poll stops when both are closed. `get` is
 * the test seam.
 */
export const appPublishQuery = (
	projectId: string,
	get?: typeof apiClient.get,
) =>
	queryOptions({
		queryKey: appPublishKeys.status(projectId),
		queryFn: async ({ client, queryKey }) => {
			const cached = client.getQueryData<AppPublishStatus>(queryKey);
			const status = await getAppPublishStatus(projectId, get);
			// A publish that ends changes the live commit, so the "changes"
			// count of the project answer is stale. No other surface refreshes it.
			if (isPublishRunning(cached) && !isPublishRunning(status)) {
				void client.invalidateQueries({
					queryKey: appBuilderKeys.project(projectId),
				});
			}
			return status;
		},
		// The server pushes no event when a publish ends, so the status polls until it does.
		refetchInterval: (query) =>
			isPublishRunning(query.state.data) ? PUBLISH_POLL_MS : false,
	});
