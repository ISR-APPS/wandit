/**
 * `GitStore` on code.storage (D21): one repository per project, named
 * `wandit/<projectId>`. All credentials are ES256 JWTs minted locally with
 * the org's private key — no platform-wide token ever leaves this class.
 * Called by `commitTurn`, the restorer, and the project-create flow. The
 * `mobile-build` task gets a "read" credential here to fetch one commit.
 */
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type {
	GitCredentialAccess,
	GitStore,
} from "../../domain/ports/git-store";
import { requireV2Env, V2_ENV, type V2EnvSource } from "../env/v2-env";
import { type CodeStorageScope, mintCodeStorageJwt } from "./code-storage-jwt";
import { CODE_STORAGE_GIT_USERNAME } from "./git-remote-url";

/** Repository name for one project on code.storage. */
export function codeStorageRepoName(projectId: string): string {
	return `wandit/${projectId}`;
}

/**
 * One code.storage API failure. `detail` comes from the RFC 9457 problem
 * body; the message never carries a token.
 */
export class GitStoreError extends Error {
	constructor(
		message: string,
		/** HTTP status of the failed call, or null on a network failure. */
		readonly status: number | null,
		/** Problem `detail`/`error` text the API returned, when present. */
		readonly detail: string | null,
	) {
		super(message);
		this.name = "GitStoreError";
	}
}

/**
 * Test seam for `CodeStorageGitStore`. Production leaves it undefined; a
 * spec points `apiBaseUrl` at a local server and stubs `sleep`.
 */
export type CodeStorageGitStoreOptions = {
	/** API base URL override. Default: `https://api.<org>.code.storage/api/v1`. */
	apiBaseUrl?: string;
	/** Replaces the retry sleep so a spec does not wait real seconds. */
	sleep?: (ms: number) => Promise<void>;
};

const REQUEST_TIMEOUT_MS = 30_000;
// A repo write is a control-plane call; 300 s covers the API round trip.
const REPO_WRITE_TOKEN_TTL_SECONDS = 300;
// At most 4 attempts per call: one try plus three retries.
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
// A `Retry-After` value above this bound is clamped so one 429 cannot stall
// a turn for minutes.
const RETRY_AFTER_CAP_MS = 60_000;

/** `GitStore` over the code.storage REST API. */
@Injectable()
export class CodeStorageGitStore implements GitStore {
	private readonly logger = new Logger(CodeStorageGitStore.name);

	constructor(
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		// The options are a spec seam; the module never binds them, so Nest
		// passes undefined and the defaults apply.
		@Optional()
		private readonly options?: CodeStorageGitStoreOptions,
	) {}

	async ensureRepository(projectId: string): Promise<{ remoteUrl: string }> {
		const repoName = codeStorageRepoName(projectId);
		const token = await this.mint(["repo:write"], {
			repoName,
			ttlSeconds: REPO_WRITE_TOKEN_TTL_SECONDS,
		});
		const response = await this.request("POST", "/repos", token, {
			body: JSON.stringify({ default_branch: "main" }),
		});
		// The repository name comes from the JWT `repo` claim. A second
		// ensure answers 409; an existing repository is a success.
		// `request` returns only for a status below 500 that is not 429.
		if (
			!response.ok &&
			response.status !== 409 &&
			!/already exists/i.test(response.detail ?? "")
		) {
			throw new GitStoreError(
				`code.storage repository create failed (${response.status})`,
				response.status,
				response.detail,
			);
		}
		return { remoteUrl: this.remoteUrl(projectId) };
	}

	/**
	 * Mints a git JWT without an API call. "read" access carries only
	 * `git:read`, so the token cannot push.
	 */
	async issueCredential(
		projectId: string,
		ttlSeconds: number,
		access: GitCredentialAccess = "read-write",
	): Promise<{
		username: string;
		password: string;
		expiresAt: Date;
		remoteUrl: string;
	}> {
		const now = new Date();
		// A push needs both scopes: `git:read` for fetch/clone, `git:write`
		// for push. One scope never includes the other.
		const scopes: CodeStorageScope[] =
			access === "read" ? ["git:read"] : ["git:read", "git:write"];
		const password = await this.mint(scopes, {
			repoName: codeStorageRepoName(projectId),
			ttlSeconds,
			now,
		});
		return {
			username: CODE_STORAGE_GIT_USERNAME,
			password,
			expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
			remoteUrl: this.remoteUrl(projectId),
		};
	}

	async deleteRepository(projectId: string): Promise<void> {
		const repoName = codeStorageRepoName(projectId);
		const token = await this.mint(["repo:write"], {
			repoName,
			ttlSeconds: REPO_WRITE_TOKEN_TTL_SECONDS,
		});
		// The repository comes from the JWT `repo` claim; the path is fixed.
		const response = await this.request("DELETE", "/repos/delete", token);
		// 404 and 409 both mean "the repository is gone": a delete is done.
		if (!response.ok && response.status !== 404 && response.status !== 409) {
			throw new GitStoreError(
				`code.storage repository delete failed (${response.status})`,
				response.status,
				response.detail,
			);
		}
	}

