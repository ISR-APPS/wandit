/**
 * GitHub REST and OAuth client of the Wandit GitHub App (the GitHub sync).
 * The API GitHub routes and the `github-sync` Trigger task call it; the task builds it with `new`.
 * It signs App JWTs with `jose`, mints repo-scoped installation tokens, and calls GitHub with `fetch`.
 * The GitHub webhook route calls it to check the HMAC signature of a delivery.
 * It parses every answer with a contracts schema. No error message, cause, or field carries a token.
 */
import { createHmac, createPrivateKey, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
	type GithubAccountType,
	type GithubInstallation,
	githubBranchResponseSchema,
	githubCollaboratorPermissionResponseSchema,
	githubErrorResponseSchema,
	githubInstallationsResponseSchema,
	githubInstallationTokenResponseSchema,
	githubOAuthTokenResponseSchema,
	githubRepositoryResponseSchema,
	githubUserResponseSchema,
	type V2EnvName,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { SignJWT } from "jose";
import type { z } from "zod";

import { requireV2Env, V2_ENV, type V2EnvSource } from "../env/v2-env";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_WEB_BASE_URL = "https://github.com";
const GITHUB_API_VERSION = "2022-11-28";
// GitHub refuses a REST call without a User-Agent header.
const USER_AGENT = "wandit";
// 30 s. GitHub answers in about 1 s; a hung call must not hold a route or a task run.
const REQUEST_TIMEOUT_MS = 30_000;
// GitHub refuses an App JWT whose `iat` is in the future. 60 s back covers
// the clock drift between this host and GitHub.
const APP_JWT_BACKDATE_SECONDS = 60;
// GitHub refuses an App JWT that lives more than 10 minutes: 540 s after now
// is 600 s after the back-dated `iat`.
const APP_JWT_LIFETIME_SECONDS = 540;
// An installation token lives 1 hour. The cache gives a token only while it
// has more than 5 minutes left. Then a git fetch or push ends before the token expires.
const INSTALLATION_TOKEN_MIN_LIFE_MS = 5 * 60_000;
// LIMIT: first 100 installations of the user. Upgrade: follow the Link header.
const INSTALLATIONS_PAGE_SIZE = 100;
// The OAuth error codes that mean the code or the refresh token is dead. Any
// other code (for example `incorrect_client_credentials`) is a config error.
const DEAD_GRANT_ERRORS = new Set([
	"bad_refresh_token",
	"bad_verification_code",
]);

/** The env values the client needs. All five must be set for `isConfigured`. */
const GITHUB_APP_ENV_NAMES = [
	"GITHUB_APP_ID",
	"GITHUB_APP_SLUG",
	"GITHUB_APP_CLIENT_ID",
	"GITHUB_APP_CLIENT_SECRET",
	"GITHUB_APP_PRIVATE_KEY",
] as const satisfies readonly V2EnvName[];

/**
 * The permissions an installation token asks for. GitHub always adds
 * Metadata read. Never ask for Administration.
 */
export type GithubTokenPermissions = {
	contents: "read" | "write";
	workflows?: "write";
};

/** Token of the status route head check and of the link check after a repo create. */
export const GITHUB_READ_PERMISSIONS = {
	contents: "read",
} as const satisfies GithubTokenPermissions;

/** Token of the `github-sync` worker: fetch, push `main`, and push workflow files that came from GitHub. */
export const GITHUB_SYNC_PERMISSIONS = {
	contents: "write",
	workflows: "write",
} as const satisfies GithubTokenPermissions;

/** A user access token pair from the OAuth token endpoint. The dates are absolute. */
export type GithubUserTokens = {
	accessToken: string;
	/** Null when the App does not expire user tokens. */
	accessTokenExpiresAt: Date | null;
	/** Null when the App does not expire user tokens. GitHub accepts each refresh token once. */
	refreshToken: string | null;
	refreshTokenExpiresAt: Date | null;
};

/** The GitHub user behind a user token: its numeric id and its current login. */
export type GithubUser = z.output<typeof githubUserResponseSchema>;

/** A collaborator's base role on a repo. "maintain" reads as "write", "triage" as "read". */
export type GithubRepoPermission = z.output<
	typeof githubCollaboratorPermissionResponseSchema
>["permission"];

/** Input of `createRepository`. */
export type CreateGithubRepositoryInput = {
	/** "User" creates the repo under the token owner; "Organization" under `ownerLogin`. */
	ownerType: GithubAccountType;
	/** Login of the org. For a "User" the caller checks it equals the token owner. */
	ownerLogin: string;
	/** Repo name; the contracts body schema checks its characters. */
	name: string;
	private: boolean;
};

/** A repo that `createRepository` made. */
export type GithubRepository = {
	/** GitHub repo id; `installationToken` limits a token to it. */
	id: number;
	name: string;
	ownerLogin: string;
};

/**
 * One failed GitHub call. The message names the call and the status, never a
 * token. The worker and the routes branch on `status`.
 */
export class GithubApiError extends Error {
	constructor(
		message: string,
		/** HTTP status of the answer, or null on a network failure or a timeout. */
		readonly status: number | null,
	) {
		super(message);
		this.name = "GithubApiError";
	}
}

/**
 * GitHub refused a code exchange or a token refresh because the grant is dead:
 * `bad_verification_code` or `bad_refresh_token`. Any other refusal, a config
 * error, or a network failure is a plain `GithubApiError`, so the caller keeps the stored tokens.
 */
export class GithubOAuthRejectedError extends GithubApiError {
	constructor(message: string, status: number) {
		super(message, status);
		this.name = "GithubOAuthRejectedError";
	}
}

/** `createRepository` found a repo with the same name on the owner (GitHub 422). */
export class GithubRepoExistsError extends GithubApiError {
	constructor(message: string) {
		super(message, 422);
		this.name = "GithubRepoExistsError";
	}
}

/** Test seam. Production leaves it undefined; a spec passes a fake `fetch`. */
export type GithubAppClientOptions = {
	fetch?: typeof fetch;
};

/** One cached installation token and its expiry in epoch ms. */
type CachedInstallationToken = { token: string; expiresAtMs: number };

/** The GitHub App calls of the GitHub sync. One instance per process keeps the token cache. */
@Injectable()
export class GithubAppClient {
	private readonly installationTokens = new Map<
		string,
		CachedInstallationToken
	>();

	constructor(
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		// A spec seam; the module never binds it, so Nest passes undefined.
		@Optional()
		private readonly options?: GithubAppClientOptions,
	) {}

	/** True when every `GITHUB_APP_*` env value is set. The routes answer it as `appConfigured`. */
	isConfigured(): boolean {
		return GITHUB_APP_ENV_NAMES.every((name) => this.v2Env[name] !== undefined);
	}

	/** True when `GITHUB_APP_WEBHOOK_SECRET` is set. The status route then reads GitHub less often. */
	isWebhookConfigured(): boolean {
		return this.v2Env.GITHUB_APP_WEBHOOK_SECRET !== undefined;
	}

	/**
	 * True when `signature`, the `X-Hub-Signature-256` header (`sha256=<hex>`), is the
	 * HMAC SHA-256 of `rawBody` with the webhook secret. Throws 503 V2_ENV_MISSING without the secret.
	 */
	isValidWebhookSignature(
		rawBody: Buffer,
		signature: string | undefined,
	): boolean {
		const secret = requireV2Env("GITHUB_APP_WEBHOOK_SECRET", this.v2Env);
		if (signature === undefined) {
			return false;
		}
		const expected = Buffer.from(
			`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
		);
		const received = Buffer.from(signature);
		// Security: the constant-time compare hides how many bytes match.
		// `timingSafeEqual` throws on two lengths, so the length check comes first.
		return (
			received.length === expected.length && timingSafeEqual(received, expected)
		);
	}

	/**
	 * An installation token that reaches only `repoId`, with only
	 * `permissions`. Cached per installation, repo, and permission set.
	 * Throws `GithubApiError`: 401, 403, 404, or 422 means the App lost the
	 * installation or the repo.
	 */
	async installationToken(
		installationId: number,
		repoId: number,
		permissions: GithubTokenPermissions,
	): Promise<string> {
		// Security: the key holds the permission set, so a read request
		// never gets a cached write token.
		const cacheKey = `${installationId}:${repoId}:contents=${permissions.contents}:workflows=${permissions.workflows ?? "none"}`;
		const cached = this.installationTokens.get(cacheKey);
		if (
			cached !== undefined &&
			cached.expiresAtMs - Date.now() > INSTALLATION_TOKEN_MIN_LIFE_MS
		) {
			return cached.token;
		}
		const answer = await this.rest(
			"POST",
			`/app/installations/${installationId}/access_tokens`,
			await this.appJwt(),
			githubInstallationTokenResponseSchema,
			JSON.stringify({ repository_ids: [repoId], permissions }),
		);
		// Tokens near their end leave the cache when a new one comes in, so
		// the map holds only the repos of the last hour.
		for (const [key, entry] of this.installationTokens) {
			if (entry.expiresAtMs - Date.now() <= INSTALLATION_TOKEN_MIN_LIFE_MS) {
				this.installationTokens.delete(key);
			}
		}
		this.installationTokens.set(cacheKey, {
			expiresAtMs: Date.parse(answer.expires_at),
			token: answer.token,
		});
		return answer.token;
	}

	/** Head sha of one branch, or null when the branch or the repo is not there (an empty repo has no `main`). */
	async branchHeadSha(
		token: string,
		owner: string,
		repo: string,
		branch: string,
	): Promise<string | null> {
		try {
			const answer = await this.rest(
				"GET",
				`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`,
				token,
				githubBranchResponseSchema,
			);
			return answer.commit.sha;
		} catch (error) {
			if (error instanceof GithubApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * The current login of a GitHub user id, or null on a 404 (a deleted
	 * account). `token` can be any token, for example an installation token.
	 */
	async userLogin(token: string, githubUserId: number): Promise<string | null> {
		try {
			const answer = await this.rest(
				"GET",
				`/user/${githubUserId}`,
				token,
				githubUserResponseSchema,
			);
			return answer.login;
		} catch (error) {
			if (error instanceof GithubApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * The base role of `login` on the repo, or null on a 404 (no such user or
	 * repo). A 403 throws: the App may lack a permission.
	 */
	async collaboratorPermission(
		token: string,
		owner: string,
		repo: string,
		login: string,
	): Promise<GithubRepoPermission | null> {
		try {
			const answer = await this.rest(
				"GET",
				`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(login)}/permission`,
				token,
				githubCollaboratorPermissionResponseSchema,
			);
			return answer.permission;
		} catch (error) {
			if (error instanceof GithubApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	/** The GitHub sign-in page of the connect. `redirectUri` is the API callback URL. */
	authorizeUrl(state: string, redirectUri: string): string {
		const url = new URL("/login/oauth/authorize", GITHUB_WEB_BASE_URL);
		url.searchParams.set(
			"client_id",
			requireV2Env("GITHUB_APP_CLIENT_ID", this.v2Env),
		);
		url.searchParams.set("redirect_uri", redirectUri);
		url.searchParams.set("state", state);
		return url.toString();
	}

	/** The App install page; GitHub sends the user to the App callback URL after it. */
	installUrl(state: string): string {
		const slug = requireV2Env("GITHUB_APP_SLUG", this.v2Env);
		const url = new URL(
			`/apps/${encodeURIComponent(slug)}/installations/new`,
			GITHUB_WEB_BASE_URL,
		);
		url.searchParams.set("state", state);
		return url.toString();
	}

	/** Exchanges the callback `code`. Throws `GithubOAuthRejectedError` on `bad_verification_code` (a bad or used code). */
	async exchangeCode(
		code: string,
		redirectUri: string,
	): Promise<GithubUserTokens> {
		return this.requestUserToken(
			new URLSearchParams({
				client_id: requireV2Env("GITHUB_APP_CLIENT_ID", this.v2Env),
				client_secret: requireV2Env("GITHUB_APP_CLIENT_SECRET", this.v2Env),
				code,
				redirect_uri: redirectUri,
			}),
		);
	}

	/**
	 * New tokens for a refresh token. GitHub accepts each refresh token once,
	 * so the caller stores the answer with a compare-and-swap. Throws
	 * `GithubOAuthRejectedError` only on `bad_refresh_token` (a used or expired refresh token).
	 */
	async refreshUserToken(refreshToken: string): Promise<GithubUserTokens> {
		return this.requestUserToken(
			new URLSearchParams({
				client_id: requireV2Env("GITHUB_APP_CLIENT_ID", this.v2Env),
				client_secret: requireV2Env("GITHUB_APP_CLIENT_SECRET", this.v2Env),
				grant_type: "refresh_token",
				refresh_token: refreshToken,
			}),
		);
	}

	/** The user behind a user token, with its id. A 401 means GitHub revoked the token. */
	async getUser(userToken: string): Promise<GithubUser> {
		return this.rest("GET", "/user", userToken, githubUserResponseSchema);
	}

	/** The App installations the user can reach, users and orgs only. */
	async listUserInstallations(
		userToken: string,
	): Promise<GithubInstallation[]> {
		const answer = await this.rest(
			"GET",
			`/user/installations?per_page=${INSTALLATIONS_PAGE_SIZE}`,
			userToken,
			githubInstallationsResponseSchema,
		);
		return answer.installations.flatMap((installation) =>
			installation.account === null
				? []
				: [
						{
							accountId: installation.account.id,
							accountLogin: installation.account.login,
							accountType: installation.account.type,
							id: installation.id,
						},
					],
		);
	}

	/**
	 * Creates an empty repo with the user token, so the first sync pushes the
	 * whole project history as a fast-forward. Throws `GithubRepoExistsError`
	 * when the name is taken.
	 */
	async createRepository(
		userToken: string,
		input: CreateGithubRepositoryInput,
	): Promise<GithubRepository> {
		const path =
			input.ownerType === "User"
				? "/user/repos"
				: `/orgs/${encodeURIComponent(input.ownerLogin)}/repos`;
		const answer = await this.rest(
			"POST",
			path,
			userToken,
			githubRepositoryResponseSchema,
			JSON.stringify({
				auto_init: false,
				name: input.name,
				private: input.private,
			}),
		);
		return {
			id: answer.id,
			name: answer.name,
			ownerLogin: answer.owner.login,
		};
	}

	// RS256 App JWT; GitHub reads the App id from `iss`.
	private async appJwt(): Promise<string> {
		const appId = requireV2Env("GITHUB_APP_ID", this.v2Env);
		// The env schema already proved the PEM is an RSA key.
		const privateKey = createPrivateKey(
			requireV2Env("GITHUB_APP_PRIVATE_KEY", this.v2Env),
		);
		// JWT time claims count whole seconds, not ms.
		const nowSeconds = Math.floor(Date.now() / 1000);
		return new SignJWT({})
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer(appId)
			.setIssuedAt(nowSeconds - APP_JWT_BACKDATE_SECONDS)
			.setExpirationTime(nowSeconds + APP_JWT_LIFETIME_SECONDS)
			.sign(privateKey);
	}

	// One REST call with a bearer token (App JWT, installation token, or user
	// token). A non-2xx answer throws `GithubApiError`.
	private async rest<S extends z.ZodType>(
		method: "GET" | "POST",
		path: string,
		token: string,
		schema: S,
		jsonBody?: string,
	): Promise<z.output<S>> {
		const label = `${method} ${path}`;
		const headers: Record<string, string> = {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${token}`,
			"user-agent": USER_AGENT,
			"x-github-api-version": GITHUB_API_VERSION,
		};
		if (jsonBody !== undefined) {
			headers["content-type"] = "application/json";
		}
		const response = await this.send(
			method,
			`${GITHUB_API_BASE_URL}${path}`,
			headers,
			jsonBody,
			label,
		);
		if (!response.ok) {
			throw await githubApiError(label, response);
		}
		return parseAnswer(response, schema, label);
	}

	// The OAuth token endpoint of the code exchange and the refresh.
	private async requestUserToken(
		form: URLSearchParams,
	): Promise<GithubUserTokens> {
		const label = "POST /login/oauth/access_token";
		// Security: the client secret, the code, and the refresh token go
		// in a form body, never in the URL. So no span or log records them.
		const response = await this.send(
			"POST",
			`${GITHUB_WEB_BASE_URL}/login/oauth/access_token`,
			{
				// Without this header GitHub answers form data, not JSON.
				accept: "application/json",
				"content-type": "application/x-www-form-urlencoded",
				"user-agent": USER_AGENT,
			},
			form.toString(),
			label,
		);
		if (!response.ok) {
			throw await githubApiError(label, response);
		}
		const answer = await parseAnswer(
			response,
			githubOAuthTokenResponseSchema,
			label,
		);
		// GitHub answers a refused request with HTTP 200 and an `error` code.
		if ("error" in answer) {
			const message = `GitHub refused the token request (${answer.error})`;
			// Only a dead grant clears the stored tokens. A config error keeps them.
			if (DEAD_GRANT_ERRORS.has(answer.error)) {
				throw new GithubOAuthRejectedError(message, response.status);
			}
			throw new GithubApiError(message, response.status);
		}
		const nowMs = Date.now();
		// GitHub counts both lifetimes in seconds from the answer.
		return {
			accessToken: answer.access_token,
			accessTokenExpiresAt:
				answer.expires_in === undefined
					? null
					: new Date(nowMs + answer.expires_in * 1000),
			refreshToken: answer.refresh_token ?? null,
			refreshTokenExpiresAt:
				answer.refresh_token_expires_in === undefined
					? null
					: new Date(nowMs + answer.refresh_token_expires_in * 1000),
		};
	}

	private async send(
		method: "GET" | "POST",
		url: string,
		headers: Record<string, string>,
		body: string | undefined,
		label: string,
	): Promise<Response> {
		const fetchImpl = this.options?.fetch ?? fetch;
		try {
			return await fetchImpl(url, {
				body,
				headers,
				method,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			// A network failure or the 30 s timeout. The fetch error names the
			// URL at most; the headers with the token never reach it.
			throw new GithubApiError(
				`GitHub ${label} failed: ${getErrorMessage(error)}`,
				null,
			);
		}
	}
}

// Parses a 2xx JSON body. A bad body throws with the failing field paths,
// never with the values, because a value can be a token.
async function parseAnswer<S extends z.ZodType>(
	response: Response,
	schema: S,
	label: string,
): Promise<z.output<S>> {
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new GithubApiError(
			`GitHub ${label} answered a body that is not JSON`,
			response.status,
		);
	}
	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		const paths = parsed.error.issues
			.map((issue) => issue.path.join("."))
			.join(", ");
		throw new GithubApiError(
			`GitHub ${label} answered an unexpected body (${paths})`,
			response.status,
		);
	}
	return parsed.data;
}

// The typed error of a non-2xx answer. GitHub error bodies hold a message
// and a list of field errors; neither holds a token.
async function githubApiError(
	label: string,
	response: Response,
): Promise<GithubApiError> {
	let body: z.output<typeof githubErrorResponseSchema> | null = null;
	try {
		const parsed = githubErrorResponseSchema.safeParse(await response.json());
		body = parsed.success ? parsed.data : null;
	} catch {
		// A body that is not JSON (an HTML 502 page) has no message; the
		// status alone describes the failure.
		body = null;
	}
	// 200 characters of the GitHub message keep one log line short.
	const message = `GitHub ${label} answered ${response.status}${body === null ? "" : `: ${body.message.slice(0, 200)}`}`;
	const texts = [
		body?.message ?? "",
		...(body?.errors ?? []).map((error) => error.message ?? ""),
	];
	// GitHub answers 422 "name already exists on this account" for a taken repo name.
	if (
		response.status === 422 &&
		texts.some((text) => /already exists/i.test(text))
	) {
		return new GithubRepoExistsError(message);
	}
	return new GithubApiError(message, response.status);
}
