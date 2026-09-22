import { HttpException } from "@nestjs/common";
import {
	cloudAuthUsersResponseSchema,
	cloudBackendResponseSchema,
	cloudBucketsResponseSchema,
	cloudFunctionsResponseSchema,
	cloudJobsResponseSchema,
	cloudLogsResponseSchema,
	cloudObjectsResponseSchema,
	cloudRowsResponseSchema,
	cloudSignupsResponseSchema,
	cloudSqlResponseSchema,
	cloudTablesResponseSchema,
} from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { AppBackendRow } from "../../infrastructure/persistence/app-backends.repository";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import type { AuditEventInput } from "../../infrastructure/persistence/audit-events.repository";
import {
	jsonResponse,
	type RecordedRequest,
	scriptedFetch,
} from "../../infrastructure/supabase/fake-supabase-fetch";
import { FakeSupabaseRateLimiter } from "../../infrastructure/supabase/fake-supabase-rate-limiter";
import { SupabaseManagementClient } from "../../infrastructure/supabase/supabase-management.client";
import {
	buildLogsSql,
	CloudRateLimitedException,
	CloudService,
	quoteIdentifier,
} from "./cloud.service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const REF = "abcdefghijklmnopqrst";
const API = "https://api.supabase.com/v1";
const STORAGE = `https://${REF}.supabase.co/storage/v1`;
const SCOPE: ProjectScope = {
	actorIsLimitExempt: false,
	kind: "org",
	organizationId: "org-1",
	userId: "user-1",
};
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: PROJECT_ID,
	organizationId: "org-1",
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};
const BACKEND: AppBackendRow = {
	anonKey: "anon-1",
	dbHost: null,
	failureCode: null,
	id: "backend-1",
	orgId: "sb-org",
	organizationId: "org-1",
	projectId: PROJECT_ID,
	ref: REF,
	region: "eu-west-3",
	requestKey: "req-1",
	status: "active",
	triggerRunId: null,
	userId: "user-1",
};
const SERVICE_ROLE_KEY = "service-role-secret-1";

// The api-keys answer every storage route reads first.
const API_KEYS_ANSWER = JSON.stringify([
	{ name: "anon", api_key: "anon-1" },
	{ name: "service_role", api_key: SERVICE_ROLE_KEY },
]);

// The tables query answer: two tables, `users` with two columns.
const TABLE_ROWS_ANSWER = JSON.stringify([
	{
		table_name: "posts",
		column_name: "id",
		data_type: "uuid",
		is_nullable: false,
		column_default: "gen_random_uuid()",
		row_estimate: 7,
	},
	{
		table_name: "users",
		column_name: "id",
		data_type: "integer",
		is_nullable: false,
		column_default: null,
		row_estimate: 41,
	},
	{
		table_name: "users",
		column_name: "email",
		data_type: "text",
		is_nullable: true,
		column_default: null,
		row_estimate: 41,
	},
]);

const sentBodySchema = z.object({
	query: z.string(),
	read_only: z.boolean().optional(),
});

// The SQL body the fake API received in one request.
function sentQuery(request: RecordedRequest | undefined) {
	return sentBodySchema.parse(JSON.parse(request?.body ?? "{}"));
}

function fixture(options?: {
	answers?: (Response | Error)[];
	/** The `app_backends` row; null means no row. Default: an active row. */
	backend?: AppBackendRow | null;
	/** The scoped project; null means out of scope. Default: a V2 project. */
	project?: ScopedAppProject | null;
	/** True composes the service without a client (platform token unset). */
	noClient?: boolean;
	rateLimiter?: FakeSupabaseRateLimiter;
	/** Answer of `provisionBackend`; null means unconfigured. Default: the active row. */
	provisionAnswer?: AppBackendRow | null;
}) {
	const requests: RecordedRequest[] = [];
	const audits: AuditEventInput[] = [];
	const provisionCalls: { projectId: string; countryCode: string | null }[] =
		[];
	const markRestoringCalls: string[] = [];
	const rateLimiter = options?.rateLimiter ?? new FakeSupabaseRateLimiter();
	const client = options?.noClient
		? null
		: new SupabaseManagementClient({
				fetch: scriptedFetch(options?.answers ?? [], requests),
				interactive: true,
				logger: {
					error: () => undefined,
					info: () => undefined,
					warn: () => undefined,
				},
				organizationSlug: "wandit",
				ownsRef: () => Promise.resolve(true),
				rateLimiter,
				sleep: () => Promise.resolve(),
				token: "sbp_platform_token",
			});
	const backend = options?.backend === undefined ? BACKEND : options.backend;
	const service = new CloudService(
		{
			findScopedProject: () =>
				Promise.resolve(
					options?.project === undefined ? PROJECT : options.project,
				),
		},
		{
			findByProjectId: () => Promise.resolve(backend),
			markRestoring: (projectId) => {
				markRestoringCalls.push(projectId);
				return Promise.resolve(true);
			},
		},
		{
			provisionBackend: (projectId, input) => {
				provisionCalls.push({ countryCode: input.countryCode, projectId });
				return Promise.resolve(
					options?.provisionAnswer === undefined
						? BACKEND
						: options.provisionAnswer,
				);
			},
		},
		{
			insert: (input) => {
				audits.push(input);
				return Promise.resolve();
			},
		},
		client,
	);
	return {
		audits,
		markRestoringCalls,
		provisionCalls,
		rateLimiter,
		requests,
		service,
	};
}

