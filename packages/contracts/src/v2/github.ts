/**
 * Shared contract for the GitHub two-way sync of V2 app projects.
 * The API GitHub routes answer the first group of schemas, and the web parses them.
 * The second group parses GitHub REST and OAuth answers and webhook deliveries at the trust boundary.
 * `GithubAppClient` and `GithubWebhookController` in the server read the second group.
 */
import { z } from "zod";
import { appCommitSchema, commitShaSchema } from "./versions";

/** Query param that the OAuth callback adds to the return URL after a connect. Value "connected". */
export const GITHUB_CONNECTED_PARAM = "github" as const;

/** Query param that the OAuth callback adds to the return URL after a failure. Value: a `githubCallbackErrorCodes` item. */
export const GITHUB_ERROR_PARAM = "github_error" as const;

/**
 * Error codes of the OAuth callback redirect. They go into the URL, so they
 * never carry a token or a GitHub error text.
 */
export const githubCallbackErrorCodes = [
	"invalid_state",
	"access_denied",
	"exchange_failed",
] as const;

/** Runtime validator for a callback error code; the web shows each one through `t()`. */
export const githubCallbackErrorCodeSchema = z.enum(githubCallbackErrorCodes);

/** TypeScript callback error code type. */
export type GithubCallbackErrorCode = z.infer<
	typeof githubCallbackErrorCodeSchema
>;

/**
 * Error codes that the sync worker writes to `project_github_links.last_error`.
 * The DB column is text; the repository parses it with this list.
 */
export const githubSyncErrorCodes = [
	"GITHUB_ACCESS_LOST",
	"GITHUB_LINK_OWNER_LEFT",
	"GITHUB_LINKER_NO_ACCESS",
	"GITHUB_PUSH_REJECTED",
	"GITHUB_WORKFLOW_CHANGED",
	"GITHUB_SYNC_FAILED",
] as const;

/** Runtime validator for a sync error code. */
export const githubSyncErrorCodeSchema = z.enum(githubSyncErrorCodes);

/** TypeScript sync error code type. */
export type GithubSyncErrorCode = z.infer<typeof githubSyncErrorCodeSchema>;

/** The GitHub account kinds where the App can be installed and where the builder creates a repo. */
export const githubAccountTypes = ["User", "Organization"] as const;

/** Runtime validator for a GitHub account kind. */
export const githubAccountTypeSchema = z.enum(githubAccountTypes);

/** TypeScript GitHub account kind type. */
export type GithubAccountType = z.infer<typeof githubAccountTypeSchema>;

/** One installation of the Wandit GitHub App that the connected user can reach. */
export const githubInstallationSchema = z.object({
	/** GitHub installation id. The link route checks it against this list again. */
	id: z.int().positive(),
	/** Login of the user or org that installed the App. */
	accountLogin: z.string().min(1),
	/** Numeric GitHub id of that user or org. The link route compares a personal one with the connected user id. */
	accountId: z.int().positive(),
	accountType: githubAccountTypeSchema,
});

/** TypeScript installation type. */
export type GithubInstallation = z.infer<typeof githubInstallationSchema>;

/** Answer of `GET /api/v2/github/account`. */
export const githubAccountResponseSchema = z.object({
	/** False when the five `GITHUB_APP_*` env values are not all set. The panel then shows a muted text. */
	appConfigured: z.boolean(),
	/** True when the user has a usable GitHub user token. */
	connected: z.boolean(),
	/** GitHub login of the connected user; null when not connected. */
	login: z.string().nullable(),
	/** Empty when not connected. */
	installations: z.array(githubInstallationSchema),
});

/** TypeScript account response type. */
export type GithubAccountResponse = z.infer<typeof githubAccountResponseSchema>;

/** "authorize" signs the user in to GitHub. "install" adds the App to one more account or org. */
export const githubAuthorizeFlows = ["authorize", "install"] as const;

