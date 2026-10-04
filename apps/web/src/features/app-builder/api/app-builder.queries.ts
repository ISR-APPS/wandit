/**
 * TanStack Query options and keys of the app builder. queryFn delegates to
 * app-builder.services.ts. The route loader calls `ensureQueryData` with the
 * same options, so components read with `useSuspenseQuery` and never see a
 * loading state for the project.
 */

import { queryOptions } from "@tanstack/react-query";

import type { apiClient } from "@/lib/api-client";

import {
	getAppProject,
	getCodeFile,
	getCodeSnapshot,
	getCostCaps,
	getTurnEstimate,
	getVersionDiff,
	listVersions,
} from "./app-builder.services";
import type { CodeSnapshot } from "./dto";

/** Query keys of the app builder. Every key starts with `app-builder`, so one prefix matches them all. */
export const appBuilderKeys = {
	all: ["app-builder"] as const,
	project: (projectId: string) =>
		[...appBuilderKeys.all, "project", projectId] as const,
	turnEstimate: (projectId: string) =>
		[...appBuilderKeys.all, "turn-estimate", projectId] as const,
	code: (projectId: string) =>
		[...appBuilderKeys.all, "code", projectId] as const,
	codeFile: (projectId: string, path: string) =>
		[...appBuilderKeys.all, "code", projectId, path] as const,
	costCaps: (projectId: string) =>
		[...appBuilderKeys.all, "cost-caps", projectId] as const,
	versions: (projectId: string) =>
		[...appBuilderKeys.all, "versions", projectId] as const,
	// A sibling of `versions`, not a child: a list refresh must not refetch the immutable diffs.
	versionDiff: (projectId: string, sha: string) =>
		[...appBuilderKeys.all, "version-diff", projectId, sha] as const,
};

/** null data means the project does not exist. */
export const appProjectQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.project(projectId),
		queryFn: () => getAppProject(projectId),
	});

/** The cost of the next turn, before send. A turn end changes it, so use-builder-chat.ts marks it stale. */
export const turnEstimateQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.turnEstimate(projectId),
		queryFn: () => getTurnEstimate(projectId),
	});

/**
 * null data means the sandbox is asleep; the Code view waits for a turn.
 * The answer also puts each prefetched file into its `codeFile` entry, so
 * a click on that file shows it with no request. `get` is the test seam.
 */
export const codeSnapshotQuery = (
	projectId: string,
	get?: typeof apiClient.get,
) =>
	queryOptions({
		queryKey: appBuilderKeys.code(projectId),
		// The signal matters: a turn end cancels a running fetch, and an old
		// answer that still arrived would write old text over new text.
		queryFn: async ({ client, signal }) => {
			const answer = await getCodeSnapshot(projectId, signal, get);
			if (answer === null) return null;
			for (const file of answer.files) {
				const queryKey = appBuilderKeys.codeFile(projectId, file.path);
				// setQueryData alone builds the entry with the default 5 min
				// gcTime; an unopened prefetched file must stay for 30 min.
				client
					.getQueryCache()
					.build(client, { queryKey, gcTime: CODE_FILE_GC_TIME_MS });
				client.setQueryData(queryKey, file);
			}
			return answer.snapshot;
		},
	});

/** 30 min. The prefetched files must stay in the cache for a long session. */
const CODE_FILE_GC_TIME_MS = 30 * 60 * 1000;

/** 3 s. A new sandbox boots from the template snapshot in about 4 s. */
const CODE_SETUP_POLL_MS = 3_000;

/**
 * The poll delay of the code snapshot. It polls only while a turn runs and
 * no sandbox answered yet, so the files show before the turn ends.
 */
export function codeSnapshotPollMs(
	snapshot: CodeSnapshot | null | undefined,
	isTurnRunning: boolean,
): number | false {
	// The server pushes no event when the sandbox starts, so the view asks.
	return isTurnRunning && snapshot === null ? CODE_SETUP_POLL_MS : false;
}

/**
 * One file of the sandbox. Its key is a child of `code(projectId)`, so one
 * invalidation of that key refetches the tree and the open file.
 */
export const codeFileQuery = (projectId: string, path: string) =>
	queryOptions({
		queryKey: appBuilderKeys.codeFile(projectId, path),
		queryFn: ({ signal }) => getCodeFile(projectId, path, signal),
		// Only a turn end or a restore changes a file, and both invalidate
		// the `code(projectId)` prefix. Until then the cached text is right.
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: CODE_FILE_GC_TIME_MS,
	});

/**
 * The spending limits of a project, in centi-credits. Settings reads it only
 * for a workspace owner or admin: the API refuses a member with 403.
 */
export const projectCostCapsQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.costCaps(projectId),
		queryFn: () => getCostCaps(projectId),
	});

/** The version list of a project: `items` newest first. */
export const appVersionsQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.versions(projectId),
		queryFn: () => listVersions(projectId),
	});

/** The stored `git show` patch of one commit. */
export const versionDiffQuery = (projectId: string, sha: string) =>
	queryOptions({
		queryKey: appBuilderKeys.versionDiff(projectId, sha),
		queryFn: () => getVersionDiff(projectId, sha),
		// A commit's patch never changes, so the answer stays fresh forever.
		staleTime: Number.POSITIVE_INFINITY,
	});