// The status and the `code` of a rejected route call.
async function rejection(
	promise: Promise<unknown>,
): Promise<{ code: string | null; status: number }> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof HttpException) {
			const body = error.getResponse();
			return {
				code:
					typeof body === "object" && "code" in body ? String(body.code) : null,
				status: error.getStatus(),
			};
		}
		throw error;
	}
	throw new Error("expected a rejection");
}

afterEach(() => {
	vi.useRealTimers();
});

describe("CloudService scope and backend gates", () => {
	it("answers 404 for a project outside the scope on every route", async () => {
		const { service, requests } = fixture({ project: null });

		expect(await rejection(service.getBackend(SCOPE, PROJECT_ID))).toEqual({
			code: null,
			status: 404,
		});
		expect(await rejection(service.listTables(SCOPE, PROJECT_ID, {}))).toEqual({
			code: null,
			status: 404,
		});
		expect(
			await rejection(
				service.runSql(SCOPE, PROJECT_ID, {
					confirmWrite: false,
					query: "select 1",
				}),
			),
		).toEqual({ code: null, status: 404 });
		expect(requests).toHaveLength(0);
	});

	it("answers 404 for a V1 project", async () => {
		const { service } = fixture({ project: { ...PROJECT, engine: "v1_page" } });

		expect(await rejection(service.getBackend(SCOPE, PROJECT_ID))).toEqual({
			code: null,
			status: 404,
		});
	});

	it("answers 409 BACKEND_PAUSED on a panel route while the backend is paused", async () => {
		const { service, requests } = fixture({
			backend: { ...BACKEND, status: "paused" },
		});

		expect(await rejection(service.listTables(SCOPE, PROJECT_ID, {}))).toEqual({
			code: "BACKEND_PAUSED",
			status: 409,
		});
		expect(await rejection(service.listBuckets(SCOPE, PROJECT_ID))).toEqual({
			code: "BACKEND_PAUSED",
			status: 409,
		});
		expect(requests).toHaveLength(0);
	});

	it("answers 409 BACKEND_NOT_READY without an active row", async () => {
		const creating = fixture({ backend: { ...BACKEND, status: "creating" } });
		expect(
			await rejection(creating.service.listJobs(SCOPE, PROJECT_ID)),
		).toEqual({ code: "BACKEND_NOT_READY", status: 409 });

		const none = fixture({ backend: null });
		expect(
			await rejection(none.service.listFunctions(SCOPE, PROJECT_ID)),
		).toEqual({ code: "BACKEND_NOT_READY", status: 409 });
	});

	it("answers 503 V2_ENV_MISSING when the platform token is unset", async () => {
		const { service } = fixture({ noClient: true });

		expect(await rejection(service.listTables(SCOPE, PROJECT_ID, {}))).toEqual({
			code: "V2_ENV_MISSING",
			status: 503,
		});
	});
});

