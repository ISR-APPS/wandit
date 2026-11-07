/**
 * First guard of `POST /api/mcp` (docs/features/coding-agents-mcp.md, "MCP request rules").
 * It verifies the OAuth access token of an external coding agent and loads its user.
 * It checks the consent of (user, client) on every call. It reads the local JWKS of the Better Auth jwt() plugin.
 * `McpController` reads `request.user` and `request.mcpGrant` after it.
 */
import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import {
	MCP_ISSUER_URL,
	MCP_PROTECTED_RESOURCE_METADATA_URL,
	MCP_RESOURCE_URL,
} from "@wandit/auth/mcp-oauth-provider";
import {
	type McpAccessTokenClaims,
	type McpScope,
	mcpAccessTokenClaimsSchema,
	mcpScopeSchema,
} from "@wandit/contracts";
import { Sentry } from "@wandit/observability/nestjs";
import { verifyJwsAccessToken } from "better-auth/oauth2";
import type { FastifyReply } from "fastify";
import { decodeProtectedHeader, errors, type JSONWebKeySet } from "jose";

import {
	AUTH_INSTANCE,
	isBanActive,
	type MaybeAuthenticatedRequest,
} from "../../../../auth";
import {
	McpAccessRepository,
	type McpUserRow,
} from "../../../infrastructure/persistence/mcp-access.repository";

/** The grant of one MCP call. It holds ids and scopes only, never the token. */
export type McpGrant = {
	/** OAuth client id from the token `azp`: the CIMD document URL, or the id that registration gave. */
	clientId: string;
	/** The scopes that both the token and the current consent hold. */
	scopes: McpScope[];
	/** Token expiry, in seconds since the epoch. */
	expiresAt: number;
};

/** The verified caller of one MCP call. */
export type McpCaller = {
	user: McpUserRow;
	grant: McpGrant;
};

/** `POST /api/mcp` after this guard: `user` as `AuthGuard` sets it, plus the grant. */
export type McpRequest = MaybeAuthenticatedRequest & { mcpGrant?: McpGrant };

/** The one Better Auth endpoint the guard calls: the JWKS of the jwt() plugin, read from Postgres. */
export type JwksSource = {
	api: { getJwks: () => Promise<JSONWebKeySet> };
};

// A JWKS read that times out or gives a bad key set is an outage, not a token error.
// `isJoseInfrastructureError` in @better-auth/core 1.7.16 (oauth2/verify.mjs) uses the same three codes.
const JWKS_FAILURE_CODES = new Set([
	errors.JWKSTimeout.code,
	errors.JWKSInvalid.code,
	errors.JWKSMultipleMatchingKeys.code,
]);

/** The token of an `Authorization: Bearer <token>` header, or null for no header or another scheme. */
function bearerTokenOf(header: string | undefined): string | null {
	const match = header?.match(/^Bearer +(\S+) *$/i);
	return match?.[1] ?? null;
}

/** Proves the bearer token of `/api/mcp` on each call. Only the JWKS is cached; the user and consent rows are not. */
@Injectable()
export class McpTokenGuard implements CanActivate {
	// One stable object per process: `verifyJwsAccessToken` caches the JWKS under it with its own TTL.
	private readonly jwksCacheKey = {};

	constructor(
		@Inject(AUTH_INSTANCE)
		private readonly auth: JwksSource,
		@Inject(McpAccessRepository)
		private readonly access: Pick<
			McpAccessRepository,
			"findUser" | "findConsent"
		>,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const http = context.switchToHttp();
		const request = http.getRequest<McpRequest>();
		const reply = http.getResponse<FastifyReply>();
		// Security: only the header. A token in the query or the body would land in logs.
		const token = bearerTokenOf(request.headers.authorization);
		const caller = token === null ? null : await this.verify(token);
		if (caller === null) {
			// RFC 6750 section 3: no error code when the request sent no token. RFC 9728 section 5.1:
			// resource_metadata tells the client where to log in. Set before the throw, so it survives.
			reply.header(
				"WWW-Authenticate",
				`Bearer resource_metadata="${MCP_PROTECTED_RESOURCE_METADATA_URL}"${
					token === null ? "" : ', error="invalid_token"'
				}`,
			);
			throw new UnauthorizedException({
				code: "MCP_UNAUTHORIZED",
				message: "A valid Wandit access token is required",
			});
		}
		// Attribute every Sentry capture of this call to the user, as AuthGuard does.
		Sentry.setUser({ email: caller.user.email, id: caller.user.id });
		request.user = caller.user;
		request.mcpGrant = caller.grant;
		return true;
	}

