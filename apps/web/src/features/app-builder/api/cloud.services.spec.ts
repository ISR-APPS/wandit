import type {
	CloudAuthUsersResponse,
	CloudBackendResponse,
	CloudBucket,
	CloudDeleteObjectsBody,
	CloudFunction,
	CloudJobsResponse,
	CloudLogEntry,
	CloudLogsQuery,
	CloudObjectsResponse,
	CloudRowsResponse,
	CloudSqlBody,
	CloudSqlResponse,
	CloudTable,
	CloudUploadUrlBody,
	ProjectSecretSummary,
	SetProjectSecretRequest,
} from "@wandit/contracts";
import type { AxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";

import {
	ApiClientError,
	type ApiRequestOptions,
	type apiClient,
} from "@/lib/api-client";
import {
	deleteObjects,
	deleteSecret,
	enableBackend,
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
	restoreBackend,
	runSql,
	setSecret,
	uploadObject,
} from "./cloud.services";

const PROJECT_ID = crypto.randomUUID();
const BASE = `/api/v2/projects/${PROJECT_ID}/cloud`;
const SECRETS_BASE = `/api/v2/projects/${PROJECT_ID}/secrets`;

/** One recorded request of a fake client method. runSql, uploadObject, and setSecret send a body. */
type Call = {
	url: string;
	body?: CloudSqlBody | CloudUploadUrlBody | SetProjectSecretRequest;
	options?: ApiRequestOptions;
};

/**
 * A GET that answers `body` and records each URL and option it got. `body`
 * is the raw answer before the service parses it, so a case can send a bad one.
 */
function getAnswers(body: unknown, calls: Call[] = []): typeof apiClient.get {
	// SAFETY: the fake answers the one GET of a case, and the service
	// parses the answer with its contracts schema.
	return (async (url: string, options?: ApiRequestOptions) => {
		calls.push({ url, options });
		return body;
	}) as typeof apiClient.get;
}

/** A POST that answers the raw `answer` and records each URL and body it got. */
function postAnswers(
	answer: unknown,
	calls: Call[] = [],
): typeof apiClient.post {
	// SAFETY: the fake answers the one POST of a case, and the service
	// parses the answer with its contracts schema.
	return (async (url: string, body?: Call["body"]) => {
		calls.push({ url, body });
		return answer;
	}) as typeof apiClient.post;
}

/** A PUT of the API that answers nothing, like the 204 of the secrets route. */
function putAnswersNothing(calls: Call[]): typeof apiClient.put {
	// SAFETY: setSecret reads no answer, so the empty answer fits every TData.
	return (async (url: string, body?: SetProjectSecretRequest) => {
		calls.push({ url, body });
		return undefined;
	}) as typeof apiClient.put;
}

/** A DELETE of the API that answers nothing, like the 204 of the secrets route. */
function deleteAnswersNothing(calls: Call[]): typeof apiClient.delete {
	// SAFETY: deleteSecret reads no answer, so the empty answer fits every TData.
	return (async (url: string) => {
		calls.push({ url });
		return undefined;
	}) as typeof apiClient.delete;
}

/** The axios config that deleteObjects gives to `apiClient.request`. */
type RequestCall = AxiosRequestConfig<CloudDeleteObjectsBody>;

/** A raw `apiClient.request` that answers the raw `answer` and records each config. */
function requestAnswers(
	answer: unknown,
	calls: RequestCall[],
): typeof apiClient.request {
	// SAFETY: the fake answers the one request of a case, and the service
	// parses the answer with its contracts schema.
	return (async (config: RequestCall) => {
		calls.push(config);
		return answer;
	}) as typeof apiClient.request;
}

/** One recorded call of the fake Storage `fetch`. */
type StorageCall = { input: RequestInfo | URL; init?: RequestInit };

/** A Storage `fetch` that answers an empty body with HTTP `status` and records each call. */
function storageAnswers(status: number, calls: StorageCall[]): typeof fetch {
	return async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ input, init });
		return new Response(null, { status });
	};
}