describe("CloudService backend routes", () => {
	it("getBackend answers none without a row and the row fields with one", async () => {
		const none = fixture({ backend: null });
		const noneAnswer = await none.service.getBackend(SCOPE, PROJECT_ID);
		expect(cloudBackendResponseSchema.parse(noneAnswer)).toEqual({
			failureCode: null,
			ref: null,
			region: null,
			status: "none",
		});

		const failed = fixture({
			backend: {
				...BACKEND,
				failureCode: "backend_provision_timeout",
				status: "error",
			},
		});
		expect(await failed.service.getBackend(SCOPE, PROJECT_ID)).toEqual({
			failureCode: "backend_provision_timeout",
			ref: REF,
			region: "eu-west-3",
			status: "error",
		});
	});

	it("ensureBackend calls provisionBackend with the country and answers the row", async () => {
		const { service, provisionCalls } = fixture();

		const answer = await service.ensureBackend(SCOPE, PROJECT_ID, "FR");

		expect(provisionCalls).toEqual([
			{ countryCode: "FR", projectId: PROJECT_ID },
		]);
		expect(answer.status).toBe("active");
	});

	it("ensureBackend answers 503 V2_ENV_MISSING when provisioning is unconfigured", async () => {
		const { service } = fixture({ provisionAnswer: null });

		expect(
			await rejection(service.ensureBackend(SCOPE, PROJECT_ID, null)),
		).toEqual({ code: "V2_ENV_MISSING", status: 503 });
	});

	it("restoreBackend calls the upstream restore, then moves the row to restoring", async () => {
		const { service, requests, markRestoringCalls } = fixture({
			answers: [jsonResponse(200, "{}")],
			backend: { ...BACKEND, status: "paused" },
		});

		const answer = await service.restoreBackend(SCOPE, PROJECT_ID);

		expect(answer.status).toBe("restoring");
		expect(requests[0]).toMatchObject({
			method: "POST",
			url: `${API}/projects/${REF}/restore`,
		});
		expect(markRestoringCalls).toEqual([PROJECT_ID]);
	});

	it("restoreBackend leaves the row paused when the upstream call fails", async () => {
		const { service, markRestoringCalls } = fixture({
			answers: [jsonResponse(400, JSON.stringify({ message: "nope" }))],
			backend: { ...BACKEND, status: "paused" },
		});

		expect(await rejection(service.restoreBackend(SCOPE, PROJECT_ID))).toEqual({
			code: "UPSTREAM_UNAVAILABLE",
			status: 503,
		});
		expect(markRestoringCalls).toEqual([]);
	});

	it("restoreBackend answers an active row as it is, without a call", async () => {
		const { service, requests, markRestoringCalls } = fixture();

		const answer = await service.restoreBackend(SCOPE, PROJECT_ID);

		expect(answer.status).toBe("active");
		expect(requests).toHaveLength(0);
		expect(markRestoringCalls).toEqual([]);
	});

	it("restoreBackend answers 409 BACKEND_NOT_READY without a ref", async () => {
		const { service } = fixture({
			backend: { ...BACKEND, ref: null, status: "creating" },
		});

		expect(await rejection(service.restoreBackend(SCOPE, PROJECT_ID))).toEqual({
			code: "BACKEND_NOT_READY",
			status: 409,
		});
	});
});

describe("CloudService.listTables", () => {
	it("groups the columns per table with the live-row estimate, read-only", async () => {
		const { service, requests, rateLimiter } = fixture({
			answers: [jsonResponse(201, TABLE_ROWS_ANSWER)],
		});

		const answer = await service.listTables(SCOPE, PROJECT_ID, {});

		expect(cloudTablesResponseSchema.parse(answer)).toEqual({
			tables: [
				{
					columns: [
						{
							dataType: "uuid",
							defaultValue: "gen_random_uuid()",
							isNullable: false,
							name: "id",
						},
					],
					name: "posts",
					rowCount: 7,
					rowCountExact: false,
				},
				{
					columns: [
						{
							dataType: "integer",
							defaultValue: null,
							isNullable: false,
							name: "id",
						},
						{
							dataType: "text",
							defaultValue: null,
							isNullable: true,
							name: "email",
						},
					],
					name: "users",
					rowCount: 41,
					rowCountExact: false,
				},
			],
		});
		const sent = sentQuery(requests[0]);
		expect(sent.read_only).toBe(true);
		expect(sent.query).toContain("information_schema.columns");
		expect(sent.query).toContain("pg_stat_user_tables");
		expect(rateLimiter.calls[0]).toEqual({
			bucket: `supabase:rl:project:${REF}`,
			limitPerMinute: 120,
		});
	});

	it("counts one table exactly with a quoted name on ?exact", async () => {
		const { service, requests } = fixture({
			answers: [
				jsonResponse(201, TABLE_ROWS_ANSWER),
				jsonResponse(201, JSON.stringify([{ count: 43 }])),
			],
		});

		const answer = await service.listTables(SCOPE, PROJECT_ID, {
			exact: "users",
		});

		expect(sentQuery(requests[1]).query).toBe(
			'select count(*)::float8 as count from "public"."users"',
		);
		expect(answer.tables[1]).toMatchObject({
			name: "users",
			rowCount: 43,
			rowCountExact: true,
		});
		expect(answer.tables[0]?.rowCountExact).toBe(false);
	});

	it("answers 400 INVALID_IDENTIFIER for an unknown exact table", async () => {
		const { service, requests } = fixture({
			answers: [jsonResponse(201, TABLE_ROWS_ANSWER)],
		});

		expect(
			await rejection(
				service.listTables(SCOPE, PROJECT_ID, { exact: 'x"; drop table y' }),
			),
		).toEqual({ code: "INVALID_IDENTIFIER", status: 400 });
		expect(requests).toHaveLength(1);
	});

	it("caches the table list for 30 s per ref", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-17T10:00:00.000Z"));
		const { service, requests } = fixture({
			answers: [
				jsonResponse(201, TABLE_ROWS_ANSWER),
				jsonResponse(201, TABLE_ROWS_ANSWER),
			],
		});

		await service.listTables(SCOPE, PROJECT_ID, {});
		await service.listTables(SCOPE, PROJECT_ID, {});
		expect(requests).toHaveLength(1);

		vi.setSystemTime(new Date("2026-09-17T10:00:31.000Z"));
		await service.listTables(SCOPE, PROJECT_ID, {});
		expect(requests).toHaveLength(2);
	});
});

