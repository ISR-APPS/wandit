import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import {
	jsonResponse,
	type RecordedRequest,
	scriptedFetch,
} from "./fake-supabase-fetch";
import { FakeSupabaseRateLimiter } from "./fake-supabase-rate-limiter";
import {
	type BackendRef,
	SupabaseManagementClient,
	SupabaseManagementError,
	SupabaseRateLimitedError,
	supabaseWorkerClientFromEnv,
} from "./supabase-management.client";

const TOKEN = "sbp_test_token";
const ORG_SLUG = "wandit-org";
const PROJECT_ID = "proj_1";
const REF = "abcdefghijklmnopqrst";
const SCOPE: BackendRef = { projectId: PROJECT_ID, ref: REF };

// The documented V1ProjectResponse shape of a created project.
const CREATED_PROJECT = {
	id: "bzkkgknsgekeqhgbbnze",
	ref: REF,
	organization_id: "org_123",
	organization_slug: ORG_SLUG,
	name: `wandit-${PROJECT_ID}`,
	region: "eu-central-1",
	created_at: "2026-09-16T12:00:00.000Z",
	status: "INACTIVE",
};

// GET /projects/{ref} adds the database block to the create shape.
const PROJECT_WITH_DB = {
	...CREATED_PROJECT,
	status: "ACTIVE_HEALTHY",
	database: {
		host: "db.abcdefghijklmnopqrst.supabase.co",
		version: "17.6",
		postgres_engine: "17",
		release_channel: "ga",
	},
};

type RecordedWarning = {
	message: string;
	fields: Record<string, string>;
};

function makeClient(
	answers: (Response | Error)[],
	options?: {
		rateLimiter?: FakeSupabaseRateLimiter;
		ownsRef?: (projectId: string, ref: string) => Promise<boolean>;
		/** Composes the client the way the API does; default false (the worker). */
		interactive?: boolean;
	},
) {
	const requests: RecordedRequest[] = [];
	const sleeps: number[] = [];
	const warnings: RecordedWarning[] = [];
	const ownsRefCalls: BackendRef[] = [];
	const rateLimiter = options?.rateLimiter ?? new FakeSupabaseRateLimiter();
	const logger: SandboxLogger = {
		error: () => undefined,
		info: () => undefined,
		warn: (message, fields) => {
			warnings.push({ message, fields });
		},
	};
	const client = new SupabaseManagementClient({
		token: TOKEN,
		organizationSlug: ORG_SLUG,
		fetch: scriptedFetch(answers, requests),
		rateLimiter,
		ownsRef:
			options?.ownsRef ??
			((projectId, ref) => {
				ownsRefCalls.push({ projectId, ref });
				return Promise.resolve(true);
			}),
		sleep: (ms) => {
			sleeps.push(ms);
			return Promise.resolve();
		},
		logger,
		interactive: options?.interactive,
	});
	return { client, requests, sleeps, warnings, rateLimiter, ownsRefCalls };
}

describe("SupabaseManagementClient.createProject", () => {
	it("posts /projects with the bearer token and answers ref and orgId", async () => {
		const fixture = makeClient([
			jsonResponse(201, JSON.stringify(CREATED_PROJECT)),
		]);

		const result = await fixture.client.createProject({
			projectId: PROJECT_ID,
			region: "eu-central-1",
			dbPassword: "db-password-1",
			instanceSize: "micro",
		});

		expect(result).toEqual({ ref: REF, orgId: "org_123" });
		expect(fixture.requests).toHaveLength(1);
		const request = fixture.requests[0];
		expect(request?.url).toBe("https://api.supabase.com/v1/projects");
		expect(request?.method).toBe("POST");
		expect(request?.headers.authorization).toBe(`Bearer ${TOKEN}`);
		expect(JSON.parse(request?.body ?? "null")).toEqual({
			name: `wandit-${PROJECT_ID}`,
			organization_slug: ORG_SLUG,
			db_pass: "db-password-1",
			region: "eu-central-1",
			desired_instance_size: "micro",
		});
		expect(fixture.rateLimiter.calls).toEqual([
			{ bucket: "supabase:rl:org", limitPerMinute: 120 },
		]);
	});
});

