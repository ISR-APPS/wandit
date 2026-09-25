/**
 * Data layer of the Cloud tab (WANDIT-188). Each function calls one route
 * under `/api/v2/projects/:id/cloud/*` through `@/lib/api-client` and parses
 * the answer with its schema from `packages/contracts/src/v2/cloud.ts`.
 * Called by cloud.queries.ts and cloud.mutations.ts. The last parameter of
 * each function is the client method, so a spec injects a fake.
 */

import {
	type CloudBackendResponse,
	type CloudRowsQuery,
	type CloudRowsResponse,
	type CloudSqlBody,
	type CloudSqlResponse,
	type CloudTable,
	cloudBackendResponseSchema,
	cloudRoutes,
	cloudRowsResponseSchema,
	cloudSqlResponseSchema,
	cloudTablesResponseSchema,
} from "@wandit/contracts";

import { apiClient, isApiClientError } from "@/lib/api-client";

/**
 * `GET cloud/backend` answers the state of the Supabase backend; `none`
 * when the project has no backend row. The preview boot screen and the
 * Cloud tab both read it.
 */
export async function getCloudBackend(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudBackendResponse> {
	const data = await get<unknown>(cloudRoutes.backend(projectId));
	return cloudBackendResponseSchema.parse(data);
}

/**
 * `POST cloud/backend` creates the backend and answers `creating`. The
 * server does nothing when a row exists, and answers that row as it is.
 */
export async function enableBackend(
	projectId: string,
	post: typeof apiClient.post = apiClient.post,
): Promise<CloudBackendResponse> {
	const data = await post<unknown>(cloudRoutes.backend(projectId));
	return cloudBackendResponseSchema.parse(data);
}

/**
 * `POST cloud/backend/restore` wakes a paused backend and answers `restoring`.
 * Another state with a ref answers as it is; no ref answers 409 BACKEND_NOT_READY.
 */
export async function restoreBackend(
	projectId: string,
	post: typeof apiClient.post = apiClient.post,
): Promise<CloudBackendResponse> {
	const data = await post<unknown>(cloudRoutes.restoreBackend(projectId));
	return cloudBackendResponseSchema.parse(data);
}

/**
 * `GET cloud/tables` answers the `public` tables by name, with columns and
 * estimated row counts. A backend that is not `active` answers 409.
 */
export async function listTables(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudTable[]> {
	const data = await get<unknown>(cloudRoutes.tables(projectId));
	return cloudTablesResponseSchema.parse(data).tables;
}

/**
 * `GET cloud/tables/:table/rows` answers one page and the exact row count.
 * null means the table or the sort column no longer exists: a turn ran a
 * migration after the table list loaded. Every other failure propagates.
 */
export async function listTableRows(
	projectId: string,
	table: string,
	query: CloudRowsQuery,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudRowsResponse | null> {
	try {
		const data = await get<unknown>(cloudRoutes.rows(projectId, table), {
			query,
		});
		return cloudRowsResponseSchema.parse(data);
	} catch (error) {
		// The API answers a missing table or column with 400, not 404.
		if (isApiClientError(error) && error.code === "INVALID_IDENTIFIER") {
			return null;
		}
		throw error;
	}
}

/**
 * `POST cloud/sql` runs one console statement. A write without
 * `confirmWrite: true` fails with 409 `WRITE_NEEDS_CONFIRM`; the SQL
 * editor opens its confirm dialog on that code.
 */
export async function runSql(
	projectId: string,
	body: CloudSqlBody,
	post: typeof apiClient.post = apiClient.post,
): Promise<CloudSqlResponse> {
	const data = await post<unknown>(cloudRoutes.sql(projectId), body);
	return cloudSqlResponseSchema.parse(data);
}