describe("CloudService.listRows", () => {
	it("builds the page query from quoted names and answers the page", async () => {
		const { service, requests } = fixture({
			answers: [
				jsonResponse(201, TABLE_ROWS_ANSWER),
				jsonResponse(
					201,
					JSON.stringify([{ total: 41, items: [{ id: 21, email: "a@b.c" }] }]),
				),
			],
		});

		const answer = await service.listRows(SCOPE, PROJECT_ID, "users", {
			dir: "desc",
			page: 2,
			pageSize: 20,
			sort: "email",
		});

		expect(cloudRowsResponseSchema.parse(answer)).toEqual({
			items: [{ email: "a@b.c", id: 21 }],
			page: 2,
			pageSize: 20,
			total: 41,
		});
		const sent = sentQuery(requests[1]);
		expect(sent.read_only).toBe(true);
		expect(sent.query).toContain(
			'select * from "public"."users" order by "email" desc limit 20 offset 20',
		);
		expect(sent.query).toContain(
			'select count(*)::float8 from "public"."users"',
		);
	});

	it("sorts by the first column when sort is absent", async () => {
		const { service, requests } = fixture({
			answers: [
				jsonResponse(201, TABLE_ROWS_ANSWER),
				jsonResponse(201, JSON.stringify([{ total: 0, items: [] }])),
			],
		});

		await service.listRows(SCOPE, PROJECT_ID, "users", {
			dir: "asc",
			page: 1,
			pageSize: 20,
		});

		expect(sentQuery(requests[1]).query).toContain('order by "id" asc');
	});

	it("answers 400 INVALID_IDENTIFIER for an unknown table or sort column", async () => {
		const { service, requests } = fixture({
			answers: [jsonResponse(201, TABLE_ROWS_ANSWER)],
		});

		expect(
			await rejection(
				service.listRows(SCOPE, PROJECT_ID, "secrets", {
					dir: "asc",
					page: 1,
					pageSize: 20,
				}),
			),
		).toEqual({ code: "INVALID_IDENTIFIER", status: 400 });
		expect(
			await rejection(
				service.listRows(SCOPE, PROJECT_ID, "users", {
					dir: "asc",
					page: 1,
					pageSize: 20,
					sort: "password",
				}),
			),
		).toEqual({ code: "INVALID_IDENTIFIER", status: 400 });
		expect(requests).toHaveLength(1);
	});
});

