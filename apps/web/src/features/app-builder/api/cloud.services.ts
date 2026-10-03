/**
 * Data layer of the Cloud tab (WANDIT-188). Each function calls one route
 * under `/api/v2/projects/:id/cloud/*` or `/api/v2/projects/:id/secrets`
 * through `@/lib/api-client` and parses the answer with its contracts
 * schema. `uploadObject` also sends the file to Supabase Storage.
 * Called by cloud.queries.ts and cloud.mutations.ts. The last parameter of
 * each function is the client method, so a spec injects a fake.
 */

import {
	appBuilderRoutes,
	type CloudAuthUsersQuery,
	type CloudAuthUsersResponse,
	type CloudBackendResponse,
	type CloudBucket,
	type CloudDeleteObjectsBody,
	type CloudFunction,
	type CloudJobsResponse,
	type CloudLogEntry,
	type CloudLogsQuery,
	type CloudObjectsQuery,
	type CloudObjectsResponse,
	type CloudRowsQuery,
	type CloudRowsResponse,
	type CloudSignupsResponse,
	type CloudSqlBody,
	type CloudSqlResponse,
	type CloudTable,
	type CloudUploadUrlBody,
	cloudAuthUsersResponseSchema,
	cloudBackendResponseSchema,
	cloudBucketsResponseSchema,
	cloudDeleteObjectsResponseSchema,
	cloudFunctionsResponseSchema,
	cloudJobsResponseSchema,
	cloudLogsResponseSchema,
	cloudObjectsResponseSchema,
	cloudRoutes,
	cloudRowsResponseSchema,
	cloudSignupsResponseSchema,
	cloudSqlResponseSchema,
	cloudTablesResponseSchema,
	cloudUploadUrlResponseSchema,
	listProjectSecretsResponseSchema,
	type ProjectSecretSummary,
	type SetProjectSecretRequest,
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

/** `GET cloud/auth/users` answers one page of `auth.users`, newest first, with the exact total. */
export async function listAuthUsers(
	projectId: string,
	query: CloudAuthUsersQuery,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudAuthUsersResponse> {
	const data = await get<unknown>(cloudRoutes.authUsers(projectId), {
		query,
	});
	return cloudAuthUsersResponseSchema.parse(data);
}

/** `GET cloud/auth/signups` answers one count per UTC day of the last 30 days, oldest first. */
export async function listSignups(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudSignupsResponse["days"]> {
	const data = await get<unknown>(cloudRoutes.authSignups(projectId));
	return cloudSignupsResponseSchema.parse(data).days;
}

/** `GET cloud/storage/buckets` answers the Storage buckets of the app. */
export async function listBuckets(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudBucket[]> {
	const data = await get<unknown>(cloudRoutes.buckets(projectId));
	return cloudBucketsResponseSchema.parse(data).buckets;
}

/**
 * `GET cloud/storage/buckets/:bucket/objects` answers one page of the files
 * and folders under `query.prefix`. Each file carries a signed download URL.
 */
export async function listObjects(
	projectId: string,
	bucket: string,
	query: CloudObjectsQuery,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudObjectsResponse> {
	const data = await get<unknown>(cloudRoutes.objects(projectId, bucket), {
		query,
	});
	return cloudObjectsResponseSchema.parse(data);
}

/**
 * Uploads one file to `path`. The API signs an upload URL, and the browser
 * sends the file to Supabase Storage with a `PUT`, so the file never passes
 * through the API. A path that exists fails: Storage does not overwrite.
 */
export async function uploadObject(
	projectId: string,
	bucket: string,
	input: { path: string; file: File },
	post: typeof apiClient.post = apiClient.post,
	put: typeof fetch = fetch,
): Promise<void> {
	const body: CloudUploadUrlBody = { path: input.path };
	const data = await post<unknown>(
		cloudRoutes.uploadUrl(projectId, bucket),
		body,
	);
	const { uploadUrl } = cloudUploadUrlResponseSchema.parse(data);
	const response = await put(uploadUrl, {
		method: "PUT",
		body: input.file,
		// Storage keeps this type as the mime type of the object.
		headers: {
			"content-type": input.file.type || "application/octet-stream",
		},
	});
	// fetch resolves on every HTTP status. A 4xx or 5xx from Storage is a failed upload.
	if (!response.ok) {
		throw new Error(`Storage refused the upload with HTTP ${response.status}`);
	}
}

/** `DELETE cloud/storage/buckets/:bucket/objects` removes the listed files. Answers how many Storage removed. */
export async function deleteObjects(
	projectId: string,
	bucket: string,
	body: CloudDeleteObjectsBody,
	request: typeof apiClient.request = apiClient.request,
): Promise<number> {
	// apiClient.delete takes no body, so the call goes through request.
	const data = await request<unknown, CloudDeleteObjectsBody>({
		method: "DELETE",
		url: cloudRoutes.objects(projectId, bucket),
		data: body,
	});
	return cloudDeleteObjectsResponseSchema.parse(data).deleted;
}

/**
 * `GET cloud/logs` answers the log lines of one source in a window of at
 * most 24 hours, newest first, at most `CLOUD_LOGS_PAGE_SIZE` lines.
 */
export async function queryLogs(
	projectId: string,
	query: CloudLogsQuery,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudLogEntry[]> {
	const data = await get<unknown>(cloudRoutes.logs(projectId), { query });
	return cloudLogsResponseSchema.parse(data).entries;
}

/** `GET cloud/functions` answers the Edge Functions with the last deploy and the calls of 24 hours. */
export async function listFunctions(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudFunction[]> {
	const data = await get<unknown>(cloudRoutes.functions(projectId));
	return cloudFunctionsResponseSchema.parse(data).functions;
}

/** `GET cloud/jobs` answers the pg_cron jobs with their last runs; `installed: false` without pg_cron. */
export async function listJobs(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudJobsResponse> {
	const data = await get<unknown>(cloudRoutes.jobs(projectId));
	return cloudJobsResponseSchema.parse(data);
}

/** `GET secrets` answers the names, kinds, and dates, sorted by name. No route answers a value. */
export async function listSecrets(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<ProjectSecretSummary[]> {
	const data = await get<unknown>(appBuilderRoutes.secrets(projectId));
	return listProjectSecretsResponseSchema.parse(data).secrets;
}

/**
 * `PUT secrets/:name` sets or replaces one value and answers 204. A name of
 * a `system` row answers 409 `PROJECT_SECRET_SYSTEM`.
 */
export async function setSecret(
	projectId: string,
	name: string,
	body: SetProjectSecretRequest,
	put: typeof apiClient.put = apiClient.put,
): Promise<void> {
	await put(appBuilderRoutes.secret(projectId, name), body);
}

/** `DELETE secrets/:name` removes one `user` secret and answers 204; a missing name answers 404. */
export async function deleteSecret(
	projectId: string,
	name: string,
	del: typeof apiClient.delete = apiClient.delete,
): Promise<void> {
	await del(appBuilderRoutes.secret(projectId, name));
}
