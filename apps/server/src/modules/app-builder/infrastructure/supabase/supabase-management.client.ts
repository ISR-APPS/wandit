/**
 * Typed client for the Supabase Management API (the small form of
 * WANDIT-183). The `provision-backend` runtime calls it through
 * `provision-backend.task.ts`. It calls the Management API
 * over `fetch`, waits on the `SupabaseRateLimiter`, and checks `ownsRef`
 * before every project-level call.
 */
import {
	type SupabaseInstanceSize,
	type SupabaseProjectStatus,
	type SupabaseRegion,
	supabaseApiKeysResponseSchema,
	supabaseAuthConfigResponseSchema,
	supabaseCreateProjectResponseSchema,
	supabaseErrorBodySchema,
	supabaseProjectResponseSchema,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import type { z } from "zod";

import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import {
	type SupabaseRateLimiter,
	supabaseRateLimitKeys,
} from "./supabase-rate-limiter";

/** Includes the `/v1` prefix; every `RequestPlan.path` is relative to it. `deps.baseUrl` replaces it in specs. */
export const SUPABASE_MANAGEMENT_BASE_URL = "https://api.supabase.com/v1";

// 120 requests per minute per bucket: the documented limit of the
// per-project and the per-org buckets (research 3.1).
const SUPABASE_REQUESTS_PER_MINUTE = 120;
// At most 5 fetch attempts per call: one try plus four retries.
const MAX_ATTEMPTS = 5;
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

/** The scope of a project-level call. */
export type BackendRef = {
	/** `projects.id` of the wandit project the call runs for. */
	projectId: string;
	/** The 20-letter Supabase project ref stored on the `app_backends` row. */
	ref: string;
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
};

/** One Management API call that `request` sends. */
type RequestPlan<T> = {
	/** HTTP method of the call. */
	method: "GET" | "POST" | "PATCH";
	/** Path under the base URL, for example `/projects/{ref}/api-keys`. */
	path: string;
	/** Rate-limit bucket key from `supabaseRateLimitKeys`. */
	bucket: string;
	/** Bucket ceiling in calls per minute; 120 for every bucket tonight. */
	limitPerMinute: number;
	/** JSON body; absent on GET. Passed to `JSON.stringify` unread. */
	body?: Record<string, unknown>;
	/** Response schema; absent means the response body is not read. */
	schema?: z.ZodType<T>;
};

/**
 * The small-form Management API client. It is composed by hand in the
 * Trigger worker, like `createDeleteAppProjectRuntime`, so it carries no
 * Nest decorators.
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
		await this.requireOwnedRef(scope);
		const keys = await this.request({
			method: "GET",
			path: `/projects/${scope.ref}/api-keys?reveal=true`,
			bucket: supabaseRateLimitKeys.project(scope.ref),
			limitPerMinute: SUPABASE_REQUESTS_PER_MINUTE,
			schema: supabaseApiKeysResponseSchema,
		});
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
	 * fetch backs off 1 s, 2 s, 4 s, 8 s. Another 4xx throws at once.
	 */
	private async request<T>(plan: RequestPlan<T>): Promise<T> {
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

		const url = `${this.deps.baseUrl ?? SUPABASE_MANAGEMENT_BASE_URL}${plan.path}`;

		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
			try {
				const response = await this.deps.fetch(url, {
					method: plan.method,
					headers: {
						authorization: `Bearer ${this.deps.token}`,
						"content-type": "application/json",
						accept: "application/json",
					},
					body: plan.body === undefined ? undefined : JSON.stringify(plan.body),
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
				// A 429 and a 5xx are retryable; another 4xx is a final answer.
				if (
					(response.status !== 429 && response.status < 500) ||
					attempt === MAX_ATTEMPTS - 1
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
				if (attempt === MAX_ATTEMPTS - 1) {
					throw failure;
				}
				this.logRetry(null, attempt, plan.path);
				await this.deps.sleep(retryBackoffMs(attempt));
			}
		}

		// TypeScript needs an exit here; each branch throws on the last attempt.
		throw new SupabaseManagementError(
			`supabase ${plan.method} ${plan.path} exhausted ${MAX_ATTEMPTS} attempts`,
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
