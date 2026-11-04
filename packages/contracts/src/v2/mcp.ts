/**
 * Shared values of the Wandit remote MCP server (D29, docs/features/coding-agents-mcp.md).
 * `@wandit/auth` registers the scopes with the OAuth provider and parses OAuth inputs with the schemas here.
 * The API checks the scopes on each tool call. The web consent page shows them in plain words.
 */
import { z } from "zod";

import { projectPromptMaxLength } from "../v1/projects";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";
import { CODE_FILE_MAX_BYTES } from "./code";
import { commitShaSchema } from "./versions";

/**
 * The OAuth scopes that an external coding agent can get. Each MCP tool needs one.
 * A client asks for all four on the first login: Claude Code does not step up after a 403.
 */
export const mcpScopes = [
	// Read workspaces, projects, files, versions, and turns.
	"projects:read",
	// Edit project files directly and wake the sandbox.
	"projects:write",
	// Send prompts to the Wandit builder and cancel its turns. Spends credits.
	"builder:run",
	// Publish the app to its live URL.
	"projects:deploy",
] as const;

/** Parses one space-separated token of an access token `scope`. `offline_access` fails it: no tool needs that scope. */
export const mcpScopeSchema = z.enum(mcpScopes);

/** The scope that one MCP tool needs. Never `offline_access`, which only gives the refresh token. */
export type McpScope = z.infer<typeof mcpScopeSchema>;

/**
 * Every scope that the consent page can grant. `@wandit/auth` registers this list with the OAuth provider.
 * `offline_access` gives the refresh token. It is not a tool scope, so `mcpScopes` does not hold it.
 */
export const mcpConsentScopes = [...mcpScopes, "offline_access"] as const;

/**
 * RFC 8252 section 7.3: a native client listens on a loopback port that it picks at run time.
 * DCR accepts plain http only on these hosts. The consent page uses them to hide a local redirect.
 */
export const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
]);

// The plugin keeps the query of the redirect URI on the code and error redirects.
// A registered `?error=` would hide a real grant from the audit, and a `?code=` would fake one.
const OAUTH_ANSWER_PARAMS = ["code", "error", "state", "iss"];

/**
 * True for an https URL, an http URL on a loopback host, or a `cursor:` URL, with no OAuth answer param.
 * Cursor gets its code on its own `cursor:` scheme. Other schemes can open another app.
 */
function isLoopbackHttpsOrCursorUrl(value: string): boolean {
	if (!URL.canParse(value)) {
		return false;
	}
	const url = new URL(value);
	if (OAUTH_ANSWER_PARAMS.some((param) => url.searchParams.has(param))) {
		return false;
	}
	return (
		url.protocol === "https:" ||
		url.protocol === "cursor:" ||
		(url.protocol === "http:" && LOOPBACK_HOSTNAMES.has(url.hostname))
	);
}

/**
 * Admission rule of Dynamic Client Registration (`POST /api/auth/oauth2/register`).
 * Only a public client with loopback, https, or `cursor:` redirect URIs passes.
 * `@wandit/auth` also refuses the domains of user apps. The plugin then checks the other fields.
 */
export const mcpClientRegistrationSchema = z.object({
	// Public client: PKCE replaces the secret. The API registers no confidential client.
	token_endpoint_auth_method: z.literal("none"),
	redirect_uris: z
		.array(
			z
				.string()
				.refine(
					isLoopbackHttpsOrCursorUrl,
					"expected an https, loopback, or cursor: URL",
				),
		)
		.min(1),
	// The server calls this URL at each sign-out, so an anonymous client could make it probe a network.
	// zod 4 makes a `z.undefined()` key required, so `never().optional()` refuses only a sent value.
	backchannel_logout_uri: z.never().optional(),
	// The end-session route redirects to these URLs. It is off, and no coding agent needs it.
	post_logout_redirect_uris: z.never().optional(),
});

/** The `prompt` query field of `GET /api/auth/oauth2/authorize`: space-separated values (OIDC Core 3.1.2.1). */
export const oauthAuthorizePromptSchema = z.object({
	prompt: z.string().optional(),
});