describe("SupabaseManagementClient.getProject", () => {
	it("answers the status and the database host", async () => {
		const fixture = makeClient([
			jsonResponse(200, JSON.stringify(PROJECT_WITH_DB)),
		]);

		const result = await fixture.client.getProject(SCOPE);

		expect(result).toEqual({
			status: "ACTIVE_HEALTHY",
			dbHost: "db.abcdefghijklmnopqrst.supabase.co",
		});
		expect(fixture.requests[0]?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}`,
		);
		expect(fixture.rateLimiter.calls).toEqual([
			{ bucket: `supabase:rl:project:${REF}`, limitPerMinute: 120 },
		]);
		expect(fixture.ownsRefCalls).toEqual([{ projectId: PROJECT_ID, ref: REF }]);
	});

	it("checks ownership once per projectId:ref pair", async () => {
		const fixture = makeClient([
			jsonResponse(200, JSON.stringify(PROJECT_WITH_DB)),
			jsonResponse(200, JSON.stringify(PROJECT_WITH_DB)),
		]);

		await fixture.client.getProject(SCOPE);
		await fixture.client.getProject(SCOPE);

		expect(fixture.ownsRefCalls).toHaveLength(1);
		expect(fixture.requests).toHaveLength(2);
	});
});

describe("SupabaseManagementClient.getApiKeys", () => {
	it("picks the anon entry", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify([
					{ name: "service_role", api_key: "srv-key" },
					{ name: "anon", api_key: "anon-key-1" },
				]),
			),
		]);

		await expect(fixture.client.getApiKeys(SCOPE)).resolves.toEqual({
			anonKey: "anon-key-1",
		});
		expect(fixture.requests[0]?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,
		);
	});

	it("falls back to the publishable entry when no anon entry exists", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify([
					{ name: "publishable", type: "publishable", api_key: "pub-1" },
				]),
			),
		]);

		await expect(fixture.client.getApiKeys(SCOPE)).resolves.toEqual({
			anonKey: "pub-1",
		});
	});

	it("throws when no entry carries a key", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify([{ name: "service_role", api_key: "srv-key" }]),
			),
		]);

		const failure = await fixture.client
			.getApiKeys(SCOPE)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		// SAFETY: toBeInstanceOf above proves the type.
		const managementError = failure as SupabaseManagementError;
		expect(managementError.status).toBe(200);
		expect(managementError.detail).toBe("no anon key in the api-keys answer");
	});
});

describe("SupabaseManagementClient retries", () => {
	it("waits X-RateLimit-Reset seconds on a 429 and retries", async () => {
		const fixture = makeClient([
			jsonResponse(429, JSON.stringify({ message: "rate limited" }), {
				"x-ratelimit-reset": "2",
			}),
			jsonResponse(200, JSON.stringify(PROJECT_WITH_DB)),
		]);

		await expect(fixture.client.getProject(SCOPE)).resolves.toBeDefined();

		expect(fixture.sleeps).toEqual([2_000]);
		expect(fixture.requests).toHaveLength(2);
		expect(fixture.warnings[0]?.message).toBe("supabase.management.retry");
		expect(fixture.warnings[0]?.fields.status).toBe("429");
	});

	it("reads a unix-time X-RateLimit-Reset as seconds until reset", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
		const fixture = makeClient([
			jsonResponse(429, JSON.stringify({ message: "rate limited" }), {
				// 3 s after the frozen clock; the unix-time branch subtracts now.
				"x-ratelimit-reset": String(Math.floor(Date.now() / 1_000) + 3),
			}),
			jsonResponse(200, JSON.stringify(PROJECT_WITH_DB)),
		]);

		await expect(fixture.client.getProject(SCOPE)).resolves.toBeDefined();

		expect(fixture.sleeps).toEqual([3_000]);
		vi.useRealTimers();
	});

	it("caps the 429 wait at 60 s", async () => {
		const fixture = makeClient([
			jsonResponse(429, JSON.stringify({ message: "rate limited" }), {
				// The header asks for 120 s; the 60 s cap wins.
				"x-ratelimit-reset": "120",
			}),
			jsonResponse(200, JSON.stringify(PROJECT_WITH_DB)),
		]);

		await expect(fixture.client.getProject(SCOPE)).resolves.toBeDefined();

		expect(fixture.sleeps).toEqual([60_000]);
	});

	it("waits the 5 s fallback on a 429 without X-RateLimit-Reset", async () => {
		const fixture = makeClient([
			jsonResponse(429, JSON.stringify({ message: "rate limited" })),
			jsonResponse(200, JSON.stringify(PROJECT_WITH_DB)),
		]);

		await expect(fixture.client.getProject(SCOPE)).resolves.toBeDefined();

		expect(fixture.sleeps).toEqual([5_000]);
	});

	it("backs off on 5xx and throws after the fifth failure", async () => {
		const fixture = makeClient(
			Array.from({ length: 5 }, () =>
				jsonResponse(503, JSON.stringify({ message: "unavailable" })),
			),
		);

		const failure = await fixture.client
			.getProject(SCOPE)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		// SAFETY: toBeInstanceOf above proves the type.
		expect((failure as SupabaseManagementError).status).toBe(503);
		expect(fixture.sleeps).toEqual([1_000, 2_000, 4_000, 8_000]);
		expect(fixture.requests).toHaveLength(5);
	});

	it("retries a thrown fetch like a 5xx", async () => {
		const fixture = makeClient([
			new Error("socket hangup"),
			jsonResponse(200, JSON.stringify(PROJECT_WITH_DB)),
		]);

		await expect(fixture.client.getProject(SCOPE)).resolves.toBeDefined();

		expect(fixture.sleeps).toEqual([1_000]);
		expect(fixture.requests).toHaveLength(2);
	});

	it("throws at once on a 403 with the body message and the request id", async () => {
		const fixture = makeClient([
			jsonResponse(403, JSON.stringify({ message: "forbidden action" }), {
				"x-request-id": "req_9",
			}),
		]);

		const failure = await fixture.client
			.getProject(SCOPE)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		// SAFETY: toBeInstanceOf above proves the type.
		const managementError = failure as SupabaseManagementError;
		expect(managementError.status).toBe(403);
		expect(managementError.detail).toBe("forbidden action");
		expect(managementError.requestId).toBe("req_9");
		expect(fixture.requests).toHaveLength(1);
	});
});

describe("SupabaseManagementClient guards", () => {
	it("refuses a ref of another project before any fetch", async () => {
		const fixture = makeClient([], {
			ownsRef: () => Promise.resolve(false),
		});

		const failure = await fixture.client
			.getProject(SCOPE)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		// SAFETY: toBeInstanceOf above proves the type.
		const managementError = failure as SupabaseManagementError;
		expect(managementError.status).toBeNull();
		expect(managementError.detail).toBe("ref does not belong to project");
		expect(fixture.requests).toHaveLength(0);
	});

	it("throws 'unexpected response body' when the answer fails the schema", async () => {
		const fixture = makeClient([
			jsonResponse(200, JSON.stringify({ unexpected: true })),
		]);

		const failure = await fixture.client
			.getProject(SCOPE)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		// SAFETY: toBeInstanceOf above proves the type.
		const managementError = failure as SupabaseManagementError;
		expect(managementError.detail).toBe("unexpected response body");
		expect(managementError.status).toBe(200);
	});

	it("sleeps the limiter wait before the call", async () => {
		const fixture = makeClient(
			[jsonResponse(200, JSON.stringify(PROJECT_WITH_DB))],
			{ rateLimiter: new FakeSupabaseRateLimiter([1_500]) },
		);

		await fixture.client.getProject(SCOPE);

		expect(fixture.sleeps).toEqual([1_500]);
		expect(fixture.requests).toHaveLength(1);
	});

	it("fails the call after five limiter waits, before any fetch", async () => {
		const fixture = makeClient([], {
			// Five waits sleep; the sixth take throws "rate limit wait exceeded".
			rateLimiter: new FakeSupabaseRateLimiter([1, 1, 1, 1, 1, 1]),
		});

		const failure = await fixture.client
			.getProject(SCOPE)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		// SAFETY: toBeInstanceOf above proves the type.
		const managementError = failure as SupabaseManagementError;
		expect(managementError.detail).toBe("rate limit wait exceeded");
		expect(managementError.status).toBeNull();
		expect(fixture.sleeps).toHaveLength(5);
		expect(fixture.requests).toHaveLength(0);
	});
});

describe("SupabaseManagementClient.updateAuthConfig", () => {
	it("joins the allow list with a comma", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify({
					site_url: "https://preview.example",
					uri_allow_list: "https://a,https://b",
					external_email_enabled: true,
				}),
			),
		]);

		await fixture.client.updateAuthConfig(SCOPE, {
			siteUrl: "https://preview.example",
			uriAllowList: ["https://a", "https://b"],
			externalEmailEnabled: true,
		});

		expect(fixture.requests[0]?.method).toBe("PATCH");
		expect(fixture.requests[0]?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}/config/auth`,
		);
		expect(JSON.parse(fixture.requests[0]?.body ?? "null")).toEqual({
			site_url: "https://preview.example",
			uri_allow_list: "https://a,https://b",
			external_email_enabled: true,
		});
	});
});