/** Body of `POST /api/v2/github/authorize`. */
export const githubAuthorizeBodySchema = z.object({
	/** Builder URL to return to after GitHub. Its origin must equal `CORS_ORIGIN`. */
	returnUrl: z.url(),
	flow: z.enum(githubAuthorizeFlows),
});

/** TypeScript authorize body type. */
export type GithubAuthorizeBody = z.infer<typeof githubAuthorizeBodySchema>;

/** Answer of `POST /api/v2/github/authorize`: the GitHub page the web opens next. */
export const githubAuthorizeResponseSchema = z.object({
	url: z.url(),
});

/** TypeScript authorize response type. */
export type GithubAuthorizeResponse = z.infer<
	typeof githubAuthorizeResponseSchema
>;

/**
 * Query of `GET /api/v2/github/callback`, sent by GitHub. Each field falls
 * back to undefined on a bad value, for example a repeated param. Then the
 * callback always answers a redirect and never a 400 body.
 */
export const githubCallbackQuerySchema = z.object({
	state: z.string().min(1).optional().catch(undefined),
	/** OAuth code. Missing after an install without OAuth. */
	code: z.string().min(1).optional().catch(undefined),
	/** GitHub error code, for example "access_denied". */
	error: z.string().min(1).optional().catch(undefined),
	/** Sent after an install. Never trusted: the link route reads `/user/installations`. */
	installation_id: z.coerce
		.number()
		.int()
		.positive()
		.optional()
		.catch(undefined),
	/** "install", "update", or "request" after an install. */
	setup_action: z.string().min(1).optional().catch(undefined),
});

/** TypeScript callback query type. */
export type GithubCallbackQuery = z.infer<typeof githubCallbackQuerySchema>;

/** The GitHub link of one project, as the builder panel and the update banner read it. */
export const projectGithubLinkSchema = z.object({
	repoOwner: z.string(),
	repoName: z.string(),
	/** `https://github.com/<owner>/<repo>`. */
	htmlUrl: z.url(),
	/** GitHub head that the project last pushed or pulled; null before the first sync. */
	lastSyncedSha: commitShaSchema.nullable(),
	/** GitHub head that the worker last saw; null before the first sync. */
	remoteHeadSha: commitShaSchema.nullable(),
	/** True when GitHub has commits that the project did not pull. The banner shows "Update". */
	updateAvailable: z.boolean(),
	/** Why the last sync stopped; null after a good sync. */
	lastError: githubSyncErrorCodeSchema.nullable(),
});

/** TypeScript project link type. */
export type ProjectGithubLink = z.infer<typeof projectGithubLinkSchema>;

/** Answer of `GET /api/v2/projects/:id/github` and of the link route. */
export const projectGithubStatusResponseSchema = z.object({
	appConfigured: z.boolean(),
	/** Null when the project has no GitHub repo. */
	link: projectGithubLinkSchema.nullable(),
	/** `app_branches(main).head_sha`; the pull sends it back as `expectedHeadSha`. */
	headSha: commitShaSchema.nullable(),
});

/** TypeScript project status response type. */
export type ProjectGithubStatusResponse = z.infer<
	typeof projectGithubStatusResponseSchema
>;

/** Body of `POST /api/v2/projects/:id/github`: create a GitHub repo and link it. */
export const createGithubRepositoryBodySchema = z.object({
	/** One id of the account answer. The route checks it against `/user/installations`. */
	installationId: z.int().positive(),
	/** GitHub repo name: letters, digits, `.`, `_`, `-`, at most 100 characters. */
	name: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/, "invalid repository name"),
	private: z.boolean().default(true),
});

/** TypeScript create-repository body type. */
export type CreateGithubRepositoryBody = z.infer<
	typeof createGithubRepositoryBodySchema
>;

/** Body of `POST /api/v2/projects/:id/github/pull`. A stale head answers 409 VERSION_CONFLICT. */
export const githubPullBodySchema = z.object({
	/** The `headSha` of the last status answer. Compare-and-swap input. */
	expectedHeadSha: commitShaSchema.nullable(),
});