/** Body of `POST /api/auth/oauth2/delete-consent`. The web Revoke button sends it. */
export const oauthDeleteConsentBodySchema = z.object({
	// Id of the `oauth_consent` row, from `GET /api/auth/oauth2/get-consents`.
	id: z.string().min(1),
});

/**
 * The field of a `POST /api/auth/oauth2/token` answer that the `@wandit/auth` token hook reads.
 * zod drops the refresh token and the other fields.
 */
export const oauthTokenResultSchema = z.object({
	// A JWT for the MCP resource. When no request named a `resource`, the plugin gives an opaque token.
	access_token: z.string().min(1),
});

/**
 * The fields of a `POST /api/auth/oauth2/token` body that the `@wandit/auth` grant check reads.
 * The plugin trims grant_type before it dispatches. Without the same trim, " refresh_token" skips the check.
 * The credentials stay untrimmed, as the plugin reads them. The plugin stores only their SHA-256 hash.
 */
export const oauthTokenRequestBodySchema = z.union([
	z.object({
		grant_type: z.string().trim().pipe(z.literal("authorization_code")),
		// The one-time code from the redirect.
		code: z.string().min(1),
	}),
	z.object({
		grant_type: z.string().trim().pipe(z.literal("refresh_token")),
		// The refresh token from the last token answer.
		refresh_token: z.string().min(1),
	}),
]);

/** A code exchange or a refresh, after the parse. `grant_type` tells which credential the body holds. */
export type OAuthTokenRequestBody = z.infer<typeof oauthTokenRequestBodySchema>;

/**
 * The plugin JSON in `verification.value` for an authorization code, as the `@wandit/auth` code check reads it.
 * zod drops the PKCE challenge, the scopes, and the other fields.
 */
export const oauthAuthorizationCodeValueSchema = z.object({
	// Id of the `user` row that clicked Allow.
	userId: z.string(),
	query: z.object({
		// OAuth client id of the grant: a CIMD document URL, or the id that registration gave.
		client_id: z.string(),
	}),
});

/** Answer of `POST /api/auth/oauth2/consent`. The URL carries `code` when the grant is saved, `error` when denied. */
export const oauthConsentResultSchema = z.object({
	redirect: z.literal(true),
	// Absolute URL: the client redirect URI, or the login page when a fresh sign-in is due.
	url: z.string(),
});

/**
 * Answer of `GET /api/auth/oauth2/public-client`. The web consent page and agent list parse it.
 * zod drops the other fields, such as `logo_uri`: the pages never load a client logo or link.
 */
export const oauthPublicClientSchema = z.object({
	// OAuth client id: a CIMD document URL, or the id that registration gave.
	client_id: z.string(),
	// Free text from the registration or the CIMD document. Untrusted: the pages show it as plain text.
	client_name: z.string().optional(),
});

/** Answer of `GET /api/auth/oauth2/get-consents`: the grants of the signed-in user, one row per OAuth client. */
export const oauthConsentListSchema = z.array(
	z.object({
		// Id of the `oauth_consent` row. `POST /api/auth/oauth2/delete-consent` takes it.
		id: z.string(),
		// OAuth client id: a CIMD document URL, or the id that registration gave.
		clientId: z.string(),
		// The granted scopes, for example "projects:read". The list shows an unknown scope as raw text.
		scopes: z.array(z.string()),
		// ISO 8601 time of the grant. The agent list shows it as the connect date.
		createdAt: isoDateTimeSchema,
	}),
);

/** API paths of the MCP server. Outside `/api/v2`: the resource URL never changes after launch. */
export const mcpRoutes = {
	// POST one JSON-RPC message. This path is also the OAuth resource (`<BETTER_AUTH_URL>/api/mcp`).
	endpoint: "/api/mcp",
	// GET the RFC 9728 Protected Resource Metadata. Outside the `/api` global prefix.
	protectedResourceMetadata: "/.well-known/oauth-protected-resource/api/mcp",
	// GET the RFC 9728 metadata at the root path. Some clients ask here first.
	protectedResourceMetadataRoot: "/.well-known/oauth-protected-resource",
	// GET the RFC 8414 Authorization Server Metadata for the issuer `<BETTER_AUTH_URL>/api/auth`.
	authorizationServerMetadata:
		"/.well-known/oauth-authorization-server/api/auth",
} as const;