/** An API failure with the shared error envelope fields. */
function apiError(statusCode: number, code: string): ApiClientError {
	return new ApiClientError({
		code,
		message: "The request failed.",
		path: BASE,
		requestId: "req-1",
		statusCode,
		timestamp: "2026-09-25T00:00:00.000Z",
	});
}

/** A client method that fails with `error`. */
function fails(error: ApiClientError): typeof apiClient.get {
	return async () => {
		throw error;
	};
}

const CREATING: CloudBackendResponse = {
	status: "creating",
	ref: "abcdefghijklmnopqrst",
	region: "eu-west-3",
	failureCode: null,
};

describe("getCloudBackend", () => {
	it("reads the backend route and parses the answer", async () => {
		const calls: Call[] = [];

		expect(
			await getCloudBackend(PROJECT_ID, getAnswers(CREATING, calls)),
		).toEqual(CREATING);
		expect(calls.map((call) => call.url)).toEqual([`${BASE}/backend`]);
	});

	it("rejects an answer with an unknown status", async () => {
		await expect(
			getCloudBackend(
				PROJECT_ID,
				getAnswers({ ...CREATING, status: "booting" }),
			),
		).rejects.toThrow();
	});
});

describe("enableBackend and restoreBackend", () => {
	it("posts to the backend route with no body and parses the answer", async () => {
		const calls: Call[] = [];

		expect(
			await enableBackend(PROJECT_ID, postAnswers(CREATING, calls)),
		).toEqual(CREATING);
		expect(calls).toEqual([{ url: `${BASE}/backend`, body: undefined }]);
	});

	it("posts to the restore route and parses the answer", async () => {
		const calls: Call[] = [];
		const restoring = { ...CREATING, status: "restoring" };

		expect(
			await restoreBackend(PROJECT_ID, postAnswers(restoring, calls)),
		).toEqual(restoring);
		expect(calls.map((call) => call.url)).toEqual([`${BASE}/backend/restore`]);
	});
});

describe("listTables", () => {
	it("answers the tables of the parsed answer", async () => {
		const orders: CloudTable = {
			name: "orders",
			columns: [
				{
					name: "id",
					dataType: "uuid",
					isNullable: false,
					defaultValue: "gen_random_uuid()",
				},
			],
			rowCount: 12,
			rowCountExact: false,
		};

		expect(
			await listTables(PROJECT_ID, getAnswers({ tables: [orders] })),
		).toEqual([orders]);
	});

	it("rejects a table with a negative row count", async () => {
		await expect(
			listTables(
				PROJECT_ID,
				getAnswers({
					tables: [
						{ name: "x", columns: [], rowCount: -1, rowCountExact: true },
					],
				}),
			),
		).rejects.toThrow();
	});
});

describe("listTableRows", () => {
	const query = {
		page: 2,
		pageSize: 50,
		sort: "created_at",
		dir: "desc" as const,
	};

	it("sends the page and the sort to the rows route of the table", async () => {
		const calls: Call[] = [];
		const page: CloudRowsResponse = {
			items: [{ id: 1, note: null, tags: ["a"] }],
			page: 2,
			pageSize: 50,
			total: 51,
		};

		expect(
			await listTableRows(
				PROJECT_ID,
				"order items",
				query,
				getAnswers(page, calls),
			),
		).toEqual(page);
		expect(calls).toEqual([
			{ url: `${BASE}/tables/order%20items/rows`, options: { query } },
		]);
	});

	it("answers null when the table or the sort column is gone", async () => {
		expect(
			await listTableRows(
				PROJECT_ID,
				"orders",
				query,
				fails(apiError(400, "INVALID_IDENTIFIER")),
			),
		).toBeNull();
	});

	it("rethrows every other failure, a 400 with another code too", async () => {
		await expect(
			listTableRows(
				PROJECT_ID,
				"orders",
				query,
				fails(apiError(400, "QUERY_FAILED")),
			),
		).rejects.toMatchObject({ code: "QUERY_FAILED", statusCode: 400 });
	});
});

