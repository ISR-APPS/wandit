import type {
	CloudBackendResponse,
	CloudRowsResponse,
	CloudSqlBody,
	CloudSqlResponse,
	CloudTable,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	ApiClientError,
	type ApiRequestOptions,
	type apiClient,
} from "@/lib/api-client";
import {
	enableBackend,
	getCloudBackend,
	listTableRows,
	listTables,
	restoreBackend,
	runSql,
} from "./cloud.services";

const PROJECT_ID = crypto.randomUUID();
const BASE = `/api/v2/projects/${PROJECT_ID}/cloud`;

/** One recorded request of a fake client method. Only runSql sends a body. */
type Call = { url: string; body?: CloudSqlBody; options?: ApiRequestOptions };

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
	return (async (url: string, body?: CloudSqlBody) => {
		calls.push({ url, body });
		return answer;
	}) as typeof apiClient.post;
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