/**
 * The claims of a verified MCP access token that the API reads. The jwt() plugin signs them.
 * jose checks `iss`, `aud`, and `exp` first; this parse proves the fields that the guard reads.
 */
export const mcpAccessTokenClaimsSchema = z.object({
	// Id of the `user` row that granted the access.
	sub: z.string().min(1),
	// OAuth client id ("authorized party"): the CIMD document URL, or the id from registration.
	azp: z.string().min(1),
	// Space-separated scopes, for example "projects:read builder:run offline_access".
	scope: z.string(),
	// Expiry, in seconds since the epoch.
	exp: z.number(),
	// Issue time, in seconds since the epoch. The guard refuses a token issued before the current consent.
	iat: z.number(),
});

/** The parsed access token claims; `McpTokenGuard` builds the grant from them. */
export type McpAccessTokenClaims = z.infer<typeof mcpAccessTokenClaimsSchema>;

/**
 * The JSON text of a failed MCP tool call. `code` is stable, and an agent can branch on it.
 * The API also parses its own HTTP error bodies with it, which have the same two fields.
 */
export const mcpToolErrorSchema = z.object({
	code: z.string().min(1),
	message: z.string(),
});

/** One tool error, for example `{ code: "HEAD_MOVED", message: "..." }`. */
export type McpToolError = z.infer<typeof mcpToolErrorSchema>;

/**
 * The fields of one JSON-RPC message that `POST /api/mcp` reads before the MCP SDK.
 * The controller refuses a batch (an array) and `subscriptions/listen`. The SDK validates the rest.
 */
export const mcpJsonRpcEnvelopeSchema = z.object({
	// The JSON-RPC method, for example "tools/call". A response message has none.
	method: z.string().optional(),
	// The request id. The refusal echoes it, so the client can match the error.
	id: z.union([z.string(), z.number()]).optional(),
});

/** Most changes in one `apply_changes` call. One call is one commit. */
export const MCP_CHANGES_MAX_FILES = 50;

/** 2 MiB of UTF-8 file content in one `apply_changes` call. main.ts limits the body of `/api/mcp` to 3 MiB. */
export const MCP_CHANGES_MAX_BYTES = 2 * 1024 * 1024;

// Unicode category Cc: U+0000 to U+001F and U+007F to U+009F.
// A newline in a path segment bypassed the server deny list.
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

// Linux PATH_MAX, as `codeFileQuerySchema`: a longer path cannot name a file.
const mcpPathSchema = z
	.string()
	.min(1)
	.max(4_096)
	.refine(
		(path) => !CONTROL_CHARACTER_PATTERN.test(path),
		"path must not hold a control character",
	);

/** Input of the MCP tools that read or act on one project. */
export const mcpProjectInputSchema = z.object({
	// Id of a V2 project, from `list_projects`.
	projectId: uuidSchema,
});

/** Input of `list_projects`. One page holds a fixed number of projects, newest first. */
export const mcpListProjectsInputSchema = z.object({
	// "personal", or the id of a team from `list_workspaces`. Absent means "personal".
	workspaceId: z.string().min(1).max(128).optional(),
	// Index of the first project of the page: 0, or the `nextOffset` of the previous page.
	offset: z.int().nonnegative().default(0),
});

/** Input of `list_files`. One page holds a fixed number of paths. */
export const mcpListFilesInputSchema = mcpProjectInputSchema.extend({
	// Index of the first path of the page: 0, or the `nextOffset` of the previous page.
	offset: z.int().nonnegative().default(0),
});

/** Input of `read_file`. One page holds a fixed number of characters. */
export const mcpReadFileInputSchema = mcpProjectInputSchema.extend({
	// Path relative to the project root, as `list_files` gives it.
	path: mcpPathSchema,
	// Index of the first character of the page: 0, or the `nextOffset` of the previous page.
	offset: z.int().nonnegative().default(0),
});