describe("CloudService.runSql", () => {
	it("runs a read at once in read-only mode without an audit row", async () => {
		const { service, requests, audits } = fixture({
			answers: [jsonResponse(201, JSON.stringify([{ n: 1 }]))],
		});

		const answer = await service.runSql(SCOPE, PROJECT_ID, {
			confirmWrite: false,
			query: "select 1 as n",
		});

		expect(cloudSqlResponseSchema.parse(answer)).toEqual({
			kind: "read",
			rowCount: 1,
			rows: [{ n: 1 }],
			truncated: false,
		});
		expect(sentQuery(requests[0])).toEqual({
			query: "select 1 as n",
			read_only: true,
		});
		expect(audits).toEqual([]);
	});

	it("answers 409 WRITE_NEEDS_CONFIRM for a write without confirmWrite", async () => {
		const { service, requests } = fixture();

		expect(
			await rejection(
				service.runSql(SCOPE, PROJECT_ID, {
					confirmWrite: false,
					query: "update users set name = 'x'",
				}),
			),
		).toEqual({ code: "WRITE_NEEDS_CONFIRM", status: 409 });
		expect(requests).toHaveLength(0);
	});

	it("runs a confirmed write and writes an audit row with the hash, not the text", async () => {
		const { service, requests, audits } = fixture({
			answers: [jsonResponse(201, "[]")],
		});

		const answer = await service.runSql(SCOPE, PROJECT_ID, {
			confirmWrite: true,
			query: "update users set name = 'secret'",
		});

		expect(answer).toEqual({
			kind: "write",
			rowCount: 0,
			rows: [],
			truncated: false,
		});
		expect(sentQuery(requests[0]).read_only).toBe(false);
		expect(audits).toEqual([
			{
				action: "cloud.sql_write",
				actorUserId: "user-1",
				metadata: {
					// SHA-256 of the query text above; the text itself never lands in the row.
					queryHash:
						"6641cf415502455537b8967bccbe7b29e7dbc6fa25a8bf97bd2f5ca2b6d3684e",
					rowCount: 0,
				},
				organizationId: "org-1",
				projectId: PROJECT_ID,
				targetId: "backend-1",
				targetType: "app_backend",
			},
		]);
		expect(JSON.stringify(audits)).not.toContain("secret");
	});

	it("keeps the first 500 rows and marks the answer truncated", async () => {
		const rows = Array.from({ length: 501 }, (_, index) => ({ n: index }));
		const { service } = fixture({
			answers: [jsonResponse(201, JSON.stringify(rows))],
		});

		const answer = await service.runSql(SCOPE, PROJECT_ID, {
			confirmWrite: false,
			query: "select n from big",
		});

		expect(answer.rowCount).toBe(500);
		expect(answer.rows).toHaveLength(500);
		expect(answer.truncated).toBe(true);
	});

	it("answers 400 QUERY_FAILED with the Postgres message on a refused statement", async () => {
		const { service } = fixture({
			answers: [
				jsonResponse(
					400,
					JSON.stringify({ message: 'relation "nope" does not exist' }),
				),
			],
		});

		const failure = await service
			.runSql(SCOPE, PROJECT_ID, {
				confirmWrite: false,
				query: "select * from nope",
			})
			.then(
				() => null,
				(error: unknown) => error,
			);

		expect(failure).toBeInstanceOf(HttpException);
		// SAFETY: the line above checks the instance.
		const exception = failure as HttpException;
		expect(exception.getStatus()).toBe(400);
		expect(exception.getResponse()).toEqual({
			code: "QUERY_FAILED",
			message: 'relation "nope" does not exist',
		});
	});

	it("answers 503 UPSTREAM_UNAVAILABLE after the one retry on a 5xx", async () => {
		const { service, requests } = fixture({
			answers: [jsonResponse(502, "{}"), jsonResponse(502, "{}")],
		});

		expect(
			await rejection(
				service.runSql(SCOPE, PROJECT_ID, {
					confirmWrite: false,
					query: "select 1",
				}),
			),
		).toEqual({ code: "UPSTREAM_UNAVAILABLE", status: 503 });
		expect(requests).toHaveLength(2);
	});

	it("answers 429 RATE_LIMITED with the bucket wait when the ref bucket is full", async () => {
		const { service, requests } = fixture({
			rateLimiter: new FakeSupabaseRateLimiter([42_000]),
		});

		const failure = await service
			.runSql(SCOPE, PROJECT_ID, { confirmWrite: false, query: "select 1" })
			.then(
				() => null,
				(error: unknown) => error,
			);

		expect(failure).toBeInstanceOf(CloudRateLimitedException);
		// SAFETY: the line above checks the instance.
		const exception = failure as CloudRateLimitedException;
		expect(exception.getStatus()).toBe(429);
		expect(exception.retryAfterSeconds).toBe(42);
		expect(requests).toHaveLength(0);
	});
});

describe("CloudService auth routes", () => {
	it("lists auth.users newest first with the provider and the exact total", async () => {
		const { service, requests } = fixture({
			answers: [
				jsonResponse(
					201,
					JSON.stringify([
						{
							total: 2,
							items: [
								{
									id: "u-2",
									email: "b@x.io",
									phone: null,
									created_at: "2026-09-17T10:00:00.000Z",
									last_sign_in_at: null,
									provider: "google",
								},
							],
						},
					]),
				),
			],
		});

		const answer = await service.listAuthUsers(SCOPE, PROJECT_ID, {
			page: 2,
			pageSize: 1,
		});

		expect(cloudAuthUsersResponseSchema.parse(answer)).toEqual({
			items: [
				{
					createdAt: "2026-09-17T10:00:00.000Z",
					email: "b@x.io",
					id: "u-2",
					lastSignInAt: null,
					phone: null,
					provider: "google",
				},
			],
			page: 2,
			pageSize: 1,
			total: 2,
		});
		const sent = sentQuery(requests[0]);
		expect(sent.read_only).toBe(true);
		expect(sent.query).toContain(
			"from auth.users u order by u.created_at desc limit 1 offset 1",
		);
		expect(sent.query).toContain("raw_app_meta_data->>'provider'");
	});

	it("answers one sign-up count per day and caches it", async () => {
		const { service, requests } = fixture({
			answers: [
				jsonResponse(
					201,
					JSON.stringify([
						{ date: "2026-08-19", count: 0 },
						{ date: "2026-09-17", count: 3 },
					]),
				),
			],
		});

		const answer = await service.listSignups(SCOPE, PROJECT_ID);
		await service.listSignups(SCOPE, PROJECT_ID);

		expect(cloudSignupsResponseSchema.parse(answer)).toEqual({
			days: [
				{ count: 0, date: "2026-08-19" },
				{ count: 3, date: "2026-09-17" },
			],
		});
		expect(requests).toHaveLength(1);
		expect(sentQuery(requests[0]).query).toContain("interval '29 days'");
	});
});