describe("SupabaseManagementClient.runSql", () => {
	it("posts the query and reads no body", async () => {
		// A non-JSON body proves the client does not parse the answer.
		const fixture = makeClient([new Response("not json", { status: 201 })]);

		await expect(
			fixture.client.runSql(SCOPE, "select 1"),
		).resolves.toBeUndefined();

		expect(fixture.requests[0]?.method).toBe("POST");
		expect(fixture.requests[0]?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}/database/query`,
		);
		expect(JSON.parse(fixture.requests[0]?.body ?? "null")).toEqual({
			query: "select 1",
		});
	});
});

// The Cloud routes (WANDIT-187) compose the client with `interactive: true`.
describe("SupabaseManagementClient in interactive mode", () => {
	it("throws SupabaseRateLimitedError at once when the bucket is full", async () => {
		const fixture = makeClient([], {
			interactive: true,
			rateLimiter: new FakeSupabaseRateLimiter([15_000]),
		});

		const failure = await fixture.client.listBuckets(SCOPE).then(
			() => null,
			(error: unknown) => error,
		);

		expect(failure).toBeInstanceOf(SupabaseRateLimitedError);
		// SAFETY: the line above checks the instance.
		expect((failure as SupabaseRateLimitedError).retryAfterMs).toBe(15_000);
		expect(fixture.requests).toHaveLength(0);
		expect(fixture.sleeps).toEqual([]);
	});

	it("turns an upstream 429 into SupabaseRateLimitedError with the reset wait", async () => {
		const fixture = makeClient(
			[jsonResponse(429, "{}", { "x-ratelimit-reset": "12" })],
			{ interactive: true },
		);

		const failure = await fixture.client.listBuckets(SCOPE).then(
			() => null,
			(error: unknown) => error,
		);

		expect(failure).toBeInstanceOf(SupabaseRateLimitedError);
		// SAFETY: the line above checks the instance.
		expect((failure as SupabaseRateLimitedError).retryAfterMs).toBe(12_000);
		expect(fixture.requests).toHaveLength(1);
	});

	it("retries a 5xx once, then fails", async () => {
		const fixture = makeClient(
			[jsonResponse(502, "{}"), jsonResponse(503, "{}")],
			{ interactive: true },
		);

		await expect(fixture.client.listBuckets(SCOPE)).rejects.toMatchObject({
			status: 503,
		});
		expect(fixture.requests).toHaveLength(2);
		expect(fixture.sleeps).toEqual([1_000]);
	});
});

describe("SupabaseManagementClient.runQuery", () => {
	it("posts the query with read_only and parses the rows with the schema", async () => {
		const fixture = makeClient([
			jsonResponse(201, JSON.stringify([{ count: 3 }])),
		]);

		const rows = await fixture.client.runQuery(SCOPE, {
			readOnly: true,
			rowSchema: z.object({ count: z.number() }),
			sql: "select count(*)::float8 as count from t",
		});

		expect(rows).toEqual([{ count: 3 }]);
		expect(fixture.requests[0]).toMatchObject({
			body: JSON.stringify({
				query: "select count(*)::float8 as count from t",
				read_only: true,
			}),
			method: "POST",
			url: `https://api.supabase.com/v1/projects/${REF}/database/query`,
		});
	});

	it("sends a write once: a 502 after a possible commit gets no retry", async () => {
		const fixture = makeClient([
			jsonResponse(502, JSON.stringify({ message: "bad gateway" })),
			jsonResponse(201, "[]"),
		]);

		await expect(
			fixture.client.runQuery(SCOPE, {
				readOnly: false,
				rowSchema: z.object({ id: z.number() }),
				sql: "insert into t (id) values (1)",
			}),
		).rejects.toMatchObject({ status: 502 });
		expect(fixture.requests).toHaveLength(1);
		expect(fixture.sleeps).toEqual([]);
	});

	it("fails when a row does not fit the schema", async () => {
		const fixture = makeClient([
			jsonResponse(201, JSON.stringify([{ count: "three" }])),
		]);

		await expect(
			fixture.client.runQuery(SCOPE, {
				readOnly: true,
				rowSchema: z.object({ count: z.number() }),
				sql: "select 1",
			}),
		).rejects.toMatchObject({ detail: "unexpected response body" });
	});
});

