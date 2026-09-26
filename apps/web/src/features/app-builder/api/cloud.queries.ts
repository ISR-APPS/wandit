/**
 * TanStack Query keys and options of the Cloud tab (WANDIT-188). queryFn
 * delegates to cloud.services.ts. Every factory takes `enabled` from the
 * caller: the Cloud tab stays mounted while hidden, so its queries must not
 * fetch then. Read by the app-builder page, components/cloud/*, and
 * lib/use-builder-chat.ts (the refresh after a turn).
 */

import { queryOptions } from "@tanstack/react-query";
import type { CloudBackendResponse, CloudRowsQuery } from "@wandit/contracts";

import { appBuilderKeys } from "./app-builder.queries";
import { getCloudBackend, listTableRows, listTables } from "./cloud.services";

/**
 * Keys of the Cloud tab, under `appBuilderKeys.all`. `rows` sits under
 * `tables`, so one invalidation of `tables` refreshes the list and every
 * loaded page. `backend` is a sibling: a table refresh never reads it again.
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
 * `enabled: true` for the preview boot screen. The Cloud tab reads it
 * while it is open.
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
 * `enabled: false` unless the tab is open and the backend is `active`.
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