/** TypeScript pull body type. */
export type GithubPullBody = z.infer<typeof githubPullBodySchema>;

/** Answer of the pull: the merge commit, or null when the project already had the GitHub commits. */
export const githubPullResponseSchema = z.object({
	commit: appCommitSchema.nullable(),
});

/** TypeScript pull response type. */
export type GithubPullResponse = z.infer<typeof githubPullResponseSchema>;

// GitHub REST and OAuth answers and webhook deliveries below. Each schema
// names only the fields the server reads.

/** A good answer of `POST https://github.com/login/oauth/access_token`. Expiry fields are seconds from now. */
const githubOAuthTokenSuccessSchema = z.object({
	access_token: z.string().min(1),
	/** Missing when the App does not expire user tokens. */
	expires_in: z.int().positive().optional(),
	refresh_token: z.string().min(1).optional(),
	refresh_token_expires_in: z.int().positive().optional(),
});

/** A refused token request. GitHub answers it with HTTP 200, for example `bad_refresh_token`. */
const githubOAuthTokenErrorSchema = z.object({
	error: z.string().min(1),
	error_description: z.string().optional(),
});

/** Any answer of the token endpoint: the error shape or the success shape. */
export const githubOAuthTokenResponseSchema = z.union([
	githubOAuthTokenErrorSchema,
	githubOAuthTokenSuccessSchema,
]);

/**
 * Answer of `GET /user` and of `GET /user/{account_id}`. The id never
 * changes; the login changes when the user renames the account.
 */
export const githubUserResponseSchema = z.object({
	id: z.int().positive(),
	login: z.string().min(1),
});

/**
 * Answer of `GET /user/installations`. An account that is not a user or an
 * org (an enterprise has no `login`) parses as null, and the client drops it.
 */
export const githubInstallationsResponseSchema = z.object({
	installations: z.array(
		z.object({
			id: z.int().positive(),
			account: z
				.object({
					id: z.int().positive(),
					login: z.string().min(1),
					type: githubAccountTypeSchema,
				})
				.nullable()
				.catch(null),
		}),
	),
});

/** Answer of `POST /user/repos` and `POST /orgs/{org}/repos`. */
export const githubRepositoryResponseSchema = z.object({
	id: z.int().positive(),
	name: z.string().min(1),
	owner: z.object({ login: z.string().min(1) }),
});

/** Answer of `POST /app/installations/{id}/access_tokens`. GitHub gives the token 1 hour of life. */
export const githubInstallationTokenResponseSchema = z.object({
	token: z.string().min(1),
	expires_at: z.iso.datetime(),
});

/** Answer of `GET /repos/{owner}/{repo}/branches/{branch}`. */
export const githubBranchResponseSchema = z.object({
	commit: z.object({ sha: commitShaSchema }),
});

/**
 * Answer of `GET /repos/{owner}/{repo}/collaborators/{username}/permission`.
 * GitHub maps "maintain" to "write" and "triage" to "read" in this field.
 */
export const githubCollaboratorPermissionResponseSchema = z.object({
	permission: z.enum(["admin", "write", "read", "none"]),
});

/**
 * The fields of a `push` webhook delivery that the webhook route reads.
 * The route uses `ref` only to skip a push to another branch. It never uses
 * a sha of the body: `GithubProjectService.handlePush` reads the GitHub head itself.
 */
export const githubPushEventSchema = z.object({
	/** Full ref name, for example `refs/heads/main`. */
	ref: z.string(),
	repository: z.object({
		/** GitHub repo id. It finds the project link. */
		id: z.int().positive(),
	}),
});

/** The error body of a failed GitHub REST call. */
export const githubErrorResponseSchema = z.object({
	message: z.string(),
	errors: z.array(z.object({ message: z.string().optional() })).optional(),
});