describe("SupabaseManagementClient.getServiceRoleKey", () => {
	it("picks the legacy service_role entry, else the first secret key", async () => {
		const legacy = makeClient([
			jsonResponse(
				200,
				JSON.stringify([
					{ name: "anon", api_key: "anon-1" },
					{ name: "service_role", api_key: "service-1" },
				]),
			),
		]);
		await expect(legacy.client.getServiceRoleKey(SCOPE)).resolves.toBe(
			"service-1",
		);
		expect(legacy.requests[0]?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,
		);

		const modern = makeClient([
			jsonResponse(
				200,
				JSON.stringify([
					{ name: "default", api_key: "sb_publishable_1", type: "publishable" },
					{ name: "default", api_key: "sb_secret_1", type: "secret" },
				]),
			),
		]);
		await expect(modern.client.getServiceRoleKey(SCOPE)).resolves.toBe(
			"sb_secret_1",
		);
	});

	it("throws when no entry carries a secret key", async () => {
		const fixture = makeClient([
			jsonResponse(200, JSON.stringify([{ name: "anon", api_key: "anon-1" }])),
		]);

		await expect(fixture.client.getServiceRoleKey(SCOPE)).rejects.toMatchObject(
			{ detail: "no service-role key in the api-keys answer" },
		);
	});
});

