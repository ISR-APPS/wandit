/**
 * OAuth provider of the remote MCP server (D29, docs/features/coding-agents-mcp.md).
 * `createAuth` in index.ts adds these plugins only when V2_BUILDER_ENABLED is true.
 * It configures the Better Auth 1.7 plugins `jwt()` and `mcp()` and the CIMD client discovery.
 * It adds the Wandit rules as hooks. The plugin tables are in `@wandit/db/schema/oauth-provider`.
 */
import { createHash } from "node:crypto";

import { createCimdClientDiscovery } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import {
	type ClientDiscovery,
	type ClientMetadataResourceFetch,
	getOAuthProviderState,
	type OAuthConsent,
	type OAuthRefreshToken,
} from "@better-auth/oauth-provider";
import type { AuditAction } from "@wandit/contracts";
import {
	mcpAccessTokenClaimsSchema,
	mcpClientRegistrationSchema,
	mcpConsentScopes,
	type OAuthTokenRequestBody,
	oauthAuthorizationCodeValueSchema,
	oauthAuthorizePromptSchema,
	oauthConsentResultSchema,
	oauthDeleteConsentBodySchema,
	oauthTokenRequestBodySchema,
	oauthTokenResultSchema,
} from "@wandit/contracts/v2/mcp";
import { env } from "@wandit/env/server";
import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import {
	APIError,
	createAuthMiddleware,
	getSessionFromCtx,
} from "better-auth/api";
import { jwt } from "better-auth/plugins";

const API_ORIGIN = new URL(env.BETTER_AUTH_URL).origin;

/** The OAuth resource and the token audience. Never change it after launch: every client must log in again. */
export const MCP_RESOURCE_URL = `${API_ORIGIN}/api/mcp`;

/** Token issuer: the Better Auth base URL. The plugin signs `iss` with it and lists it in the metadata. */
export const MCP_ISSUER_URL = `${API_ORIGIN}/api/auth`;

/** RFC 9728 metadata URL. A 401 of `POST /api/mcp` names it in `WWW-Authenticate: Bearer resource_metadata=`. */
export const MCP_PROTECTED_RESOURCE_METADATA_URL = `${API_ORIGIN}/.well-known/oauth-protected-resource/api/mcp`;

/** 15 minutes, in seconds. A ban takes effect at the latest when the token expires. */
const ACCESS_TOKEN_TTL_SEC = 15 * 60;
/** 30 days, in seconds. The plugin rotates the refresh token on each use. */
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;

/**
 * Hosts of the CIMD client_id URLs that the API accepts: Claude Code, Codex, and VS Code.
 * To add an agent: read its CIMD document, then add the exact host of its client_id URL.
 * The API refuses every other host before a fetch, and it logs the refused host.
 */
export const MCP_CIMD_CLIENT_HOSTS: ReadonlySet<string> = new Set([
	// Claude Code
	"claude.ai",
	// Codex
	"chatgpt.com",
	// VS Code
	"vscode.dev",
]);

// An exact host match: a suffix match admits claude.ai.evil.com. A port or userinfo also fails.
function isAllowedCimdClientId(clientId: string): boolean {
	if (!URL.canParse(clientId)) {
		return false;
	}
	const url = new URL(clientId);
	return (
		url.protocol === "https:" &&
		url.port === "" &&
		url.username === "" &&
		url.password === "" &&
		MCP_CIMD_CLIENT_HOSTS.has(url.hostname)
	);
}

// The zones of user apps: published sites, the custom-domain fallback, and previews.
// Any user can publish there, so a redirect there gives the code to a stranger under the Wandit name.
const USER_CONTENT_DOMAINS = [
	env.SITES_DOMAIN,
	env.DOMAINS_FALLBACK_ORIGIN,
	env.PREVIEW_DOMAIN,
]
	.filter((domain) => domain !== undefined)
	.map((domain) => domain.toLowerCase());

