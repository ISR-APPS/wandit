import { describe, expect, it, vi } from "vitest";

import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import { FakeSupabaseRateLimiter } from "./fake-supabase-rate-limiter";
import {
	type BackendRef,
	SupabaseManagementClient,
	SupabaseManagementError,
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

type RecordedRequest = {
	url: string;
	method: string;
	headers: Record<string, string>;
	body: string | null;
};

type RecordedWarning = {
	message: string;
	fields: Record<string, string>;
};

// Builds a JSON `Response` for the scripted answer queue. `body` is the
// serialized JSON text.
function jsonResponse(
	status: number,
	body: string,
	headers?: Record<string, string>,
): Response {
	return new Response(body, {
		status,
		headers: { "content-type": "application/json", ...headers },
	});
}

// A fetch that records each call and answers the scripted queue in order.
// An `Error` entry rejects the promise, like a network failure.
function scriptedFetch(
	answers: (Response | Error)[],
	requests: RecordedRequest[],
): typeof globalThis.fetch {
	return (input, init) => {
		requests.push({
			url: String(input),
			method: init?.method ?? "GET",
			headers: Object.fromEntries(new Headers(init?.headers)),
			body: typeof init?.body === "string" ? init.body : null,
		});
		const answer = answers.shift();
		if (answer === undefined) {
			return Promise.reject(new Error("scripted answers exhausted"));
		}
		if (answer instanceof Error) {
			return Promise.reject(answer);
		}
		return Promise.resolve(answer);
	};
}

function makeClient(
	answers: (Response | Error)[],
	options?: {
		rateLimiter?: FakeSupabaseRateLimiter;
		ownsRef?: (projectId: string, ref: string) => Promise<boolean>;
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