describe("CloudService storage routes", () => {
	const OBJECTS_ANSWER = JSON.stringify([
		{ name: "2026", id: null, updated_at: null, metadata: null },
		{
			name: "a.png",
			id: "obj-1",
			updated_at: "2026-09-17T10:00:00.000Z",
			metadata: { size: 12, mimetype: "image/png" },
		},
	]);
	const SIGNED_ANSWER = JSON.stringify([
		{
			path: "users/a.png",
			signedURL: "/object/sign/avatars/users/a.png?token=t1",
			error: null,
		},
	]);

	it("lists the buckets", async () => {
		const { service } = fixture({
			answers: [
				jsonResponse(
					200,
					JSON.stringify([
						{
							id: "avatars",
							name: "avatars",
							public: false,
							created_at: "2026-09-17T10:00:00.000Z",
							updated_at: "2026-09-17T10:00:00.000Z",
						},
					]),
				),
			],
		});

		const answer = await service.listBuckets(SCOPE, PROJECT_ID);

		expect(cloudBucketsResponseSchema.parse(answer)).toEqual({
			buckets: [
				{
					createdAt: "2026-09-17T10:00:00.000Z",
					id: "avatars",
					name: "avatars",
					public: false,
					updatedAt: "2026-09-17T10:00:00.000Z",
				},
			],
		});
	});

	it("lists objects with a signed URL per file and none per folder", async () => {
		const { service, requests } = fixture({
			answers: [
				jsonResponse(200, API_KEYS_ANSWER),
				jsonResponse(200, OBJECTS_ANSWER),
				jsonResponse(200, SIGNED_ANSWER),
			],
		});

		const answer = await service.listObjects(SCOPE, PROJECT_ID, "avatars", {
			prefix: "users/",
		});

		expect(cloudObjectsResponseSchema.parse(answer)).toEqual({
			items: [
				{
					downloadUrl: null,
					isFolder: true,
					mimeType: null,
					name: "2026",
					path: "users/2026",
					sizeBytes: null,
					updatedAt: null,
				},
				{
					downloadUrl: `${STORAGE}/object/sign/avatars/users/a.png?token=t1`,
					isFolder: false,
					mimeType: "image/png",
					name: "a.png",
					path: "users/a.png",
					sizeBytes: 12,
					updatedAt: "2026-09-17T10:00:00.000Z",
				},
			],
			nextCursor: null,
		});
		expect(requests.map((request) => request.url)).toEqual([
			`${API}/projects/${REF}/api-keys?reveal=true`,
			`${STORAGE}/object/list/avatars`,
			`${STORAGE}/object/sign/avatars`,
		]);
		// The storage calls carry the service-role key; the answer never does.
		expect(requests[1]?.headers.apikey).toBe(SERVICE_ROLE_KEY);
		expect(requests[2]?.body).toBe(
			JSON.stringify({ expiresIn: 600, paths: ["users/a.png"] }),
		);
		expect(JSON.stringify(answer)).not.toContain(SERVICE_ROLE_KEY);
	});

	it("answers the next cursor when the page is full and skips the sign call on folders only", async () => {
		const folders = Array.from({ length: 100 }, (_, index) => ({
			name: `f${index}`,
			id: null,
			updated_at: null,
			metadata: null,
		}));
		const { service, requests } = fixture({
			answers: [
				jsonResponse(200, API_KEYS_ANSWER),
				jsonResponse(200, JSON.stringify(folders)),
			],
		});

		const answer = await service.listObjects(SCOPE, PROJECT_ID, "avatars", {
			cursor: "100",
			prefix: "",
		});

		expect(answer.nextCursor).toBe("200");
		expect(requests).toHaveLength(2);
		expect(requests[1]?.body).toContain('"offset":100');
	});

	it("answers a signed upload URL", async () => {
		const { service } = fixture({
			answers: [
				jsonResponse(200, API_KEYS_ANSWER),
				jsonResponse(
					200,
					JSON.stringify({
						url: "/object/upload/sign/avatars/new.png?token=t2",
					}),
				),
			],
		});

		const answer = await service.createUploadUrl(SCOPE, PROJECT_ID, "avatars", {
			path: "new.png",
		});

		expect(answer).toEqual({
			path: "new.png",
			uploadUrl: `${STORAGE}/object/upload/sign/avatars/new.png?token=t2`,
		});
	});

	it("deletes objects and writes an audit row with the bucket and the counts", async () => {
		const { service, requests, audits } = fixture({
			answers: [
				jsonResponse(200, API_KEYS_ANSWER),
				jsonResponse(200, JSON.stringify([{ name: "a.png" }])),
			],
		});

		const answer = await service.deleteObjects(SCOPE, PROJECT_ID, "avatars", {
			paths: ["a.png", "gone.png"],
		});

		expect(answer).toEqual({ deleted: 1 });
		expect(requests[1]).toMatchObject({
			body: JSON.stringify({ prefixes: ["a.png", "gone.png"] }),
			method: "DELETE",
			url: `${STORAGE}/object/avatars`,
		});
		expect(audits).toEqual([
			{
				action: "cloud.objects_deleted",
				actorUserId: "user-1",
				metadata: { bucket: "avatars", deleted: 1, requested: 2 },
				organizationId: "org-1",
				projectId: PROJECT_ID,
				targetId: "backend-1",
				targetType: "app_backend",
			},
		]);
	});
});