describe("SupabaseManagementClient project reads", () => {
	it("restores, lists buckets, and lists functions on the project bucket", async () => {
		const fixture = makeClient([
			jsonResponse(200, "{}"),
			jsonResponse(
				200,
				JSON.stringify([
					{
						id: "avatars",
						name: "avatars",
						public: true,
						created_at: "2026-09-17T10:00:00.000Z",
						updated_at: "2026-09-17T10:00:00.000Z",
						owner: "",
					},
				]),
			),
			jsonResponse(
				200,
				JSON.stringify([
					{
						id: "fn-1",
						slug: "hello",
						name: "hello",
						status: "ACTIVE",
						version: 3,
						created_at: 1_700_000_000_000,
						updated_at: 1_700_000_100_000,
						verify_jwt: true,
					},
				]),
			),
		]);

		await fixture.client.restoreProject(SCOPE);
		const buckets = await fixture.client.listBuckets(SCOPE);
		const functions = await fixture.client.listFunctions(SCOPE);

		expect(buckets).toEqual([
			{
				created_at: "2026-09-17T10:00:00.000Z",
				id: "avatars",
				name: "avatars",
				public: true,
				updated_at: "2026-09-17T10:00:00.000Z",
			},
		]);
		expect(functions[0]).toMatchObject({ id: "fn-1", version: 3 });
		expect(fixture.requests.map((request) => request.url)).toEqual([
			`https://api.supabase.com/v1/projects/${REF}/restore`,
			`https://api.supabase.com/v1/projects/${REF}/storage/buckets`,
			`https://api.supabase.com/v1/projects/${REF}/functions`,
		]);
		expect(fixture.requests[0]?.method).toBe("POST");
		expect(
			fixture.rateLimiter.calls.every(
				(call) =>
					call.bucket === `supabase:rl:project:${REF}` &&
					call.limitPerMinute === 120,
			),
		).toBe(true);
	});
});