describe("runSql", () => {
	it("posts the query and the confirm flag and parses the answer", async () => {
		const calls: Call[] = [];
		const answer: CloudSqlResponse = {
			kind: "read",
			rows: [{ count: 3 }],
			rowCount: 1,
			truncated: false,
		};
		const body = { query: "select count(*) from orders", confirmWrite: false };

		expect(await runSql(PROJECT_ID, body, postAnswers(answer, calls))).toEqual(
			answer,
		);
		expect(calls).toEqual([{ url: `${BASE}/sql`, body }]);
	});

	it("lets WRITE_NEEDS_CONFIRM through unchanged, so the editor can open its dialog", async () => {
		const error = apiError(409, "WRITE_NEEDS_CONFIRM");
		const post: typeof apiClient.post = async () => {
			throw error;
		};

		await expect(
			runSql(
				PROJECT_ID,
				{ query: "delete from orders", confirmWrite: false },
				post,
			),
		).rejects.toBe(error);
	});
});

describe("listAuthUsers and listSignups", () => {
	it("sends the page to the users route and parses the answer", async () => {
		const calls: Call[] = [];
		const query = { page: 2, pageSize: 50 };
		const page: CloudAuthUsersResponse = {
			items: [
				{
					id: "user-1",
					email: "ada@example.com",
					phone: null,
					createdAt: "2026-10-01T08:00:00.000Z",
					lastSignInAt: null,
					provider: "email",
				},
			],
			page: 2,
			pageSize: 50,
			total: 51,
		};

		expect(
			await listAuthUsers(PROJECT_ID, query, getAnswers(page, calls)),
		).toEqual(page);
		expect(calls).toEqual([{ url: `${BASE}/auth/users`, options: { query } }]);
	});

	it("rejects a user with a date that is not ISO text", async () => {
		await expect(
			listAuthUsers(
				PROJECT_ID,
				{ page: 1, pageSize: 50 },
				getAnswers({
					items: [
						{
							id: "user-1",
							email: null,
							phone: null,
							createdAt: "yesterday",
							lastSignInAt: null,
							provider: null,
						},
					],
					page: 1,
					pageSize: 50,
					total: 1,
				}),
			),
		).rejects.toThrow();
	});

	it("reads the sign-ups route and answers the days", async () => {
		const calls: Call[] = [];
		const days = [{ date: "2026-10-02", count: 4 }];

		expect(await listSignups(PROJECT_ID, getAnswers({ days }, calls))).toEqual(
			days,
		);
		expect(calls).toEqual([{ url: `${BASE}/auth/signups` }]);
	});
});

describe("listBuckets and listObjects", () => {
	it("reads the buckets route and answers the buckets", async () => {
		const calls: Call[] = [];
		const avatars: CloudBucket = {
			id: "avatars",
			name: "avatars",
			public: false,
			createdAt: "2026-10-01T08:00:00.000Z",
			updatedAt: "2026-10-01T08:00:00.000Z",
		};

		expect(
			await listBuckets(PROJECT_ID, getAnswers({ buckets: [avatars] }, calls)),
		).toEqual([avatars]);
		expect(calls).toEqual([{ url: `${BASE}/storage/buckets` }]);
	});

	it("sends the prefix and the cursor to the objects route of the bucket", async () => {
		const calls: Call[] = [];
		const query = { prefix: "users/", cursor: "100" };
		const page: CloudObjectsResponse = {
			items: [
				{
					name: "ada.png",
					path: "users/ada.png",
					isFolder: false,
					sizeBytes: 2048,
					mimeType: "image/png",
					updatedAt: "2026-10-01T08:00:00.000Z",
					downloadUrl: "https://storage.example/ada.png?token=t",
				},
			],
			nextCursor: null,
		};

		expect(
			await listObjects(PROJECT_ID, "avatars", query, getAnswers(page, calls)),
		).toEqual(page);
		expect(calls).toEqual([
			{ url: `${BASE}/storage/buckets/avatars/objects`, options: { query } },
		]);
	});

	it("rejects an answer without nextCursor", async () => {
		await expect(
			listObjects(
				PROJECT_ID,
				"avatars",
				{ prefix: "" },
				getAnswers({ items: [] }),
			),
		).rejects.toThrow();
	});
});