describe("CloudService.queryLogs", () => {
	const WINDOW = {
		end: "2026-09-17T02:00:00.000Z",
		start: "2026-09-17T01:00:00.000Z",
	};

	it("answers 400 WINDOW_TOO_LARGE above 24 hours without a call", async () => {
		const { service, requests } = fixture();

		expect(
			await rejection(
				service.queryLogs(SCOPE, PROJECT_ID, {
					end: "2026-09-18T01:00:01.000Z",
					source: "api",
					start: "2026-09-17T00:00:00.000Z",
				}),
			),
		).toEqual({ code: "WINDOW_TOO_LARGE", status: 400 });
		expect(
			await rejection(
				service.queryLogs(SCOPE, PROJECT_ID, {
					end: WINDOW.start,
					source: "api",
					start: WINDOW.end,
				}),
			),
		).toEqual({ code: "VALIDATION_ERROR", status: 400 });
		expect(requests).toHaveLength(0);
	});

	it("reads edge_logs inside the window and maps status codes to levels", async () => {
		const { service, requests, rateLimiter } = fixture({
			answers: [
				jsonResponse(
					200,
					JSON.stringify({
						result: [
							{
								id: "l-1",
								timestamp: 1_789_000_000_000_000,
								event_message: "GET /rest/v1/users",
								level_value: 503,
							},
							{
								id: "l-2",
								timestamp: "2026-09-17T01:30:00.000Z",
								event_message: null,
								level_value: 404,
							},
						],
					}),
				),
			],
		});

		const answer = await service.queryLogs(SCOPE, PROJECT_ID, {
			...WINDOW,
			source: "api",
		});

		expect(cloudLogsResponseSchema.parse(answer)).toEqual({
			entries: [
				{
					id: "l-1",
					level: "error",
					message: "GET /rest/v1/users",
					timestamp: new Date(1_789_000_000_000).toISOString(),
				},
				{
					id: "l-2",
					level: "warning",
					message: "",
					timestamp: "2026-09-17T01:30:00.000Z",
				},
			],
		});
		const url = new URL(requests[0]?.url ?? "");
		expect(url.searchParams.get("iso_timestamp_start")).toBe(WINDOW.start);
		expect(url.searchParams.get("iso_timestamp_end")).toBe(WINDOW.end);
		expect(url.searchParams.get("sql")).toContain("from edge_logs");
		expect(rateLimiter.calls[0]).toEqual({
			bucket: `supabase:rl:logs:${REF}`,
			limitPerMinute: 30,
		});
	});

	it("maps postgres severities to levels", async () => {
		const { service } = fixture({
			answers: [
				jsonResponse(
					200,
					JSON.stringify({
						result: [
							{
								id: "p-1",
								timestamp: 0,
								event_message: "boom",
								level_value: "FATAL",
							},
							{
								id: "p-2",
								timestamp: 0,
								event_message: "hm",
								level_value: "WARNING",
							},
							{
								id: "p-3",
								timestamp: 0,
								event_message: "ok",
								level_value: "LOG",
							},
						],
					}),
				),
			],
		});

		const answer = await service.queryLogs(SCOPE, PROJECT_ID, {
			...WINDOW,
			source: "postgres",
		});

		expect(answer.entries.map((entry) => entry.level)).toEqual([
			"error",
			"warning",
			"info",
		]);
	});
});

describe("buildLogsSql", () => {
	it("filters by level and by an escaped search text, newest first", () => {
		const sql = buildLogsSql({
			end: "2026-09-17T02:00:00.000Z",
			level: "error",
			search: "o'neil\\",
			source: "postgres",
			start: "2026-09-17T01:00:00.000Z",
		});

		expect(sql).toBe(
			"select id, timestamp, event_message, p.error_severity as level_value from postgres_logs cross join unnest(metadata) as m cross join unnest(m.parsed) as p where p.error_severity in ('ERROR', 'FATAL', 'PANIC') and event_message like '%o''neil\\\\%' order by timestamp desc limit 100",
		);
	});

	it("uses the status code column for api and functions", () => {
		expect(
			buildLogsSql({
				end: "2026-09-17T02:00:00.000Z",
				level: "warning",
				source: "functions",
				start: "2026-09-17T01:00:00.000Z",
			}),
		).toContain(
			"from function_edge_logs cross join unnest(metadata) as m cross join unnest(m.response) as r where r.status_code between 400 and 499",
		);
	});
});