describe("SupabaseManagementClient.pauseProject", () => {
	it("posts /projects/{ref}/pause on the project bucket", async () => {
		const fixture = makeClient([jsonResponse(200, "{}")]);

		await fixture.client.pauseProject(SCOPE);

		expect(fixture.requests).toHaveLength(1);
		expect(fixture.requests[0]?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}/pause`,
		);
		expect(fixture.requests[0]?.method).toBe("POST");
		expect(fixture.rateLimiter.calls).toEqual([
			{ bucket: `supabase:rl:project:${REF}`, limitPerMinute: 120 },
		]);
		expect(fixture.ownsRefCalls).toEqual([SCOPE]);
	});

	it("refuses a ref of another project before any fetch", async () => {
		const fixture = makeClient([], { ownsRef: () => Promise.resolve(false) });

		await expect(fixture.client.pauseProject(SCOPE)).rejects.toThrow(
			SupabaseManagementError,
		);
		expect(fixture.requests).toHaveLength(0);
	});

	it("retries after a 429", async () => {
		const fixture = makeClient([
			jsonResponse(429, "{}", { "x-ratelimit-reset": "2" }),
			jsonResponse(200, "{}"),
		]);

		await fixture.client.pauseProject(SCOPE);

		expect(fixture.requests).toHaveLength(2);
		expect(fixture.sleeps).toEqual([2_000]);
	});

	it("throws at once on a 403", async () => {
		const fixture = makeClient([
			jsonResponse(403, JSON.stringify({ message: "forbidden action" })),
		]);

		const failure = await fixture.client
			.pauseProject(SCOPE)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		// SAFETY: toBeInstanceOf above proves the type.
		expect((failure as SupabaseManagementError).status).toBe(403);
		expect(fixture.requests).toHaveLength(1);
	});
});

describe("supabaseWorkerClientFromEnv", () => {
	const logger: SandboxLogger = {
		error: () => undefined,
		info: () => undefined,
		warn: () => undefined,
	};
	const complete = {
		SUPABASE_PLATFORM_ORG_ID: ORG_SLUG,
		SUPABASE_PLATFORM_TOKEN: TOKEN,
		V2_HARNESS: "claude-code",
	} as const;
	// The row of the project holds another ref, so the ownership check fails.
	const otherRow = {
		findByProjectId: async () => null,
	};

	it.each([
		"SUPABASE_PLATFORM_TOKEN",
		"SUPABASE_PLATFORM_ORG_ID",
	] as const)("answers no client without %s", (name) => {
		const { client } = supabaseWorkerClientFromEnv(
			{ ...complete, [name]: undefined },
			otherRow,
			logger,
		);

		expect(client).toBeNull();
	});

	it("refuses a ref the project's row does not hold, before any request", async () => {
		const { client } = supabaseWorkerClientFromEnv(complete, otherRow, logger);
		if (client === null) {
			throw new Error("the factory answered no client");
		}

		await expect(client.deleteProject(SCOPE)).rejects.toThrow(
			`ref ${REF} does not belong to project ${PROJECT_ID}`,
		);
	});
});

describe("SupabaseManagementClient.deleteProject", () => {
	it("sends DELETE /projects/{ref} on the project bucket", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify({ id: 1, name: `wandit-${PROJECT_ID}`, ref: REF }),
			),
		]);

		await fixture.client.deleteProject(SCOPE);

		expect(fixture.requests).toHaveLength(1);
		expect(fixture.requests[0]?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}`,
		);
		expect(fixture.requests[0]?.method).toBe("DELETE");
		expect(fixture.rateLimiter.calls).toEqual([
			{ bucket: `supabase:rl:project:${REF}`, limitPerMinute: 120 },
		]);
	});

	it("counts a 404 as done", async () => {
		const fixture = makeClient([
			jsonResponse(404, JSON.stringify({ message: "project not found" })),
		]);

		await expect(fixture.client.deleteProject(SCOPE)).resolves.toBeUndefined();
		expect(fixture.requests).toHaveLength(1);
	});

	it("refuses a ref of another project before any fetch", async () => {
		const fixture = makeClient([], { ownsRef: () => Promise.resolve(false) });

		await expect(fixture.client.deleteProject(SCOPE)).rejects.toThrow(
			SupabaseManagementError,
		);
		expect(fixture.requests).toHaveLength(0);
	});

	it("retries after a 429", async () => {
		const fixture = makeClient([
			jsonResponse(429, "{}", { "x-ratelimit-reset": "2" }),
			jsonResponse(200, "{}"),
		]);

		await fixture.client.deleteProject(SCOPE);

		expect(fixture.requests).toHaveLength(2);
		expect(fixture.sleeps).toEqual([2_000]);
	});

	it("throws at once on a 403", async () => {
		const fixture = makeClient([
			jsonResponse(403, JSON.stringify({ message: "forbidden action" })),
		]);

		const failure = await fixture.client
			.deleteProject(SCOPE)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		// SAFETY: toBeInstanceOf above proves the type.
		expect((failure as SupabaseManagementError).status).toBe(403);
		expect(fixture.requests).toHaveLength(1);
	});
});

describe("SupabaseManagementClient.queryLogs", () => {
	it("sends the sql and the window as query params on the 30-per-minute logs bucket", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify({ result: [{ id: "log-1", count: 2 }] }),
			),
		]);

		const rows = await fixture.client.queryLogs(SCOPE, {
			endIso: "2026-09-17T01:00:00.000Z",
			rowSchema: z.object({ id: z.string(), count: z.number() }),
			sql: "select id, count(*) as count from edge_logs group by id",
			startIso: "2026-09-17T00:00:00.000Z",
		});

		expect(rows).toEqual([{ count: 2, id: "log-1" }]);
		const url = new URL(fixture.requests[0]?.url ?? "");
		expect(url.pathname).toBe(
			`/v1/projects/${REF}/analytics/endpoints/logs.all`,
		);
		expect(url.searchParams.get("sql")).toBe(
			"select id, count(*) as count from edge_logs group by id",
		);
		expect(url.searchParams.get("iso_timestamp_start")).toBe(
			"2026-09-17T00:00:00.000Z",
		);
		expect(url.searchParams.get("iso_timestamp_end")).toBe(
			"2026-09-17T01:00:00.000Z",
		);
		expect(fixture.rateLimiter.calls).toEqual([
			{ bucket: `supabase:rl:logs:${REF}`, limitPerMinute: 30 },
		]);
	});

	it("fails on an error field in a 200 answer", async () => {
		const fixture = makeClient([
			jsonResponse(200, JSON.stringify({ error: "syntax error near from" })),
		]);

		await expect(
			fixture.client.queryLogs(SCOPE, {
				endIso: "2026-09-17T01:00:00.000Z",
				rowSchema: z.object({ id: z.string() }),
				sql: "select from",
				startIso: "2026-09-17T00:00:00.000Z",
			}),
		).rejects.toMatchObject({ detail: "syntax error near from", status: 200 });
	});
});

