/**
 * Fastify-level rules for the OAuth provider of the MCP server (D29).
 * main.ts calls them: the urlencoded body parser and the CORS delegator.
 * The OAuth routes themselves are Better Auth routes behind AuthController and OAuthMetadataController.
 */

// RFC 6749 section 3.2, RFC 7009, RFC 7662: clients POST these three as form bodies. No browser page of ours does.
const OAUTH_FORM_BODY_PATHS = new Set([
	"/api/auth/oauth2/token",
	"/api/auth/oauth2/revoke",
	"/api/auth/oauth2/introspect",
]);

/** 16 KiB. A token, revoke, or introspect form holds a few short fields. */
export const OAUTH_FORM_BODY_LIMIT_BYTES = 16 * 1024;

/**
 * True when a request URL may carry an `application/x-www-form-urlencoded` body.
 * Exact path match only: any other path keeps the 415 that blocks a cross-site form post.
 * @param url The Fastify `request.url`: path plus optional query string.
 */
export function isOAuthFormBodyPath(url: string): boolean {
	const queryStart = url.indexOf("?");
	return OAUTH_FORM_BODY_PATHS.has(
		queryStart === -1 ? url : url.slice(0, queryStart),
	);
}

// The RFC 9728 and RFC 8414 metadata documents, outside the `/api` prefix.
const OAUTH_METADATA_URL =
	/^\/\.well-known\/oauth-(?:protected-resource(?:\/api\/mcp)?|authorization-server\/api\/auth)(?:\?.*)?$/;

// Public documents: any origin may read them, and no cookie goes with the request.
// MCP clients send MCP-Protocol-Version during discovery, so the preflight must allow it.
const OAUTH_METADATA_CORS_OPTIONS = {
	allowedHeaders: ["MCP-Protocol-Version"],
	credentials: false,
	maxAge: 86_400,
	methods: ["GET"],
	origin: "*",
};

/**
 * Returns the credentialless CORS policy for the OAuth metadata documents, or null for any other URL.
 * Fastify's CORS delegator also sees the OPTIONS preflight at the requested URL.
 */
export function oauthMetadataCorsOptions(url: string) {
	return OAUTH_METADATA_URL.test(url) ? OAUTH_METADATA_CORS_OPTIONS : null;
}