// True for a URL on a user-app zone or a subdomain of it. The registration schema parsed the URL.
function isUserContentUrl(value: string): boolean {
	// "app.wandit.app." names the same DNS host as "app.wandit.app".
	const hostname = new URL(value).hostname.replace(/\.+$/, "");
	return USER_CONTENT_DOMAINS.some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`),
	);
}

// The user and client of an access JWT. The plugin signed it in this request, so no signature check runs.
const accessTokenGrantSchema = mcpAccessTokenClaimsSchema.pick({
	azp: true,
	sub: true,
});

/** Reads `sub` and `azp` from the payload of an access JWT. Null for an opaque token. */
function readAccessTokenGrant(accessToken: string) {
	const payload = accessToken.split(".")[1];
	if (payload === undefined) {
		return null;
	}
	try {
		const grant = accessTokenGrantSchema.safeParse(
			JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
		);
		return grant.success ? grant.data : null;
	} catch {
		// The middle part is not JSON, so the token is not a JWT.
		return null;
	}
}

// The plugin finds a code or a refresh token by base64url(SHA-256(value)) when `storeTokens` is "hashed".
// The spec cases "after a revoke and a new grant" and "outlived a revoke" fail if the plugin changes this.
function hashedTokenIdentifier(token: string): string {
	return createHash("sha256").update(token).digest("base64url");
}

/** Reads the user and client of a stored authorization code. Null when the value is not the plugin JSON. */
function readAuthorizationCodeGrant(value: string) {
	try {
		const grant = oauthAuthorizationCodeValueSchema.safeParse(
			JSON.parse(value),
		);
		return grant.success ? grant.data : null;
	} catch {
		// The value is not JSON. The plugin refuses this code itself.
		return null;
	}
}

/** The grant of a code or a refresh token, and the time when the plugin wrote it. */
type TokenCredential = {
	/** Id of the `user` row that granted the access. */
	userId: string;
	/** OAuth client id of the grant. */
	clientId: string;
	/** When the plugin wrote the code row or the refresh token row, in whole seconds. */
	issuedAt: Date;
};

/**
 * Finds the stored row of the credential in a token request: the code or the refresh token.
 * Null when the plugin does not know it. The plugin then refuses the request itself.
 */
async function findTokenCredential(
	context: Pick<
		GenericEndpointContext["context"],
		"adapter" | "internalAdapter"
	>,
	request: OAuthTokenRequestBody,
): Promise<TokenCredential | null> {
	if (request.grant_type === "authorization_code") {
		const codeRow = await context.internalAdapter.findVerificationValue(
			hashedTokenIdentifier(request.code),
		);
		const grant = codeRow ? readAuthorizationCodeGrant(codeRow.value) : null;
		return codeRow && grant
			? {
					userId: grant.userId,
					clientId: grant.query.client_id,
					issuedAt: codeRow.createdAt,
				}
			: null;
	}
	const tokenRow = await context.adapter.findOne<OAuthRefreshToken>({
		model: "oauthRefreshToken",
		where: [
			{ field: "token", value: hashedTokenIdentifier(request.refresh_token) },
		],
	});
	// The plugin refuses a row without a client id, because it compares the client ids.
	return tokenRow?.clientId
		? {
				userId: tokenRow.userId,
				clientId: tokenRow.clientId,
				issuedAt: tokenRow.createdAt,
			}
		: null;
}

/**
 * Plugin routes that no Wandit client uses. Better Auth answers 404 for them before routing.
 * Kept: authorize, token, register, consent, continue, revoke, introspect, public-client, get-consents, delete-consent, jwks.
 * The admin client and resource routes are SERVER_ONLY, so HTTP never reaches them.
 * Enumerated from @better-auth/oauth-provider 1.7.16 and better-auth/plugins/jwt. Check again on upgrades.
 */
export const MCP_OAUTH_DISABLED_PATHS = [
	// The jwt() plugin mints a JWT for a cookie session here. Only the OAuth token endpoint mints tokens.
	"/token",
	"/oauth2/create-client",
	"/oauth2/get-client",
	"/oauth2/get-clients",
	"/oauth2/update-client",
	"/oauth2/delete-client",
	"/oauth2/client/rotate-secret",
	"/oauth2/client/rotate-keys",
	"/oauth2/get-consent",
	"/oauth2/update-consent",
	"/oauth2/end-session",
	"/oauth2/end-session/confirm",
	"/oauth2/userinfo",
	"/oauth2/public-client-prelogin",
];

/** One consent change of a coding agent, for the audit log. It holds ids only, never a token. */
export type McpConsentChange = {
	action: Extract<AuditAction, "mcp.consent_granted" | "mcp.consent_revoked">;
	/** Id of the `user` row that granted or revoked the access. */
	userId: string;
	/** OAuth client id: the CIMD document URL, or the id that registration gave. */
	clientId: string;
};

/** Receives each consent change. The API writes it as an `audit_events` row. A throw is logged and never aborts the change. */
export type OnMcpConsentChange = (
	change: McpConsentChange,
) => Promise<void> | void;

// The consent endpoint dispatches authorize again after the user accepts. That dispatch carries this request.
const CONSENT_REQUEST_PATH = "/api/auth/oauth2/consent";
// A client request to authorize, also with extra slashes. A resume after sign-in carries another path.
const AUTHORIZE_REQUEST_PATH = /\/oauth2\/authorize\/*$/;

/**
 * Returns the `prompt` value that makes `/oauth2/authorize` show the consent page, or null to keep the value.
 * The plugin skips the page when a stored consent covers the scopes. Wandit always shows it (D29).
 * The one exception is the dispatch from the consent endpoint: it removed "consent" on purpose.
 * @param requestPath Path of the HTTP request that started this dispatch. Undefined for a server-side call.
 */
export function authorizePromptWithConsent(
	prompt: string | undefined,
	requestPath: string | undefined,
): string | null {
	if (requestPath === CONSENT_REQUEST_PATH) {
		return null;
	}
	const prompts = new Set((prompt ?? "").split(" ").filter(Boolean));
	if (prompts.has("consent")) {
		return null;
	}
	prompts.add("consent");
	return [...prompts].join(" ");
}

/**
 * Wandit rules on top of the plugin, as hooks:
 * - consent always, and public-client registration only;
 * - no DPoP, no token without a consent row, and no code or refresh token from before the current consent row;
 * - token revocation on a consent delete, and the consent audit.
 */
function createMcpOAuthRules(onConsentChange: OnMcpConsentChange | undefined) {
	const reportConsentChange = async (
		logger: { error: (message: string, error: unknown) => void },
		change: McpConsentChange,
	) => {
		try {
			await onConsentChange?.(change);
		} catch (error) {
			// The audit row is a trace. It must never undo or block a grant or a revoke.
			logger.error(`MCP consent audit failed for ${change.action}`, error);
		}
	};

	// The plugin stores tokens per (client, user). These two tables hold every token of one grant.
	const deleteGrantTokens = async (
		adapter: GenericEndpointContext["context"]["adapter"],
		grant: { clientId: string; userId: string },
	) => {
		const grantRows = [
			{ field: "clientId", value: grant.clientId },
			{ field: "userId", value: grant.userId },
		];
		await adapter.deleteMany({ model: "oauthAccessToken", where: grantRows });
		await adapter.deleteMany({ model: "oauthRefreshToken", where: grantRows });
	};

	return {
		id: "wandit-mcp-oauth-rules",
		hooks: {
			before: [
				{
					matcher: (ctx) => ctx.path === "/oauth2/token",
					handler: createAuthMiddleware(async (ctx) => {
						// McpTokenGuard reads only Bearer tokens. A DPoP-bound token would fail on every MCP call.
						if (ctx.headers?.has("dpop")) {
							throw new APIError("BAD_REQUEST", {
								error: "invalid_request",
								error_description: "DPoP is not supported",
							});
						}
						const request = oauthTokenRequestBodySchema.safeParse(ctx.body);
						if (!request.success) {
							// Another grant type, or a body that the plugin refuses itself.
							return;
						}
						const credential = await findTokenCredential(
							ctx.context,
							request.data,
						);
						// The plugin refuses an unknown credential. For a used code, it also revokes the tokens of that code.
						if (!credential) {
							return;
						}
						const consent = await ctx.context.adapter.findOne<OAuthConsent>({
							model: "oauthConsent",
							where: [
								{ field: "clientId", value: credential.clientId },
								{ field: "userId", value: credential.userId },
							],
						});
						// Security check: a revoke deletes the consent, and a new grant makes a newer row.
						// So a code or a refresh token from before the revoke stays dead. Without a consent, the hook refuses too.
						// That closes two gaps: an old code exchanged after a new grant, and a refresh row written after the revoke.
						// The plugin writes all these times in whole seconds. On one clock, a fresh credential is never older than its consent.
						// LIMIT: one-second precision. A credential, a revoke, and a new grant in the same second still pass.
						// A revoke and a new grant while the plugin handles this request also pass.
						// Both need a new grant of this client, and McpTokenGuard keeps only the scopes of that grant.
						// A clock skew of more than about 1 s between API replicas can refuse a fresh credential.
						// Upgrade: check again in the after hook, with the credential time in a Better Auth request state.
						if (
							!consent ||
							credential.issuedAt.getTime() < consent.createdAt.getTime()
						) {
							throw new APIError("BAD_REQUEST", {
								error: "invalid_grant",
								error_description: "the user revoked this grant",
							});
						}
					}),
				},
				{
					matcher: (ctx) => ctx.path === "/oauth2/authorize",
					handler: createAuthMiddleware(async (ctx) => {
						const requestPath = ctx.request
							? new URL(ctx.request.url).pathname
							: undefined;
						// An authorize POST reads its fields from the body, which this hook does not rewrite.
						// main.ts already answers 415 for its form body. This refusal keeps consent forced.
						if (
							ctx.method === "POST" &&
							requestPath !== undefined &&
							AUTHORIZE_REQUEST_PATH.test(requestPath)
						) {
							throw new APIError("BAD_REQUEST", {
								error: "invalid_request",
								error_description: "use GET for the authorization request",
							});
						}
						const query = oauthAuthorizePromptSchema.safeParse(ctx.query);
						if (!query.success) {
							throw new APIError("BAD_REQUEST", {
								error: "invalid_request",
								error_description: "prompt must be one string",
							});
						}
						const prompt = authorizePromptWithConsent(
							query.data.prompt,
							requestPath,
						);
						if (prompt === null) {
							return;
						}
						return { context: { query: { ...ctx.query, prompt } } };
					}),
				},
				{
					matcher: (ctx) => ctx.path === "/oauth2/register",
					handler: createAuthMiddleware(async (ctx) => {
						// Anonymous registration would otherwise default to a confidential client
						// (`client_secret_basic`) and accept any redirect scheme.
						const registration = mcpClientRegistrationSchema.safeParse(
							ctx.body,
						);
						if (!registration.success) {
							throw new APIError("BAD_REQUEST", {
								error: "invalid_client_metadata",
								error_description:
									"only public clients (token_endpoint_auth_method none) with https, loopback, or cursor: redirect_uris can register",
							});
						}
						// The consent page shows the redirect host. A Wandit app host there looks like Wandit itself.
						if (registration.data.redirect_uris.some(isUserContentUrl)) {
							throw new APIError("BAD_REQUEST", {
								error: "invalid_redirect_uri",
								error_description:
									"redirect_uris must not point to a domain of Wandit user apps",
							});
						}
					}),
				},
				{
					matcher: (ctx) => ctx.path === "/oauth2/delete-consent",
					handler: createAuthMiddleware(async (ctx) => {
						// The plugin deletes only the consent row. Its refresh grant does not check
						// the consent, so the tokens of (user, client) go first. A failed delete
						// after this point leaves a consent without tokens: the client must log in again.
						const body = oauthDeleteConsentBodySchema.safeParse(ctx.body);
						const session = await getSessionFromCtx(ctx);
						if (!body.success || !session) {
							// The endpoint answers 400 or 401 itself.
							return;
						}
						const consent = await ctx.context.adapter.findOne<OAuthConsent>({
							model: "oauthConsent",
							where: [{ field: "id", value: body.data.id }],
						});
						// Same ownership rule as the endpoint, which then answers 404 or 401.
						if (!consent || consent.userId !== session.user.id) {
							return;
						}
						await deleteGrantTokens(ctx.context.adapter, {
							clientId: consent.clientId,
							userId: session.user.id,
						});
						await reportConsentChange(ctx.context.logger, {
							action: "mcp.consent_revoked",
							clientId: consent.clientId,
							userId: session.user.id,
						});
					}),
				},
			],
			after: [
				{
					matcher: (ctx) => ctx.path === "/oauth2/token",
					handler: createAuthMiddleware(async (ctx) => {
						const answer = oauthTokenResultSchema.safeParse(
							ctx.context.returned,
						);
						// An error answer holds no token.
						if (!answer.success) {
							return;
						}
						const grant = readAccessTokenGrant(answer.data.access_token);
						// Only a JWT names its grant. Without a resource the token is opaque, and McpTokenGuard refuses it.
						if (!grant) {
							throw new APIError("BAD_REQUEST", {
								error: "invalid_target",
								error_description: `the token request must name the resource ${MCP_RESOURCE_URL}`,
							});
						}
						const consent = await ctx.context.adapter.findOne<OAuthConsent>({
							model: "oauthConsent",
							where: [
								{ field: "clientId", value: grant.azp },
								{ field: "userId", value: grant.sub },
							],
						});
						if (consent) {
							return;
						}
						// A code or a refresh token can outlive a revoke. The plugin never reads the consent here.
						// The client never gets this answer, and the new token rows go too.
						await deleteGrantTokens(ctx.context.adapter, {
							clientId: grant.azp,
							userId: grant.sub,
						});
						throw new APIError("BAD_REQUEST", {
							error: "invalid_grant",
							error_description: "the user revoked this grant",
						});
					}),
				},
				{
					matcher: (ctx) => ctx.path === "/oauth2/consent",
					handler: createAuthMiddleware(async (ctx) => {
						const result = oauthConsentResultSchema.safeParse(
							ctx.context.returned,
						);
						if (!result.success || !URL.canParse(result.data.url)) {
							return;
						}
						// An error, a denial, or a detour to the login page saves no grant.
						// A denial keeps the query of the redirect URI, which can already hold a `code`.
						const redirectQuery = new URL(result.data.url).searchParams;
						if (!redirectQuery.has("code") || redirectQuery.has("error")) {
							return;
						}
						const oauthState = await getOAuthProviderState();
						const clientId = new URLSearchParams(oauthState?.query).get(
							"client_id",
						);
						const session = await getSessionFromCtx(ctx);
						if (!clientId || !session) {
							return;
						}
						await reportConsentChange(ctx.context.logger, {
							action: "mcp.consent_granted",
							clientId,
							userId: session.user.id,
						});
					}),
				},
			],
		},
	} satisfies BetterAuthPlugin;
}

/**
 * The Better Auth plugins of the MCP OAuth provider.
 * Tokens: JWT access token for `MCP_RESOURCE_URL` (15 min), refresh token 30 days, both hashed at rest.
 * Clients: CIMD (MCP 2026-07-28 profile) and anonymous DCR for public clients. Consent always.
 * @param fetchMetadataDocument Transport of the CIMD document fetch. A spec passes a fake, so no test uses the network.
 */
export function createMcpOAuthPlugins(
	onConsentChange: OnMcpConsentChange | undefined,
	fetchMetadataDocument: ClientMetadataResourceFetch = fetchClientMetadataResource,
) {
	// Claude Code, Codex, and VS Code use a metadata document URL as client_id.
	// The Node transport resolves DNS once, refuses private addresses, and follows no redirect.
	const cimdDiscovery = createCimdClientDiscovery({
		fetchClientMetadataResource: fetchMetadataDocument,
		metadataProfile: "mcp-2026-07-28",
		// Second layer. The plugin runs this check only after it takes a slot of its fetch budget.
		isMetadataDocumentUrlAllowed: isAllowedCimdClientId,
	});
	const allowListedCimdDiscovery: ClientDiscovery = {
		...cimdDiscovery,
		// getClient() calls resolve on every route, before the fetch budget.
		// So a stranger's host costs no fetch, and it cannot block the real agents.
		resolve: async (ctx, clientId, existing) => {
			if (!isAllowedCimdClientId(clientId)) {
				// matches() parsed clientId as an https URL first. Only the host goes to the log, never the query.
				ctx.context.logger.warn(
					`MCP refused a CIMD client_id on host ${new URL(clientId).host}`,
				);
				throw new APIError("BAD_REQUEST", {
					error: "invalid_client",
					error_description: "client_id host is not allowed",
				});
			}
			return cimdDiscovery.resolve(ctx, clientId, existing);
		},
	};

	return [
		// The access tokens are JWTs signed with these keys. No cookie session gets a JWT header.
		jwt({ disableSettingJwtHeader: true }),
		mcp({
			resource: MCP_RESOURCE_URL,
			// The web bridge runs the sign-in and onboarding gates first, then resumes the flow.
			loginPage: `${env.CORS_ORIGIN}/oauth/authorize`,
			consentPage: `${env.CORS_ORIGIN}/oauth/consent`,
			// No openid: the MCP server needs no ID token. offline_access gives the refresh token.
			scopes: [...mcpConsentScopes],
			grantTypes: ["authorization_code", "refresh_token"],
			accessTokenExpiresIn: ACCESS_TOKEN_TTL_SEC,
			refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SEC,
			// Pinned on purpose: a leaked table row must not be a usable token or secret.
			storeTokens: "hashed",
			storeClientSecret: "hashed",
			// Cursor and older clients register here. The register hook admits public clients only.
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true,
			// A client with a loopback redirect and no application_type counts as native.
			clientRegistrationDefaultApplicationType: "infer",
			// What the `cimd()` plugin registers, with the host check above.
			extensions: [{ clientDiscovery: allowListedCimdDiscovery }],
		}),
		createMcpOAuthRules(onConsentChange),
	];
}