describe("SupabaseManagementClient storage calls", () => {
	const STORAGE = { ...SCOPE, serviceRoleKey: "service-role-1" };
	const STORAGE_BASE = `https://${REF}.supabase.co/storage/v1`;

	it("lists objects on the project Storage API with the service-role key", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify([
					{ name: "folder", id: null, updated_at: null, metadata: null },
					{
						name: "a.png",
						id: "obj-1",
						updated_at: "2026-09-17T10:00:00.000Z",
						metadata: { size: 12, mimetype: "image/png" },
					},
				]),
			),
		]);

		const objects = await fixture.client.listObjects(STORAGE, {
			bucket: "avatars",
			limit: 100,
			offset: 0,
			prefix: "users",
		});

		expect(objects).toHaveLength(2);
		expect(fixture.requests[0]).toMatchObject({
			body: JSON.stringify({
				prefix: "users",
				limit: 100,
				offset: 0,
				sortBy: { column: "name", order: "asc" },
			}),
			headers: {
				apikey: "service-role-1",
				authorization: "Bearer service-role-1",
			},
			method: "POST",
			url: `${STORAGE_BASE}/object/list/avatars`,
		});
	});

	it("signs download URLs and answers absolute URLs per path", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify([
					{
						path: "users/a.png",
						signedURL: "/object/sign/avatars/users/a.png?token=t1",
						error: null,
					},
					{ path: "users/missing.png", signedURL: null, error: "not found" },
				]),
			),
		]);

		const urls = await fixture.client.signDownloadUrls(STORAGE, {
			bucket: "avatars",
			expiresInSeconds: 600,
			paths: ["users/a.png", "users/missing.png"],
		});

		expect([...urls.entries()]).toEqual([
			[
				"users/a.png",
				`${STORAGE_BASE}/object/sign/avatars/users/a.png?token=t1`,
			],
		]);
		expect(fixture.requests[0]).toMatchObject({
			body: JSON.stringify({
				expiresIn: 600,
				paths: ["users/a.png", "users/missing.png"],
			}),
			url: `${STORAGE_BASE}/object/sign/avatars`,
		});
	});

	it("signs an upload URL with each path segment encoded", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify({
					url: "/object/upload/sign/avatars/users/new%20file.png?token=t2",
				}),
			),
		]);

		const uploadUrl = await fixture.client.createUploadUrl(STORAGE, {
			bucket: "avatars",
			path: "users/new file.png",
		});

		expect(uploadUrl).toBe(
			`${STORAGE_BASE}/object/upload/sign/avatars/users/new%20file.png?token=t2`,
		);
		expect(fixture.requests[0]?.url).toBe(
			`${STORAGE_BASE}/object/upload/sign/avatars/users/new%20file.png`,
		);
	});

	it("deletes objects and counts the removed entries", async () => {
		const fixture = makeClient([
			jsonResponse(200, JSON.stringify([{ name: "users/a.png" }])),
		]);

		const deleted = await fixture.client.deleteObjects(STORAGE, {
			bucket: "avatars",
			paths: ["users/a.png", "users/b.png"],
		});

		expect(deleted).toBe(1);
		expect(fixture.requests[0]).toMatchObject({
			body: JSON.stringify({ prefixes: ["users/a.png", "users/b.png"] }),
			method: "DELETE",
			url: `${STORAGE_BASE}/object/avatars`,
		});
	});
});