describe("CloudService.listFunctions", () => {
	const FUNCTIONS_ANSWER = JSON.stringify([
		{
			id: "fn-1",
			slug: "hello",
			name: "hello",
			status: "ACTIVE",
			version: 3,
			created_at: 1_700_000_000_000,
			updated_at: 1_700_000_100_000,
		},
		{
			id: "fn-2",
			slug: "quiet",
			name: "quiet",
			status: "ACTIVE",
			version: 1,
			created_at: 1_700_000_000_000,
			updated_at: 1_700_000_000_000,
		},
	]);

	it("adds the last deploy time and the 24-hour call counts, cached", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-17T10:00:00.000Z"));
		const { service, requests } = fixture({
			answers: [
				jsonResponse(200, FUNCTIONS_ANSWER),
				jsonResponse(
					200,
					JSON.stringify({
						result: [
							{ function_id: "fn-1", count: 12 },
							{ function_id: null, count: 1 },
						],
					}),
				),
			],
		});

		const answer = await service.listFunctions(SCOPE, PROJECT_ID);
		await service.listFunctions(SCOPE, PROJECT_ID);

		expect(cloudFunctionsResponseSchema.parse(answer)).toEqual({
			functions: [
				{
					id: "fn-1",
					invocations24h: 12,
					lastDeployedAt: "2023-11-14T22:15:00.000Z",
					name: "hello",
					slug: "hello",
					status: "ACTIVE",
					version: 3,
				},
				{
					id: "fn-2",
					invocations24h: 0,
					lastDeployedAt: "2023-11-14T22:13:20.000Z",
					name: "quiet",
					slug: "quiet",
					status: "ACTIVE",
					version: 1,
				},
			],
		});
		expect(requests).toHaveLength(2);
		const url = new URL(requests[1]?.url ?? "");
		expect(url.searchParams.get("iso_timestamp_start")).toBe(
			"2026-09-16T10:00:00.000Z",
		);
		expect(url.searchParams.get("iso_timestamp_end")).toBe(
			"2026-09-17T10:00:00.000Z",
		);
	});

	it("skips the logs call when the project has no function", async () => {
		const { service, requests } = fixture({
			answers: [jsonResponse(200, "[]")],
		});

		const answer = await service.listFunctions(SCOPE, PROJECT_ID);

		expect(answer).toEqual({ functions: [] });
		expect(requests).toHaveLength(1);
	});
});

describe("CloudService.listJobs", () => {
	it("answers installed false without pg_cron and runs no jobs query", async () => {
		const { service, requests } = fixture({
			answers: [jsonResponse(201, JSON.stringify([{ installed: false }]))],
		});

		const answer = await service.listJobs(SCOPE, PROJECT_ID);

		expect(answer).toEqual({ installed: false, jobs: [] });
		expect(requests).toHaveLength(1);
		expect(sentQuery(requests[0]).query).toContain("to_regclass('cron.job')");
	});

	it("maps the jobs with their last runs", async () => {
		const { service, requests } = fixture({
			answers: [
				jsonResponse(201, JSON.stringify([{ installed: true }])),
				jsonResponse(
					201,
					JSON.stringify([
						{
							jobid: 1,
							jobname: "nightly",
							schedule: "0 3 * * *",
							command: "call cleanup()",
							active: true,
							runs: [
								{
									runid: 9,
									status: "succeeded",
									start_time: "2026-09-17T03:00:00.000Z",
									end_time: "2026-09-17T03:00:01.000Z",
									return_message: "CALL",
								},
							],
						},
					]),
				),
			],
		});

		const answer = await service.listJobs(SCOPE, PROJECT_ID);

		expect(cloudJobsResponseSchema.parse(answer)).toEqual({
			installed: true,
			jobs: [
				{
					active: true,
					command: "call cleanup()",
					jobId: 1,
					name: "nightly",
					runs: [
						{
							endTime: "2026-09-17T03:00:01.000Z",
							returnMessage: "CALL",
							runId: 9,
							startTime: "2026-09-17T03:00:00.000Z",
							status: "succeeded",
						},
					],
					schedule: "0 3 * * *",
				},
			],
		});
		expect(sentQuery(requests[1]).query).toContain("limit 20");
	});
});

describe("quoteIdentifier", () => {
	it("wraps the name in double quotes and doubles inner quotes", () => {
		expect(quoteIdentifier("users")).toBe('"users"');
		expect(quoteIdentifier('we"ird')).toBe('"we""ird"');
	});
});
