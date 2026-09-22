/**
 * Typed client for the Supabase Management API and the project Storage
 * API (WANDIT-183, WANDIT-187). The `provision-backend` runtime composes
 * it by hand; `app-builder.module.ts` composes the interactive form for
 * `CloudService`. It calls the APIs over `fetch`, waits on the
 * `SupabaseRateLimiter`, and checks `ownsRef` before every project call.
 */
import {
	type SupabaseApiKeysResponse,
	type SupabaseBucket,
	type SupabaseFunction,
	type SupabaseInstanceSize,
	type SupabaseProjectStatus,
	type SupabaseRegion,
	type SupabaseStorageObject,
	supabaseApiKeysResponseSchema,
	supabaseAuthConfigResponseSchema,
	supabaseBucketsResponseSchema,
	supabaseCreateProjectResponseSchema,
	supabaseDeletedObjectsResponseSchema,
	supabaseErrorBodySchema,
	supabaseFunctionsResponseSchema,
	supabaseLogsResponseSchema,
	supabaseProjectResponseSchema,
	supabaseSignedUrlsResponseSchema,
	supabaseStorageObjectsResponseSchema,
	supabaseStorageUrl,
	supabaseUploadUrlResponseSchema,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { z } from "zod";

import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import {
	type SupabaseRateLimiter,
	supabaseRateLimitKeys,
} from "./supabase-rate-limiter";

/** Includes the `/v1` prefix; every `RequestPlan.path` is relative to it. `deps.baseUrl` replaces it in specs. */
export const SUPABASE_MANAGEMENT_BASE_URL = "https://api.supabase.com/v1";

/**
 * Nest token of the interactive client the Cloud routes use. The module
 * factory answers null when `SUPABASE_PLATFORM_TOKEN` is unset.
 */
export const SUPABASE_MANAGEMENT_CLIENT = Symbol.for(
	"app-builder.supabase-management-client",
);

// 120 requests per minute per bucket: the documented limit of the
// per-project and the per-org buckets (research 3.1).
const SUPABASE_REQUESTS_PER_MINUTE = 120;
// The analytics logs endpoint allows 30 per minute per project (WANDIT-187).
const SUPABASE_LOGS_PER_MINUTE = 30;
// At most 5 fetch attempts per call: one try plus four retries.
const MAX_ATTEMPTS = 5;
// One retry only when a user waits on the answer.
const INTERACTIVE_MAX_ATTEMPTS = 2;
// A Cloud tab SQL statement gets 15 s (ESTIMATE); the provisioning
// migration keeps the 30 s round trip.
const QUERY_TIMEOUT_MS = 15_000;
// At most 5 limiter waits per call; a bucket that stays full fails it.
const MAX_RATE_LIMIT_WAITS = 5;
// One rate-limit answer never stalls a call for more than 60 s.
const MAX_WAIT_MS = 60_000;
// A 429 without `X-RateLimit-Reset` waits this fixed delay.
const RATE_LIMIT_FALLBACK_WAIT_MS = 5_000;
// UNVERIFIED whether `X-RateLimit-Reset` holds unix seconds or seconds
// until reset. A value above this bound is read as a unix time.
const UNIX_SECONDS_THRESHOLD = 1_000_000_000;
// One fetch round trip gets 30 s, like the code.storage client.
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * One Management API failure. The message never carries the token, a
 * key, or a password.
 */
export class SupabaseManagementError extends Error {
	constructor(
		message: string,
		/** HTTP status of the failed call, or null on a network failure. */
		readonly status: number | null,
		/** `x-request-id` or `sb-request-id` response header, when present. */
		readonly requestId: string | null,
		/** `message` field of the error body, when present. */
		readonly detail: string | null,
	) {
		super(message);
		this.name = "SupabaseManagementError";
	}
}

/**
 * A call the rate limit stopped in interactive mode: the bucket was full
 * or the upstream answered 429. `CloudService` turns it into 429
 * `RATE_LIMITED` with a `Retry-After` header.
 */
export class SupabaseRateLimitedError extends SupabaseManagementError {
	constructor(
		message: string,
		/** Milliseconds until the bucket or the upstream accepts a call again. */
		readonly retryAfterMs: number,
	) {
		super(message, 429, null, "rate limited");
		this.name = "SupabaseRateLimitedError";
	}
}

/** The scope of a project-level call. */
export type BackendRef = {
	/** `projects.id` of the wandit project the call runs for. */
	projectId: string;
	/** The 20-letter Supabase project ref stored on the `app_backends` row. */
	ref: string;
};

/** The scope of a project Storage API call. */
export type StorageRef = BackendRef & {
	/** Service-role key of the project; sent as the bearer and as `apikey`. Never logged. */
	serviceRoleKey: string;
};

/** Dependencies of `SupabaseManagementClient`; the worker composes them. */
export type SupabaseManagementClientDeps = {
	/** Bearer token for the Management API. From `SUPABASE_PLATFORM_TOKEN`. */
	token: string;
	/** Organization slug for the create call. From `SUPABASE_PLATFORM_ORG_ID`. */
	organizationSlug: string;
	/** `globalThis.fetch` in production; the spec passes a fake. */
	fetch: typeof globalThis.fetch;
	/** `RedisSupabaseRateLimiter` in production; the spec passes the fake. */
	rateLimiter: SupabaseRateLimiter;
	/**
	 * Answers whether `ref` sits on the `app_backends` row of `projectId`.
	 * Backs the ownership check before each project-level call.
	 */
	ownsRef: (projectId: string, ref: string) => Promise<boolean>;
	/** A `setTimeout` sleep in production; the spec records and resolves. */
	sleep: (ms: number) => Promise<void>;
	/** `Sentry.logger` or the Trigger.dev logger; the spec passes a fake. */
	logger: SandboxLogger;
	/** Base URL override. Default `SUPABASE_MANAGEMENT_BASE_URL`. */
	baseUrl?: string;
	/**
	 * True for the HTTP routes: no wait on a full bucket, one retry, and a
	 * 429 throws `SupabaseRateLimitedError` at once. The worker keeps the
	 * default false and waits.
	 */
	interactive?: boolean;
};

/** One API call that `request` sends. */
type RequestPlan<T> = {
	/** HTTP method of the call. */
	method: "GET" | "POST" | "PATCH" | "DELETE";
	/** Path under the base URL, for example `/projects/{ref}/api-keys`. Also names the call in errors. */
	path: string;
	/** Absolute URL of a project Storage API call; absent means base URL plus `path`. */
	url?: string;
	/** Bearer of a project Storage API call: the service-role key. Absent means the platform token. */
	bearer?: string;
	/** Rate-limit bucket key from `supabaseRateLimitKeys`. */
	bucket: string;
	/** Bucket ceiling in calls per minute; 120, or 30 for the logs bucket. */
	limitPerMinute: number;
	/** JSON body; absent on GET. Passed to `JSON.stringify` unread. */
	body?: Record<string, unknown>;
	/** Response schema; absent means the response body is not read. */
	schema?: z.ZodType<T>;
	/** Fetch timeout in milliseconds; default `REQUEST_TIMEOUT_MS`. */
	timeoutMs?: number;
};

/**
 * The small-form Management API client. It is composed by hand in the
 * Trigger worker, like `createDeleteAppProjectRuntime`, and by the
 * `SUPABASE_MANAGEMENT_CLIENT` factory of the API module, so it carries
 * no Nest decorators.
 */
export class SupabaseManagementClient {
	// Security check and cache in one: a verified `projectId:ref` pair
	// skips the second `ownsRef` lookup.
	private readonly verifiedRefs = new Set<string>();

	constructor(private readonly deps: SupabaseManagementClientDeps) {}

	/**
	 * Creates the hidden Supabase project `wandit-<projectId>` on the org
	 * bucket. Answers the new ref and the deprecated `organization_id`.
	 */
	async createProject(input: {
		/** `projects.id`; the Supabase project is named `wandit-<projectId>`. */
		projectId: string;
		/** Region from `pickSupabaseRegion` or the env override. */
		region: SupabaseRegion;
		/** Postgres password of the new project, sent as `db_pass`. Never logged. */
		dbPassword: string;
		/** From `SUPABASE_PLATFORM_INSTANCE_SIZE`, for example "micro". */
		instanceSize: SupabaseInstanceSize;
	}): Promise<{ ref: string; orgId: string }> {
		const project = await this.request({
			method: "POST",
			path: "/projects",
			bucket: supabaseRateLimitKeys.org(),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			body: {
				name: `wandit-${input.projectId}`,
				organization_slug: this.deps.organizationSlug,
				db_pass: input.dbPassword,
				region: input.region,
				desired_instance_size: input.instanceSize,
			},
			schema: supabaseCreateProjectResponseSchema,
		});
		return { ref: project.ref, orgId: project.organization_id };
	}

	/** Reads the lifecycle status and the Postgres host of one project. */
	async getProject(
		scope: BackendRef,
	): Promise<{ status: SupabaseProjectStatus; dbHost: string }> {
		await this.requireOwnedRef(scope);
		const project = await this.request({
			method: "GET",
			path: `/projects/${scope.ref}`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			schema: supabaseProjectResponseSchema,
		});
		return { status: project.status, dbHost: project.database.host };
	}

	/**
	 * Reads the public anon key with `reveal=true`. Throws when no `anon`
	 * or `publishable` entry carries a key. The key is never logged.
	 */
	async getApiKeys(scope: BackendRef): Promise<{ anonKey: string }> {
		const keys = await this.readApiKeys(scope);
		// Legacy projects name the public key "anon"; newer keys carry the
		// "publishable" type instead.
		const entry =
			keys.find((key) => key.name === "anon") ??
			keys.find((key) => key.type === "publishable");
		const anonKey = entry?.api_key;
		if (anonKey === undefined || anonKey === null) {
			throw new SupabaseManagementError(
				`supabase GET /projects/${scope.ref}/api-keys carries no anon key`,
				200,
				null,
				"no anon key in the api-keys answer",
			);
		}
		return { anonKey };
	}

	/**
	 * Reads the service-role key with `reveal=true`: the legacy
	 * `service_role` entry, else the first `secret` key. Throws when none
	 * carries a key. The key never leaves the API process and is never logged.
	 */
	async getServiceRoleKey(scope: BackendRef): Promise<string> {
		const keys = await this.readApiKeys(scope);
		const entry =
			keys.find((key) => key.name === "service_role") ??
			keys.find((key) => key.type === "secret");
		const serviceRoleKey = entry?.api_key;
		if (serviceRoleKey === undefined || serviceRoleKey === null) {
			throw new SupabaseManagementError(
				`supabase GET /projects/${scope.ref}/api-keys carries no service-role key`,
				200,
				null,
				"no service-role key in the api-keys answer",
			);
		}
		return serviceRoleKey;
	}

	/** Runs one SQL statement; a 2xx answer is success, the body stays unread. */
	async runSql(scope: BackendRef, sql: string): Promise<void> {
		await this.requireOwnedRef(scope);
		await this.request<void>({
			method: "POST",
			path: `/projects/${scope.ref}/database/query`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			body: { query: sql },
		});
	}

	/**
	 * Runs one statement and parses the answered rows with `rowSchema`.
	 * `readOnly` makes the upstream run it in a read-only transaction. The
	 * fetch gets `QUERY_TIMEOUT_MS`; a longer statement fails the call.
	 * UNVERIFIED: the endpoint is Beta and answers a bare row array.
	 */
	async runQuery<TRow>(
		scope: BackendRef,
		input: {
			sql: string;
			readOnly: boolean;
			/** Shape of one answered row; the call fails on a row that does not fit. */
			rowSchema: z.ZodType<TRow>;
		},
	): Promise<TRow[]> {
		await this.requireOwnedRef(scope);
		return this.request({
			method: "POST",
			path: `/projects/${scope.ref}/database/query`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			body: { query: input.sql, read_only: input.readOnly },
			schema: z.array(input.rowSchema),
			timeoutMs: QUERY_TIMEOUT_MS,
		});
	}

	/** Wakes a paused project: `POST /projects/{ref}/restore`. The body stays unread. */
	async restoreProject(scope: BackendRef): Promise<void> {
		await this.requireOwnedRef(scope);
		await this.request<void>({
			method: "POST",
			path: `/projects/${scope.ref}/restore`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
		});
	}

	/** Lists the Storage buckets of the project. */
	async listBuckets(scope: BackendRef): Promise<SupabaseBucket[]> {
		await this.requireOwnedRef(scope);
		return this.request({
			method: "GET",
			path: `/projects/${scope.ref}/storage/buckets`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			schema: supabaseBucketsResponseSchema,
		});
	}

	/** Lists the Edge Functions of the project. */
	async listFunctions(scope: BackendRef): Promise<SupabaseFunction[]> {
		await this.requireOwnedRef(scope);
		return this.request({
			method: "GET",
			path: `/projects/${scope.ref}/functions`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			schema: supabaseFunctionsResponseSchema,
		});
	}

	/**
	 * Runs one logs SQL text on the analytics endpoint inside the ISO
	 * window and parses the rows with `rowSchema`. Own bucket: 30 calls
	 * per minute. An `error` field in a 200 answer fails the call.
	 */
	async queryLogs<TRow>(
		scope: BackendRef,
		input: {
			/** Logs SQL over `edge_logs`, `postgres_logs`, or `function_edge_logs`. */
			sql: string;
			/** Start of the window, ISO 8601. */
			startIso: string;
			/** End of the window, ISO 8601. */
			endIso: string;
			/** Shape of one answered row; the call fails on a row that does not fit. */
			rowSchema: z.ZodType<TRow>;
		},
	): Promise<TRow[]> {
		await this.requireOwnedRef(scope);
		const params = new URLSearchParams({
			sql: input.sql,
			iso_timestamp_start: input.startIso,
			iso_timestamp_end: input.endIso,
		});
		const path = `/projects/${scope.ref}/analytics/endpoints/logs.all`;
		const answer = await this.request({
			method: "GET",
			path: `${path}?${params.toString()}`,
			bucket: supabaseRateLimitKeys.logs(scope.ref),
			limitPerMinute: SUPABASE_LOGS_PER_MINUTE,
			schema: supabaseLogsResponseSchema(input.rowSchema),
		});
		if (answer.error !== undefined && answer.error !== null) {
			throw new SupabaseManagementError(
				`supabase GET ${path} refused the logs query`,
				200,
				null,
				answer.error,
			);
		}
		return answer.result ?? [];
	}

	/**
	 * Lists one page of objects under `prefix`, sorted by name. A folder
	 * comes back with a null `id`.
	 */
	async listObjects(
		scope: StorageRef,
		input: {
			bucket: string;
			/** Folder path without a trailing slash; empty for the bucket root. */
			prefix: string;
			offset: number;
			limit: number;
		},
	): Promise<SupabaseStorageObject[]> {
		return this.storageRequest(scope, {
			method: "POST",
			path: `/object/list/${encodeURIComponent(input.bucket)}`,
			body: {
				prefix: input.prefix,
				limit: input.limit,
				offset: input.offset,
				sortBy: { column: "name", order: "asc" },
			},
			schema: supabaseStorageObjectsResponseSchema,
		});
	}

	/**
	 * Signs download URLs for `paths` in one call. Answers path to absolute
	 * URL; a path Supabase refused (missing object) is absent from the map.
	 */
	async signDownloadUrls(
		scope: StorageRef,
		input: { bucket: string; paths: string[]; expiresInSeconds: number },
	): Promise<Map<string, string>> {
		const entries = await this.storageRequest(scope, {
			method: "POST",
			path: `/object/sign/${encodeURIComponent(input.bucket)}`,
			body: { expiresIn: input.expiresInSeconds, paths: input.paths },
			schema: supabaseSignedUrlsResponseSchema,
		});
		const urls = new Map<string, string>();
		for (const entry of entries) {
			if (entry.path !== null && entry.signedURL !== null) {
				urls.set(
					entry.path,
					`${supabaseStorageUrl(scope.ref)}${entry.signedURL}`,
				);
			}
		}
		return urls;
	}

	/** Signs one upload URL for `path`; Supabase keeps it valid for two hours. */
	async createUploadUrl(
		scope: StorageRef,
		input: { bucket: string; path: string },
	): Promise<string> {
		const answer = await this.storageRequest(scope, {
			method: "POST",
			path: `/object/upload/sign/${encodeURIComponent(input.bucket)}/${encodeObjectPath(input.path)}`,
			schema: supabaseUploadUrlResponseSchema,
		});
		return `${supabaseStorageUrl(scope.ref)}${answer.url}`;
	}

	/** Deletes the listed objects; answers how many Supabase removed. */
	async deleteObjects(
		scope: StorageRef,
		input: { bucket: string; paths: string[] },
	): Promise<number> {
		const removed = await this.storageRequest(scope, {
			method: "DELETE",
			path: `/object/${encodeURIComponent(input.bucket)}`,
			body: { prefixes: input.paths },
			schema: supabaseDeletedObjectsResponseSchema,
		});
		return removed.length;
	}

	// One `reveal=true` read of every key of the project; the callers pick
	// the anon key or the service-role key and drop the rest.
	private async readApiKeys(
		scope: BackendRef,
	): Promise<SupabaseApiKeysResponse> {
		await this.requireOwnedRef(scope);
		return this.request({
			method: "GET",
			path: `/projects/${scope.ref}/api-keys?reveal=true`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			schema: supabaseApiKeysResponseSchema,
		});
	}

	// Storage calls share the project bucket and the retry loop of
	// `request`; only the URL and the bearer differ.
	private async storageRequest<T>(
		scope: StorageRef,
		plan: Pick<RequestPlan<T>, "method" | "path" | "body" | "schema">,
	): Promise<T> {
		await this.requireOwnedRef(scope);
		return this.request({
			...plan,
			url: `${supabaseStorageUrl(scope.ref)}${plan.path}`,
			bearer: scope.serviceRoleKey,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
		});
	}

	/** Sets the auth site URL, the redirect allow list, and the email flag. */
	async updateAuthConfig(
		scope: BackendRef,
		input: {
			/** Public URL the app's sign-in redirects to, the preview host. */
			siteUrl: string;
			/** Extra redirect origins; joined into one comma-separated string. */
			uriAllowList: string[];
			/** Turns the email provider on. */
			externalEmailEnabled: boolean;
		},
	): Promise<void> {
		await this.requireOwnedRef(scope);
		await this.request({
			method: "PATCH",
			path: `/projects/${scope.ref}/config/auth`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			body: {
				site_url: input.siteUrl,
				// The API takes one comma-separated string, not an array.
				uri_allow_list: input.uriAllowList.join(","),
				external_email_enabled: input.externalEmailEnabled,
			},
			schema: supabaseAuthConfigResponseSchema,
		});
	}

	/** Throws when the ref is not stored on the project's `app_backends` row. */
	private async requireOwnedRef(scope: BackendRef): Promise<void> {
		const pair = `${scope.projectId}:${scope.ref}`;
		if (this.verifiedRefs.has(pair)) {
			return;
		}
		if (!(await this.deps.ownsRef(scope.projectId, scope.ref))) {
			throw new SupabaseManagementError(
				`ref ${scope.ref} does not belong to project ${scope.projectId}`,
				null,
				null,
				"ref does not belong to project",
			);
		}
		this.verifiedRefs.add(pair);
	}

	/**
	 * One API call: wait on the bucket, then at most MAX_ATTEMPTS fetches.
	 * A 429 waits `X-RateLimit-Reset` (5 s when absent); a 5xx or a thrown
	 * fetch backs off 1 s, 2 s, 4 s, 8 s. Another 4xx throws at once. The
	 * interactive form never waits on a bucket and retries once.
	 */
	private async request<T>(plan: RequestPlan<T>): Promise<T> {
		const interactive = this.deps.interactive === true;
		const maxAttempts = interactive ? INTERACTIVE_MAX_ATTEMPTS : MAX_ATTEMPTS;
		// The limiter answers the wait until the bucket's window ends; at
		// most MAX_RATE_LIMIT_WAITS sleeps, then the call fails.
		let waitsDone = 0;
		while (true) {
			const waitMs = await this.deps.rateLimiter.take(
				plan.bucket,
				plan.limitPerMinute,
			);
			if (waitMs <= 0) {
				break;
			}
			// A user waits on the answer: the route answers 429 with the wait.
			if (interactive) {
				throw new SupabaseRateLimitedError(
					`supabase ${plan.method} ${plan.path} hit the ${plan.bucket} bucket`,
					waitMs,
				);
			}
			if (waitsDone >= MAX_RATE_LIMIT_WAITS) {
				throw new SupabaseManagementError(
					`supabase ${plan.method} ${plan.path} exceeded the rate-limit wait`,
					null,
					null,
					"rate limit wait exceeded",
				);
			}
			await this.deps.sleep(Math.min(waitMs, MAX_WAIT_MS));
			waitsDone += 1;
		}

		const url =
			plan.url ??
			`${this.deps.baseUrl ?? SUPABASE_MANAGEMENT_BASE_URL}${plan.path}`;

		for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
			try {
				const response = await this.deps.fetch(url, {
					method: plan.method,
					headers: {
						authorization: `Bearer ${plan.bearer ?? this.deps.token}`,
						// The project gateway also wants the key in `apikey`.
						...(plan.bearer === undefined ? {} : { apikey: plan.bearer }),
						"content-type": "application/json",
						accept: "application/json",
					},
					body: plan.body === undefined ? undefined : JSON.stringify(plan.body),
					signal: AbortSignal.timeout(plan.timeoutMs ?? REQUEST_TIMEOUT_MS),
				});
				if (response.ok) {
					const schema = plan.schema;
					if (schema === undefined) {
						// SAFETY: a plan without a schema is always called with
						// T = void; the body stays unread.
						return undefined as T;
					}
					return await this.parseBody(response, schema, plan);
				}
				const failure = new SupabaseManagementError(
					`supabase ${plan.method} ${plan.path} answered ${response.status}`,
					response.status,
					requestIdOf(response),
					await readErrorDetail(response),
				);
				// An upstream 429 in interactive mode answers the user at once.
				if (response.status === 429 && interactive) {
					throw new SupabaseRateLimitedError(
						failure.message,
						rateLimitResetMs(response) ?? RATE_LIMIT_FALLBACK_WAIT_MS,
					);
				}
				// A 429 and a 5xx are retryable; another 4xx is a final answer.
				if (
					(response.status !== 429 && response.status < 500) ||
					attempt === maxAttempts - 1
				) {
					throw failure;
				}
				const waitMs =
					response.status === 429
						? (rateLimitResetMs(response) ?? RATE_LIMIT_FALLBACK_WAIT_MS)
						: retryBackoffMs(attempt);
				this.logRetry(response.status, attempt, plan.path);
				await this.deps.sleep(waitMs);
			} catch (error) {
				if (error instanceof SupabaseManagementError) {
					throw error;
				}
				// A thrown fetch (network failure or timeout) retries like a 5xx.
				const failure = new SupabaseManagementError(
					`supabase ${plan.method} ${plan.path} failed: ${getErrorMessage(error)}`,
					null,
					null,
					null,
				);
				if (attempt === maxAttempts - 1) {
					throw failure;
				}
				this.logRetry(null, attempt, plan.path);
				await this.deps.sleep(retryBackoffMs(attempt));
			}
		}

		// TypeScript needs an exit here; each branch throws on the last attempt.
		throw new SupabaseManagementError(
			`supabase ${plan.method} ${plan.path} exhausted ${maxAttempts} attempts`,
			null,
			null,
			null,
		);
	}

	private async parseBody<T>(
		response: Response,
		schema: z.ZodType<T>,
		plan: { method: string; path: string },
	): Promise<T> {
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			// A non-JSON body fails the schema below.
			body = null;
		}
		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			throw new SupabaseManagementError(
				`supabase ${plan.method} ${plan.path} returned an unexpected body`,
				response.status,
				requestIdOf(response),
				"unexpected response body",
			);
		}
		return parsed.data;
	}

	private logRetry(status: number | null, attempt: number, path: string): void {
		this.deps.logger.warn("supabase.management.retry", {
			status: String(status),
			attempt: String(attempt + 1),
			path,
		});
	}
}