describe("SupabaseManagementClient.deployFunction", () => {
	it("posts one multipart file part per file and the metadata field", async () => {
		const fixture = makeClient([
			jsonResponse(
				201,
				JSON.stringify({
					id: "fn-1",
					slug: "hello-world",
					name: "hello-world",
					status: "ACTIVE",
					version: 2,
					entrypoint_path: "index.ts",
				}),
			),
		]);
		const encoder = new TextEncoder();

		const deployed = await fixture.client.deployFunction(SCOPE, {
			entrypointPath: "index.ts",
			files: [
				{
					content: encoder.encode("Deno.serve(() => new Response('hi'));"),
					path: "index.ts",
				},
				{ content: encoder.encode("export const cors = {};"), path: "cors.ts" },
			],
			slug: "hello-world",
		});

		expect(deployed).toEqual({
			id: "fn-1",
			name: "hello-world",
			slug: "hello-world",
			status: "ACTIVE",
			version: 2,
		});
		const request = fixture.requests[0];
		expect(request?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=hello-world`,
		);
		expect(request?.method).toBe("POST");
		expect(request?.headers["content-type"]).toBeUndefined();
		const form = request?.form;
		expect(JSON.parse(String(form?.get("metadata")))).toEqual({
			entrypoint_path: "index.ts",
			name: "hello-world",
		});
		const files = form?.getAll("file") ?? [];
		expect(
			files.map((file) => (file instanceof File ? file.name : null)),
		).toEqual(["index.ts", "cors.ts"]);
		const first = files[0];
		expect(first instanceof File ? await first.text() : null).toBe(
			"Deno.serve(() => new Response('hi'));",
		);
		expect(fixture.rateLimiter.calls).toEqual([
			{ bucket: `supabase:rl:project:${REF}`, limitPerMinute: 120 },
		]);
	});
});

describe("SupabaseManagementClient.bulkCreateSecrets", () => {
	it("sends the names and the values as one array and leaves the answer unread", async () => {
		const fixture = makeClient([jsonResponse(201, "")]);

		await fixture.client.bulkCreateSecrets(SCOPE, [
			{ name: "STRIPE_SECRET_KEY", value: "sk_test_value_1" },
		]);

		expect(fixture.requests[0]).toMatchObject({
			method: "POST",
			url: `https://api.supabase.com/v1/projects/${REF}/secrets`,
		});
		expect(JSON.parse(fixture.requests[0]?.body ?? "null")).toEqual([
			{ name: "STRIPE_SECRET_KEY", value: "sk_test_value_1" },
		]);
	});

	it("keeps the value out of the error when the upstream echoes it", async () => {
		const value = "sk_test_value_echoed";
		const fixture = makeClient([
			jsonResponse(
				400,
				JSON.stringify({ message: `invalid secret value ${value}` }),
			),
		]);

		const failure = await fixture.client
			.bulkCreateSecrets(SCOPE, [{ name: "API_KEY", value }])
			.then(
				() => null,
				(error: unknown) => error,
			);

		expect(failure).toBeInstanceOf(SupabaseManagementError);
		if (!(failure instanceof SupabaseManagementError)) {
			throw new Error("expected a SupabaseManagementError");
		}
		expect(failure.status).toBe(400);
		expect(failure.detail).toBe(
			"Supabase refused the secrets call with HTTP 400",
		);
		expect(failure.message).not.toContain(value);
		expect(JSON.stringify(fixture.warnings)).not.toContain(value);
		// The recorded request is the only place the value appears.
		expect(fixture.requests[0]?.body).toContain(value);
	});
});

describe("SupabaseManagementClient.bulkCreateSecrets rate limit", () => {
	it("keeps the rate-limit error, so the tool answers rate_limited", async () => {
		const fixture = makeClient([jsonResponse(429, "{}")], {
			interactive: true,
		});

		await expect(
			fixture.client.bulkCreateSecrets(SCOPE, [
				{ name: "API_KEY", value: "sk_test_value_2" },
			]),
		).rejects.toBeInstanceOf(SupabaseRateLimitedError);
	});
});

describe("SupabaseManagementClient.getAdvisors", () => {
	it("parses the documented lints answer", async () => {
		const fixture = makeClient([
			jsonResponse(
				200,
				JSON.stringify({
					lints: [
						{
							name: "rls_disabled_in_public",
							title: "RLS Disabled in Public",
							level: "ERROR",
							facing: "EXTERNAL",
							categories: ["SECURITY"],
							description: "Detects tables in public without RLS.",
							detail: "Table `public.notes` is public, but RLS is not enabled.",
							remediation:
								"https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public",
							metadata: { schema: "public", name: "notes", type: "table" },
							cache_key: "rls_disabled_in_public_public_notes",
						},
						{
							name: "auth_leaked_password_protection",
							title: "Leaked Password Protection Disabled",
							level: "INFO",
							facing: "EXTERNAL",
							categories: ["SECURITY"],
							description: "Leaked password protection is off.",
							detail: "Enable leaked password protection.",
							remediation:
								"https://supabase.com/docs/guides/auth/password-security",
							cache_key: "auth_leaked_password_protection",
						},
					],
				}),
			),
		]);

		const lints = await fixture.client.getAdvisors(SCOPE, "security");

		expect(lints).toHaveLength(2);
		expect(lints[0]).toMatchObject({
			level: "ERROR",
			metadata: { name: "notes", schema: "public", type: "table" },
			name: "rls_disabled_in_public",
		});
		expect(fixture.requests[0]?.url).toBe(
			`https://api.supabase.com/v1/projects/${REF}/advisors/security`,
		);
	});

	it("rejects an answer without the lints list", async () => {
		const fixture = makeClient([
			jsonResponse(200, JSON.stringify({ result: [] })),
		]);

		await expect(
			fixture.client.getAdvisors(SCOPE, "performance"),
		).rejects.toMatchObject({
			detail: "unexpected response body",
			name: "SupabaseManagementError",
		});
	});
});