/** Input of `list_versions`, newest first. */
export const mcpListVersionsInputSchema = mcpProjectInputSchema.extend({
	// The `nextCursor` of the previous page. The server parses it with `versionCursorSchema`.
	cursor: z.string().min(1).max(200).optional(),
	limit: z.int().min(1).max(50).default(20),
});

/** Input of `get_turn`. A turn of another project answers the tool error NOT_FOUND. */
export const mcpGetTurnInputSchema = mcpProjectInputSchema.extend({
	// Id of the turn, from `send_prompt`.
	turnId: uuidSchema,
	// Seconds to wait while the turn runs. 25 s keeps the call under the client timeouts.
	waitSeconds: z.int().min(0).max(25).default(0),
});

/** Input of `cancel_turn`. A turn of another project answers the tool error NOT_FOUND. */
export const mcpCancelTurnInputSchema = mcpProjectInputSchema.extend({
	turnId: uuidSchema,
});

/** Input of `send_prompt`. No model, targets, composer, or attachments in v1. */
export const mcpSendPromptInputSchema = mcpProjectInputSchema.extend({
	// A new uuid for each prompt. A retry with the same key returns the same turn.
	requestKey: uuidSchema,
	message: z.string().trim().min(1).max(projectPromptMaxLength),
	// The `approvalId` of an open approval card to deny. An agent can never approve a card.
	denyApprovalId: z.string().min(1).max(200).optional(),
});

/** Input of `publish_app`. */
export const mcpPublishAppInputSchema = mcpProjectInputSchema.extend({
	// A new uuid for each publish. A retry with the same key returns the same build.
	requestKey: uuidSchema,
});

// The UTF-8 size of a JSON string. A file cap counts bytes, not UTF-16 units.
function utf8ByteLength(text: string): number {
	return new TextEncoder().encode(text).byteLength;
}

/**
 * One file write of `apply_changes`. The content is the whole new file as UTF-8 text.
 * A lone surrogate has no UTF-8 form, and a NUL byte marks a binary file, so both fail.
 */
const mcpFileWriteSchema = z.strictObject({
	path: mcpPathSchema,
	content: z
		.string()
		// A `u` regex reads a valid surrogate pair as one code point, so `\p{Cs}` finds only a lone surrogate.
		// Not `String.isWellFormed()`: the edge and preview-proxy apps compile @wandit/contracts with lib es2022.
		.refine((content) => !/\p{Cs}/u.test(content), "content must be UTF-8 text")
		.refine(
			(content) => !content.includes("\0"),
			"content must not hold a NUL byte",
		)
		.refine(
			(content) => utf8ByteLength(content) <= CODE_FILE_MAX_BYTES,
			`content must be at most ${CODE_FILE_MAX_BYTES} bytes`,
		),
});

/** One file delete of `apply_changes`. The path must name a file of the saved version. */
const mcpFileDeleteSchema = z.strictObject({
	path: mcpPathSchema,
	delete: z.literal(true),
});

/**
 * Input of `apply_changes`: one commit of whole-file writes and deletes.
 * The server checks each path with `isWritableCodePath` and answers PATH_NOT_ALLOWED.
 */
export const mcpApplyChangesInputSchema = mcpProjectInputSchema.extend({
	// The HEAD sha that the agent read, from `get_project` or the last `apply_changes`.
	expectedHeadSha: commitShaSchema,
	// The version title in the versions panel.
	message: z.string().trim().min(1).max(200),
	changes: z
		.array(z.union([mcpFileWriteSchema, mcpFileDeleteSchema]))
		.min(1)
		.max(MCP_CHANGES_MAX_FILES)
		.refine(
			(changes) =>
				new Set(changes.map((change) => change.path)).size === changes.length,
			"each path must appear once",
		)
		.refine(
			(changes) =>
				changes.reduce(
					(total, change) =>
						total + ("content" in change ? utf8ByteLength(change.content) : 0),
					0,
				) <= MCP_CHANGES_MAX_BYTES,
			`the changes must hold at most ${MCP_CHANGES_MAX_BYTES} bytes`,
		),
});

/** The parsed `apply_changes` input that `McpChangesService.apply` takes. */
export type McpApplyChangesInput = z.infer<typeof mcpApplyChangesInputSchema>;