// Each path segment is encoded on its own so the `/` separators survive.
function encodeObjectPath(path: string): string {
	return path.split("/").map(encodeURIComponent).join("/");
}

// The error body is `{ "message": "..." }` on the documented 4xx paths.
// A non-JSON or differently shaped body answers null.
async function readErrorDetail(response: Response): Promise<string | null> {
	try {
		const parsed = supabaseErrorBodySchema.safeParse(await response.json());
		return parsed.success ? (parsed.data.message ?? null) : null;
	} catch {
		return null;
	}
}

function requestIdOf(response: Response): string | null {
	return (
		response.headers.get("x-request-id") ??
		response.headers.get("sb-request-id")
	);
}

// The wait on a 429 in milliseconds. Null when the header is absent or not
// a number; the caller then uses the fixed fallback delay. UNVERIFIED
// whether the value is a unix time or a delay in seconds: above 1e9 it is
// a unix time, below it is a delay. The wait is capped at 60 s either way.
function rateLimitResetMs(response: Response): number | null {
	const raw = Number.parseInt(
		response.headers.get("x-ratelimit-reset") ?? "",
		10,
	);
	if (Number.isNaN(raw) || raw < 0) {
		return null;
	}
	const delaySeconds =
		raw > UNIX_SECONDS_THRESHOLD ? raw - Math.floor(Date.now() / 1_000) : raw;
	return Math.min(Math.max(delaySeconds, 0) * 1_000, MAX_WAIT_MS);
}

// The backoff on a 5xx or a thrown fetch: 1 s, 2 s, 4 s, 8 s.
function retryBackoffMs(attempt: number): number {
	return 1_000 * 2 ** attempt;
}