	/**
	 * The caller of a bearer token. Null when the token is not valid for this resource now:
	 * - a bad signature, or no `kid`
	 * - another typ, issuer, or audience
	 * - an expired, opaque, or sender-bound token
	 * - a missing or banned user
	 * - a revoked consent, or a token from before the current grant
	 *
	 * A JWKS read failure throws, because it is not a token error.
	 */
	async verify(token: string): Promise<McpCaller | null> {
		const claims = await this.verifiedClaimsOf(token);
		if (claims === null) {
			return null;
		}
		const user = await this.access.findUser(claims.sub);
		if (user === null || isBanActive(user)) {
			return null;
		}
		// Security check on every call: a revoke deletes the consent row, and the token must stop at once.
		const consent = await this.access.findConsent(user.id, claims.azp);
		if (consent === null) {
			return null;
		}
		// Security check: a grant after a revoke makes a new row. A token from before that grant stays revoked.
		// `iat` is in seconds. The floor keeps a token from the same second as the grant valid.
		// LIMIT: a clock skew of more than about 1 s between API replicas can refuse a new token.
		// Upgrade: keep the revoke time of (user, client), and refuse a token issued before it.
		if (claims.iat < Math.floor(consent.createdAt.getTime() / 1000)) {
			return null;
		}
		// A consent can lose a scope after the token was signed. The call gets only what both hold.
		const scopes = claims.scope.split(" ").flatMap((scope) => {
			const parsed = mcpScopeSchema.safeParse(scope);
			return parsed.success && consent.scopes.includes(parsed.data)
				? [parsed.data]
				: [];
		});
		return {
			grant: { clientId: claims.azp, expiresAt: claims.exp, scopes },
			user,
		};
	}

	// Verifies signature, issuer, audience, and expiry with jose, then parses the claims the API reads.
	private async verifiedClaimsOf(
		token: string,
	): Promise<McpAccessTokenClaims | null> {
		// A three-part token with a header that is not JSON makes jose throw a TypeError, not a
		// JOSEError. This check turns that malformed token into a 401, not a 500.
		let header: ReturnType<typeof decodeProtectedHeader>;
		try {
			header = decodeProtectedHeader(token);
		} catch {
			return null;
		}
		// Security: jwt() always sets `kid`. Without it, jose can match several keys and throw
		// JWKSMultipleMatchingKeys, which the catch below rethrows as an outage. The header is caller JSON.
		if (typeof header.kid !== "string") {
			return null;
		}
		let payload: Awaited<ReturnType<typeof verifyJwsAccessToken>>;
		try {
			payload = await verifyJwsAccessToken(token, {
				jwksCacheKey: this.jwksCacheKey,
				jwksFetch: () => this.auth.api.getJwks(),
				verifyOptions: {
					audience: MCP_RESOURCE_URL,
					issuer: MCP_ISSUER_URL,
					// Security: the provider signs access tokens with typ "at+jwt" (RFC 9068). Another JWT of
					// the same key set, for example an ID token, has no such typ and fails here.
					typ: "at+jwt",
				},
			});
		} catch (error) {
			// Other jose errors are token errors: an opaque token, a bad signature, a wrong claim or typ, or expiry.
			if (
				error instanceof errors.JOSEError &&
				!JWKS_FAILURE_CODES.has(error.code)
			) {
				return null;
			}
			throw error;
		}
		// Security: a DPoP-bound token (RFC 9449 `cnf`) needs a proof that this bearer guard never reads.
		if (payload.cnf !== undefined) {
			return null;
		}
		const claims = mcpAccessTokenClaimsSchema.safeParse(payload);
		return claims.success ? claims.data : null;
	}
}