describe("uploadObject", () => {
	const UPLOAD_URL =
		"https://storage.example/upload/sign/avatars/a.txt?token=t";
	const file = new File(["hello"], "a.txt", { type: "text/plain" });

	it("asks the API for an upload URL, then sends the file to it with its type", async () => {
		const postCalls: Call[] = [];
		const storageCalls: StorageCall[] = [];

		await uploadObject(
			PROJECT_ID,
			"avatars",
			{ path: "users/a.txt", file },
			postAnswers({ uploadUrl: UPLOAD_URL, path: "users/a.txt" }, postCalls),
			storageAnswers(200, storageCalls),
		);

		expect(postCalls).toEqual([
			{
				url: `${BASE}/storage/buckets/avatars/objects/upload-url`,
				body: { path: "users/a.txt" },
			},
		]);
		expect(storageCalls).toEqual([
			{
				input: UPLOAD_URL,
				init: {
					method: "PUT",
					body: file,
					headers: { "content-type": "text/plain" },
				},
			},
		]);
	});

	it("sends a file without a type as application/octet-stream", async () => {
		const storageCalls: StorageCall[] = [];

		await uploadObject(
			PROJECT_ID,
			"avatars",
			{ path: "data.bin", file: new File(["x"], "data.bin") },
			postAnswers({ uploadUrl: UPLOAD_URL, path: "data.bin" }),
			storageAnswers(200, storageCalls),
		);

		expect(storageCalls[0]?.init?.headers).toEqual({
			"content-type": "application/octet-stream",
		});
	});

	it("throws when Storage refuses the file, for example a path that exists", async () => {
		await expect(
			uploadObject(
				PROJECT_ID,
				"avatars",
				{ path: "users/a.txt", file },
				postAnswers({ uploadUrl: UPLOAD_URL, path: "users/a.txt" }),
				storageAnswers(409, []),
			),
		).rejects.toThrow("HTTP 409");
	});

	it("sends no file when the upload-url answer is bad", async () => {
		const storageCalls: StorageCall[] = [];

		await expect(
			uploadObject(
				PROJECT_ID,
				"avatars",
				{ path: "users/a.txt", file },
				postAnswers({ path: "users/a.txt" }),
				storageAnswers(200, storageCalls),
			),
		).rejects.toThrow();
		expect(storageCalls).toEqual([]);
	});
});

describe("deleteObjects", () => {
	it("sends the paths as the body of a DELETE and answers the deleted count", async () => {
		const calls: RequestCall[] = [];
		const paths = ["users/a.txt", "users/b.txt"];

		expect(
			await deleteObjects(
				PROJECT_ID,
				"avatars",
				{ paths },
				requestAnswers({ deleted: 2 }, calls),
			),
		).toBe(2);
		expect(calls).toEqual([
			{
				method: "DELETE",
				url: `${BASE}/storage/buckets/avatars/objects`,
				data: { paths },
			},
		]);
	});
});