	/** `iss`/`sub` fixed claims plus the org's signing key from env. */
	private async mint(
		scopes: CodeStorageScope[],
		token: { repoName: string; ttlSeconds: number; now?: Date },
	): Promise<string> {
		const org = requireV2Env("CODE_STORAGE_ORG", this.v2Env);
		const privateKeyPem = requireV2Env("CODE_STORAGE_PRIVATE_KEY", this.v2Env);
		return mintCodeStorageJwt({
			org,
			privateKeyPem,
			repoName: token.repoName,
			scopes,
			ttlSeconds: token.ttlSeconds,
			now: token.now,
		});
	}

	private remoteUrl(projectId: string): string {
		const org = requireV2Env("CODE_STORAGE_ORG", this.v2Env);
		return `https://${org}.code.storage/${codeStorageRepoName(projectId)}.git`;
	}

	private apiBaseUrl(): string {
		if (this.options?.apiBaseUrl) {
			return this.options.apiBaseUrl;
		}
		const org = requireV2Env("CODE_STORAGE_ORG", this.v2Env);
		// The versioned prefix is part of every documented endpoint.
		return `https://api.${org}.code.storage/api/v1`;
	}

	/**
	 * One API call with retries. A 429 waits `Retry-After` (capped at 60 s)
	 * or the backoff when the header is missing; a 5xx or a network error
	 * waits 1 s, 2 s, then 4 s. After 4 attempts the call throws a
	 * `GitStoreError` whose detail never carries the JWT.
	 */
	private async request(
		method: "POST" | "DELETE",
		path: string,
		token: string,
		init?: { body: string },
	): Promise<{ ok: boolean; status: number; detail: string | null }> {
		const url = `${this.apiBaseUrl()}${path}`;
		let lastError: GitStoreError | null = null;

		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
			try {
				const response = await fetch(url, {
					method,
					headers: {
						authorization: `Bearer ${token}`,
						"content-type": "application/json",
					},
					body: init?.body,
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				});
				const detail = await readProblemDetail(response);
				// A 429 or a 5xx is retryable; anything else is a final answer.
				if (response.status !== 429 && response.status < 500) {
					return { ok: response.ok, status: response.status, detail };
				}
				lastError = new GitStoreError(
					`code.storage ${method} ${path} answered ${response.status}`,
					response.status,
					detail,
				);
				if (attempt === MAX_ATTEMPTS - 1) {
					break;
				}
				// A 429 without a parseable Retry-After waits the same backoff
				// as a 5xx — the cap is a clamp, not a default.
				const waitMs =
					(response.status === 429 ? retryAfterMs(response) : null) ??
					RETRY_DELAYS_MS[attempt] ??
					4_000;
				this.logger.warn(
					`code.storage ${method} ${path} answered ${response.status}; retry ${attempt + 1}/${MAX_ATTEMPTS - 1}`,
				);
				await this.sleep(waitMs);
			} catch (error) {
				if (error instanceof GitStoreError) {
					throw error;
				}
				// A network failure or a timeout is retryable like a 5xx.
				lastError = new GitStoreError(
					`code.storage ${method} ${path} failed: ${errorMessage(error)}`,
					null,
					null,
				);
				if (attempt === MAX_ATTEMPTS - 1) {
					break;
				}
				this.logger.warn(
					`code.storage ${method} ${path} failed; retry ${attempt + 1}/${MAX_ATTEMPTS - 1}`,
				);
				await this.sleep(RETRY_DELAYS_MS[attempt] ?? 4_000);
			}
		}

		// The loop only exits after a recorded failure; the fallback covers
		// an impossible exit with no failure.
		throw (
			lastError ??
			new GitStoreError(
				`code.storage ${method} ${path} exhausted ${MAX_ATTEMPTS} attempts`,
				null,
				null,
			)
		);
	}

	private sleep(ms: number): Promise<void> {
		if (this.options?.sleep) {
			return this.options.sleep(ms);
		}
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// The problem body is `application/problem+json`; a legacy `error` string
// carries the same text on some routes.
async function readProblemDetail(response: Response): Promise<string | null> {
	try {
		const body: unknown = await response.json();
		if (typeof body !== "object" || body === null) {
			return null;
		}
		// SAFETY: the object check above proves `body` is a record; the
		// optional fields read as undefined when absent.
		const fields = body as { detail?: string; error?: string; title?: string };
		return fields.detail ?? fields.error ?? fields.title ?? null;
	} catch {
		return null;
	}
}

// The Retry-After wait in milliseconds. Null when the header is absent
// or not a number; the caller then uses the backoff delays.
function retryAfterMs(response: Response): number | null {
	const seconds = Number.parseInt(
		response.headers.get("retry-after") ?? "",
		10,
	);
	if (Number.isNaN(seconds) || seconds < 0) {
		return null;
	}
	return Math.min(seconds * 1000, RETRY_AFTER_CAP_MS);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
