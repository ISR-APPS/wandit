/**
 * TanStack Query keys and options of the Cloud panels of the More view
 * (WANDIT-188). queryFn delegates to cloud.services.ts. Every factory takes
 * `enabled` from the caller: the More view stays mounted while hidden, so
 * these queries must not fetch then. Read by the app-builder page,
 * components/cloud/*, and lib/use-builder-chat.ts (the refresh after a turn).
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
	CloudAuthUsersQuery,
	CloudBackendResponse,
	CloudLogsQuery,
	CloudRowsQuery,
} from "@wandit/contracts";

import { appBuilderKeys } from "./app-builder.queries";
import {
	getCloudBackend,
	listAuthUsers,
	listBuckets,
	listFunctions,
	listJobs,
	listObjects,
	listSecrets,
	listSignups,
	listTableRows,
	listTables,
	queryLogs,
} from "./cloud.services";

/**
 * Keys of the Cloud panels of the More view, under `appBuilderKeys.all`. `rows` sits under
 * `tables`, so one invalidation of `tables` refreshes the list and every
 * loaded page. `objects` sits under `buckets` the same way. `backend` is a
 * sibling: a table refresh never reads it again.
 */
export const cloudKeys = {
	all: (projectId: string) =>
		[...appBuilderKeys.all, "cloud", projectId] as const,
	backend: (projectId: string) =>
		[...cloudKeys.all(projectId), "backend"] as const,
	tables: (projectId: string) =>
		[...cloudKeys.all(projectId), "tables"] as const,
	rows: (projectId: string, table: string, query: CloudRowsQuery) =>
		[...cloudKeys.tables(projectId), table, query] as const,
	authUsers: (projectId: string, query: CloudAuthUsersQuery) =>
		[...cloudKeys.all(projectId), "authUsers", query] as const,
	signups: (projectId: string) =>
		[...cloudKeys.all(projectId), "signups"] as const,
	buckets: (projectId: string) =>
		[...cloudKeys.all(projectId), "buckets"] as const,
	/** Every loaded folder of one bucket. Upload and delete refresh them all. */
	bucketObjects: (projectId: string, bucket: string) =>
		[...cloudKeys.buckets(projectId), bucket] as const,
	objects: (projectId: string, bucket: string, prefix: string) =>
		[...cloudKeys.bucketObjects(projectId, bucket), prefix] as const,
	logs: (projectId: string, query: CloudLogsQuery) =>
		[...cloudKeys.all(projectId), "logs", query] as const,
	functions: (projectId: string) =>
		[...cloudKeys.all(projectId), "functions"] as const,
	jobs: (projectId: string) => [...cloudKeys.all(projectId), "jobs"] as const,
	secrets: (projectId: string) =>
		[...cloudKeys.all(projectId), "secrets"] as const,
};

/** 5 s between two backend reads while Supabase creates or wakes the project. Both take minutes. */
const CLOUD_BACKEND_POLL_MS = 5_000;

/**
 * The poll delay for one backend answer: 5 s while the status is
 * `creating` or `restoring`, no poll for any other status.
 */
export function cloudBackendPollMs(
	backend: CloudBackendResponse | undefined,
): number | false {
	// These two states end on their own within minutes, and the server pushes
	// no event when they end. The other states hold for hours or days.
	return backend?.status === "creating" || backend?.status === "restoring"
		? CLOUD_BACKEND_POLL_MS
		: false;
}

/**
 * The Supabase backend state of one project. The page reads it with
 * `enabled: true` for the preview boot screen. The Cloud panels of the
 * More view read it while the view is open.
 */
export const cloudBackendQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: cloudKeys.backend(projectId),
		queryFn: () => getCloudBackend(projectId),
		enabled,
		refetchInterval: (query) => cloudBackendPollMs(query.state.data),
	});

/**
 * The `public` tables with columns and row estimates. The caller passes
 * `enabled: false` unless the More view is open and the backend is `active`.
 */
// LIMIT: the API caches the table list for 30 s and a write does not clear it,
// so a new or dropped table can show up to 30 s late. Upgrade: CloudService.runSql
// clears tablesCache for the ref after a write.
export const cloudTablesQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: cloudKeys.tables(projectId),
		queryFn: () => listTables(projectId),
		enabled,
	});

/** One page of one table. null data means the table or the sort column is gone. */
export const cloudRowsQuery = (
	projectId: string,
	table: string,
	query: CloudRowsQuery,
	enabled: boolean,
) =>
	queryOptions({
		queryKey: cloudKeys.rows(projectId, table, query),
		queryFn: () => listTableRows(projectId, table, query),
		enabled,
	});

/** One page of the users of the app, newest first. */
export const cloudAuthUsersQuery = (
	projectId: string,
	query: CloudAuthUsersQuery,
	enabled: boolean,
) =>
	queryOptions({
		queryKey: cloudKeys.authUsers(projectId, query),
		queryFn: () => listAuthUsers(projectId, query),
		enabled,
	});

/** Sign-ups per day of the last 30 days, for the Users panel chart. */
export const cloudSignupsQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: cloudKeys.signups(projectId),
		queryFn: () => listSignups(projectId),
		enabled,
	});

/** The Storage buckets of the app. */
export const cloudBucketsQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: cloudKeys.buckets(projectId),
		queryFn: () => listBuckets(projectId),
		enabled,
	});

/**
 * The files and folders of one folder, page by page. A page holds at most
 * `CLOUD_OBJECTS_PAGE_SIZE` items; `fetchNextPage` reads the next one.
 */
export const cloudObjectsQuery = (
	projectId: string,
	bucket: string,
	prefix: string,
	enabled: boolean,
) =>
	infiniteQueryOptions({
		queryKey: cloudKeys.objects(projectId, bucket, prefix),
		queryFn: ({ pageParam }) =>
			listObjects(projectId, bucket, { prefix, cursor: pageParam }),
		// The cursor is the offset as decimal text, so "0" is the first page.
		initialPageParam: "0",
		// null means the last page, and TanStack then stops.
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		enabled,
	});

/** The log lines of one source, level, search, and 24-hour window. The panel never polls it. */
export const cloudLogsQuery = (
	projectId: string,
	query: CloudLogsQuery,
	enabled: boolean,
) =>
	queryOptions({
		queryKey: cloudKeys.logs(projectId, query),
		queryFn: () => queryLogs(projectId, query),
		enabled,
	});

/** The Edge Functions of the app. The API caches the answer for 30 s. */
export const cloudFunctionsQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: cloudKeys.functions(projectId),
		queryFn: () => listFunctions(projectId),
		enabled,
	});

/** The pg_cron jobs of the app with their last runs. */
export const cloudJobsQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: cloudKeys.jobs(projectId),
		queryFn: () => listJobs(projectId),
		enabled,
	});

/** The secret names of the project. No answer carries a value. */
export const cloudSecretsQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: cloudKeys.secrets(projectId),
		queryFn: () => listSecrets(projectId),
		enabled,
	});
