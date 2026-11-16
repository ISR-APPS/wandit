/**
 * `GitStore` on code.storage (D21): one repository per project, named
 * `wandit/<projectId>`. All credentials are ES256 JWTs minted locally with
 * the org's private key — no platform-wide token ever leaves this class.
 * Called by `commitTurn`, the restorer, and the project-create flow. The
 * `mobile-build` task gets a "read" credential here to fetch one commit,
 * and the `github-sync` task gets the "push-github-mirror" credential.
 * The theme service reads one committed file through `readFile`. The Code
 * view service reads the committed tree, the archive, and one file here.
 */
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { codeStorageFileListResponseSchema } from "@wandit/contracts";

import { GitFileTooLargeError } from "../../domain/errors/git-file-too-large.error";
import type {
	GitArchiveFiles,
	GitCredentialAccess,
	GitFileReader,
	GitStore,
} from "../../domain/ports/git-store";
import { isRegularFile, tarEntries } from "../archive/tar-gz";
import { requireV2Env, V2_ENV, type V2EnvSource } from "../env/v2-env";
import {
	type CodeStorageRefRule,
	type CodeStorageScope,
	mintCodeStorageJwt,
} from "./code-storage-jwt";
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
// One read token serves every retry: 4 attempts of up to 30 s and 3 waits
// of up to 60 s fit in 300 s. The token never leaves the API process.
const FILE_READ_TOKEN_TTL_SECONDS = 300;
// At most 4 attempts per call: one try plus three retries.
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
// A `Retry-After` value above this bound is clamped so one 429 cannot stall
// a turn for minutes.
const RETRY_AFTER_CAP_MS = 60_000;
// 4 MB of gzip from `/repos/archive`. Three real project archives without
// `.claude` are 106 KB to 227 KB, with no images. A larger archive holds
// committed assets, and the API must not buffer them.
// LIMIT: a commit with a larger archive gets no prefetched files, so each
// file loads on a click. Upgrade: exclude asset globs from the archive call.
const ARCHIVE_MAX_GZIP_BYTES = 4 * 1024 * 1024;
// 16 MB of unpacked tar. Three real project tars are 370 KB to 890 KB. The
// cap stops a gzip bomb from filling the API memory.
const ARCHIVE_MAX_TAR_BYTES = 16 * 1024 * 1024;
// 5 s for the one archive attempt. A template archive takes about 0.2 s.
// The Code view tree waits for the archive, so a slow archive must not hold it.
const ARCHIVE_TIMEOUT_MS = 5_000;
// 8 MB of `/repos/files` JSON. 5000 entries with paths of 500 characters
// are about 5 MB. The cap stops a bad answer from filling the API memory.
const FILE_LIST_MAX_BODY_BYTES = 8 * 1024 * 1024;
// Security (WANDIT-282): a stolen push token cannot force-push `main`, push
// another branch, or push a tag. The first matching rule wins. A live probe
// on 2026-10-04 showed that code.storage enforces the claim on git push:
// each of these three pushes got "denied by policy".
// LIMIT: "no-force-push" allows a delete and a new create of `main`. The
// probe deleted `main` with this claim and then pushed an unrelated root
// commit as the new `main`. The REST API refuses a delete of the default
// branch (409). The old commits stayed readable by sha. Upgrade: the
// sandbox pushes to a per-turn branch, and the server fast-forwards `main`
// with a JWT that never enters the sandbox.
const PUSH_MAIN_REFS: CodeStorageRefRule[] = [
	["refs/heads/main", ["no-force-push"]],
	["*", ["no-push"]],
];
// Security: the GitHub mirror token of the worker may move `github/main` in
// any way, because GitHub history can be rewritten. It must never push
// `main`, another branch, or a tag. The docs say that a rule with no ops
// permits its ref: https://code.storage/docs/repos/ref-policies.md
// The docs show no empty `[]` list, so test one mirror push on staging.
const GITHUB_MIRROR_REFS: CodeStorageRefRule[] = [
	["refs/heads/github/main", []],
	["*", ["no-push"]],
];