describe("queryLogs", () => {
	const query: CloudLogsQuery = {
		source: "api",
		start: "2026-10-02T00:00:00.000Z",
		end: "2026-10-03T00:00:00.000Z",
		level: "error",
	};

	it("sends the source, the window, and the level to the logs route", async () => {
		const calls: Call[] = [];
		const entry: CloudLogEntry = {
			id: "log-1",
			timestamp: "2026-10-02T10:00:00.000Z",
			level: "error",
			message: "GET /rest/v1/orders 500",
		};

		expect(
			await queryLogs(
				PROJECT_ID,
				query,
				getAnswers({ entries: [entry] }, calls),
			),
		).toEqual([entry]);
		expect(calls).toEqual([{ url: `${BASE}/logs`, options: { query } }]);
	});

	it("rejects an entry with an unknown level", async () => {
		await expect(
			queryLogs(
				PROJECT_ID,
				query,
				getAnswers({
					entries: [
						{
							id: "log-1",
							timestamp: "2026-10-02T10:00:00.000Z",
							level: "debug",
							message: "x",
						},
					],
				}),
			),
		).rejects.toThrow();
	});
});

describe("listFunctions and listJobs", () => {
	it("reads the functions route and answers the functions", async () => {
		const calls: Call[] = [];
		const sendEmail: CloudFunction = {
			id: "fn-1",
			slug: "send-email",
			name: "send-email",
			status: "ACTIVE",
			version: 3,
			lastDeployedAt: "2026-10-01T08:00:00.000Z",
			invocations24h: 12,
		};

		expect(
			await listFunctions(
				PROJECT_ID,
				getAnswers({ functions: [sendEmail] }, calls),
			),
		).toEqual([sendEmail]);
		expect(calls).toEqual([{ url: `${BASE}/functions` }]);
	});

	it("reads the jobs route and answers the installed flag with the jobs", async () => {
		const calls: Call[] = [];
		const answer: CloudJobsResponse = {
			installed: true,
			jobs: [
				{
					jobId: 1,
					name: "nightly-cleanup",
					schedule: "0 3 * * *",
					command: "delete from sessions where expires_at < now()",
					active: true,
					runs: [
						{
							runId: 7,
							status: "succeeded",
							startTime: "2026-10-02T03:00:00.000Z",
							endTime: "2026-10-02T03:00:01.000Z",
							returnMessage: "DELETE 4",
						},
					],
				},
			],
		};

		expect(await listJobs(PROJECT_ID, getAnswers(answer, calls))).toEqual(
			answer,
		);
		expect(calls).toEqual([{ url: `${BASE}/jobs` }]);
	});
});

describe("listSecrets, setSecret, and deleteSecret", () => {
	it("reads the secrets route and answers the names without a value", async () => {
		const calls: Call[] = [];
		const apiKey: ProjectSecretSummary = {
			name: "API_KEY",
			kind: "user",
			createdAt: "2026-10-01T08:00:00.000Z",
			updatedAt: "2026-10-02T08:00:00.000Z",
		};

		expect(
			await listSecrets(PROJECT_ID, getAnswers({ secrets: [apiKey] }, calls)),
		).toEqual([apiKey]);
		expect(calls).toEqual([{ url: SECRETS_BASE }]);
	});

	it("rejects a secret with an unknown kind", async () => {
		await expect(
			listSecrets(
				PROJECT_ID,
				getAnswers({
					secrets: [
						{
							name: "API_KEY",
							kind: "admin",
							createdAt: "2026-10-01T08:00:00.000Z",
							updatedAt: "2026-10-01T08:00:00.000Z",
						},
					],
				}),
			),
		).rejects.toThrow();
	});

	it("puts the value to the route of the name", async () => {
		const calls: Call[] = [];

		await setSecret(
			PROJECT_ID,
			"API_KEY",
			{ value: "s3cret" },
			putAnswersNothing(calls),
		);

		expect(calls).toEqual([
			{ url: `${SECRETS_BASE}/API_KEY`, body: { value: "s3cret" } },
		]);
	});

	it("deletes the route of the name", async () => {
		const calls: Call[] = [];

		await deleteSecret(PROJECT_ID, "API_KEY", deleteAnswersNothing(calls));

		expect(calls).toEqual([{ url: `${SECRETS_BASE}/API_KEY` }]);
	});
});