/** `GitStore` over the code.storage REST API. */
@Injectable()
export class CodeStorageGitStore implements GitStore, GitFileReader {
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
	 * `git:read`, so the token cannot push. "push-main" adds `git:write` and
	 * the `refs` claim `PUSH_MAIN_REFS`. Its LIMIT says what the claim allows.
	 * "push-github-mirror" adds `git:write` and the claim `GITHUB_MIRROR_REFS`.
	 */
	async issueCredential(
		projectId: string,
		ttlSeconds: number,
		access: GitCredentialAccess,
	): Promise<{
		username: string;
		password: string;
		expiresAt: Date;
		remoteUrl: string;
	}> {
		const now = new Date();
		const claims = credentialClaims(access);
		const password = await this.mint(claims.scopes, {
			repoName: codeStorageRepoName(projectId),
			ttlSeconds,
			now,
			refs: claims.refs,
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

	/**
	 * `GET /repos/file` with a `git:read` JWT: the token cannot change the
	 * repository. A 404 means no repository or no file at `ref`. With
	 * `maxBytes`, a larger file throws `GitFileTooLargeError`.
	 */
	async readFile(
		projectId: string,
		ref: string,
		path: string,
		maxBytes?: number,
	): Promise<Uint8Array | null> {
		const token = await this.readToken(projectId);
		const query = new URLSearchParams({ path, ref });
		const response = await this.request("GET", `/repos/file?${query}`, token, {
			maxBodyBytes: maxBytes,
		});
		if (response.status === 404) {
			return null;
		}
		if (response.body === "overCeiling") {
			throw new GitFileTooLargeError(path);
		}
		if (!response.ok || response.body === null) {
			throw new GitStoreError(
				`code.storage file read failed (${response.status})`,
				response.status,
				response.detail,
			);
		}
		return response.body;
	}

	/**
	 * `GET /repos/files` with a `git:read` JWT: one page of the tree at
	 * `ref`. A 404 means no repository or no such ref. A body over
	 * `FILE_LIST_MAX_BODY_BYTES` or a bad body throws `GitStoreError`.
	 */
	async listFilePaths(
		projectId: string,
		ref: string,
		limit: number,
	): Promise<string[] | null> {
		const token = await this.readToken(projectId);
		const query = new URLSearchParams({ limit: String(limit), ref });
		const response = await this.request("GET", `/repos/files?${query}`, token, {
			maxBodyBytes: FILE_LIST_MAX_BODY_BYTES,
		});
		if (response.status === 404) {
			return null;
		}
		if (
			!response.ok ||
			response.body === null ||
			response.body === "overCeiling"
		) {
			throw new GitStoreError(
				`code.storage file list failed (${response.status})`,
				response.status,
				response.detail,
			);
		}
		let body: unknown;
		try {
			body = JSON.parse(new TextDecoder().decode(response.body));
		} catch {
			throw new GitStoreError(
				"code.storage file list answered a body that is not JSON",
				response.status,
				null,
			);
		}
		const listing = codeStorageFileListResponseSchema.safeParse(body);
		// The detail names the bad field paths only, like the GitHub client.
		if (!listing.success) {
			throw new GitStoreError(
				"code.storage file list answered an unexpected body",
				response.status,
				listing.error.issues.map((issue) => issue.path.join(".")).join(", "),
			);
		}
		return listing.data.entries
			.filter((entry) => entry.type === "blob")
			.map((entry) => entry.path);
	}

	/**
	 * `POST /repos/archive` with a `git:read` JWT: the `git archive` tar.gz
	 * at `ref`. Over `ARCHIVE_MAX_GZIP_BYTES` or `ARCHIVE_MAX_TAR_BYTES`, it
	 * answers "overCeiling" and stops the read. It makes one attempt of at
	 * most `ARCHIVE_TIMEOUT_MS`. A 429, a 5xx, a timeout, or a network error
	 * throws `GitStoreError` with no retry. A broken tar throws too.
	 */
	async readArchiveFiles(
		projectId: string,
		ref: string,
		excludeGlobs: string[],
	): Promise<GitArchiveFiles> {
		const token = await this.readToken(projectId);
		const response = await this.request("POST", "/repos/archive", token, {
			answersBytes: true,
			body: JSON.stringify({ exclude_globs: excludeGlobs, ref }),
			maxAttempts: 1,
			maxBodyBytes: ARCHIVE_MAX_GZIP_BYTES,
			timeoutMs: ARCHIVE_TIMEOUT_MS,
		});
		if (response.body === "overCeiling") {
			return { kind: "overCeiling" };
		}
		if (!response.ok || response.body === null) {
			throw new GitStoreError(
				`code.storage archive read failed (${response.status})`,
				response.status,
				response.detail,
			);
		}
		return regularArchiveFiles(response.body);
	}

	// One read token serves every retry of one call; see `FILE_READ_TOKEN_TTL_SECONDS`.
	private readToken(projectId: string): Promise<string> {
		return this.mint(["git:read"], {
			repoName: codeStorageRepoName(projectId),
			ttlSeconds: FILE_READ_TOKEN_TTL_SECONDS,
		});
	}

	/** `iss`/`sub` fixed claims plus the org's signing key from env. */
	private async mint(
		scopes: CodeStorageScope[],
		token: {
			repoName: string;
			ttlSeconds: number;
			now?: Date;
			refs?: CodeStorageRefRule[];
		},
	): Promise<string> {
		const org = requireV2Env("CODE_STORAGE_ORG", this.v2Env);
		const privateKeyPem = requireV2Env("CODE_STORAGE_PRIVATE_KEY", this.v2Env);
		return mintCodeStorageJwt({
			org,
			privateKeyPem,
			repoName: token.repoName,
			scopes,
			refs: token.refs,
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
	 * waits 1 s, 2 s, then 4 s. After the last attempt the call throws a
	 * `GitStoreError` whose detail never carries the JWT. `body` holds the
	 * bytes of a successful GET or `answersBytes` POST, else null. It is
	 * "overCeiling" when those bytes pass `maxBodyBytes`; that answer is final.
	 */
	private async request(
		method: "GET" | "POST" | "DELETE",
		path: string,
		token: string,
		init?: {
			/** JSON request body. */
			body?: string;
			/** True when a successful POST answers bytes, like `/repos/archive`. */
			answersBytes?: boolean;
			/** Most body bytes to keep in memory. No ceiling when undefined. */
			maxBodyBytes?: number;
			/** Attempts before the call throws. Default `MAX_ATTEMPTS`; the archive read uses 1. */
			maxAttempts?: number;
			/** Time limit of one attempt in ms, body included. Default `REQUEST_TIMEOUT_MS`. */
			timeoutMs?: number;
		},
	): Promise<{
		ok: boolean;
		status: number;
		detail: string | null;
		body: Uint8Array | "overCeiling" | null;
	}> {
		const url = `${this.apiBaseUrl()}${path}`;
		const maxAttempts = init?.maxAttempts ?? MAX_ATTEMPTS;
		let lastError: GitStoreError | null = null;

		for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
			try {
				const response = await fetch(url, {
					method,
					headers: {
						authorization: `Bearer ${token}`,
						"content-type": "application/json",
					},
					body: init?.body,
					signal: AbortSignal.timeout(init?.timeoutMs ?? REQUEST_TIMEOUT_MS),
				});
				// A successful GET or `answersBytes` POST answers bytes. Every other answer can carry a problem body.
				const body =
					response.ok && (method === "GET" || init?.answersBytes === true)
						? await readBodyUpTo(
								response,
								init?.maxBodyBytes ?? Number.POSITIVE_INFINITY,
							)
						: null;
				const detail = body === null ? await readProblemDetail(response) : null;
				// A 429 or a 5xx is retryable; anything else is a final answer.
				if (response.status !== 429 && response.status < 500) {
					return { body, detail, ok: response.ok, status: response.status };
				}
				lastError = new GitStoreError(
					`code.storage ${method} ${path} answered ${response.status}`,
					response.status,
					detail,
				);
				if (attempt === maxAttempts - 1) {
					break;
				}
				// A 429 without a parseable Retry-After waits the same backoff
				// as a 5xx — the cap is a clamp, not a default.
				const waitMs =
					(response.status === 429 ? retryAfterMs(response) : null) ??
					RETRY_DELAYS_MS[attempt] ??
					4_000;
				this.logger.warn(
					`code.storage ${method} ${path} answered ${response.status}; retry ${attempt + 1}/${maxAttempts - 1}`,
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
				if (attempt === maxAttempts - 1) {
					break;
				}
				this.logger.warn(
					`code.storage ${method} ${path} failed; retry ${attempt + 1}/${maxAttempts - 1}`,
				);
				await this.sleep(RETRY_DELAYS_MS[attempt] ?? 4_000);
			}
		}

		// The loop only exits after a recorded failure; the fallback covers
		// an impossible exit with no failure.
		throw (
			lastError ??
			new GitStoreError(
				`code.storage ${method} ${path} exhausted ${maxAttempts} attempts`,
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

// The scopes and the refs claim of one access. The `never` default makes a
// new access value fail the compile. It never gets the claim of another
// access. A push needs both scopes: `git:read` for fetch, `git:write` for
// push. One scope never includes the other.
function credentialClaims(access: GitCredentialAccess): {
	scopes: CodeStorageScope[];
	refs: CodeStorageRefRule[] | undefined;
} {
	switch (access) {
		case "read":
			return { scopes: ["git:read"], refs: undefined };
		case "push-main":
			return { scopes: ["git:read", "git:write"], refs: PUSH_MAIN_REFS };
		case "push-github-mirror":
			return { scopes: ["git:read", "git:write"], refs: GITHUB_MIRROR_REFS };
		default: {
			const unknownAccess: never = access;
			throw new Error(`Unknown git credential access: ${unknownAccess}`);
		}
	}
}

/**
 * The bytes of `response`, or "overCeiling" when it has more than `maxBytes`
 * bytes. A larger Content-Length stops before the body. Without the header,
 * the read stops at the chunk that passes the ceiling. Both cancel the body.
 */
async function readBodyUpTo(
	response: Response,
	maxBytes: number,
): Promise<Uint8Array | "overCeiling"> {
	// A missing header parses as NaN, and NaN is never larger.
	const declaredBytes = Number.parseInt(
		response.headers.get("content-length") ?? "",
		10,
	);
	if (declaredBytes > maxBytes) {
		await response.body?.cancel();
		return "overCeiling";
	}
	if (response.body === null) {
		return new Uint8Array();
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			return Buffer.concat(chunks);
		}
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			return "overCeiling";
		}
		chunks.push(value);
	}
}

/**
 * The regular files of a `git archive` tar.gz by path. A folder, a symlink,
 * and a pax header give no file. Over `ARCHIVE_MAX_TAR_BYTES`, it answers
 * "overCeiling". A broken archive throws.
 */
function regularArchiveFiles(archive: Uint8Array): GitArchiveFiles {
	const files = new Map<string, Uint8Array>();
	// git writes a pax "x" header before an entry whose path does not fit the
	// ustar fields. That entry holds a cut path, so it is skipped.
	// LIMIT: a file whose path needs a pax header gets no prefetch, so it loads
	// on a click. Upgrade: read the path record of the pax header.
	let afterPaxHeader = false;
	try {
		for (const entry of tarEntries(archive, ARCHIVE_MAX_TAR_BYTES)) {
			if (isRegularFile(entry) && !afterPaxHeader) {
				files.set(entry.path, entry.content);
			}
			afterPaxHeader = entry.type === "x";
		}
	} catch (error: unknown) {
		// zlib throws this RangeError when the tar passes `maxOutputLength`.
		if (
			error instanceof RangeError &&
			"code" in error &&
			error.code === "ERR_BUFFER_TOO_LARGE"
		) {
			return { kind: "overCeiling" };
		}
		throw error;
	}
	return { files, kind: "files" };
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
