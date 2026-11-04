import { UnauthorizedException } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import {
	MCP_ISSUER_URL,
	MCP_PROTECTED_RESOURCE_METADATA_URL,
	MCP_RESOURCE_URL,
} from "@wandit/auth/mcp-oauth-provider";
import type { McpScope } from "@wandit/contracts";
import {
	errors,
	exportJWK,
	generateKeyPair,
	type JWTPayload,
	SignJWT,
} from "jose";
import { describe, expect, it } from "vitest";

import type { McpUserRow } from "../../../infrastructure/persistence/mcp-access.repository";
import { McpTokenGuard } from "./mcp-token.guard";

const CLIENT_ID = "https://claude.ai/oauth/claude-code-client-metadata";
const KEY_ID = "key-1";
const ALL_SCOPES = [
	"projects:read",
	"projects:write",
	"builder:run",
	"projects:deploy",
];

const signingKeys = await generateKeyPair("ES256");
const otherKeys = await generateKeyPair("ES256");
const JWKS = {
	keys: [
		{ ...(await exportJWK(signingKeys.publicKey)), alg: "ES256", kid: KEY_ID },
	],
};

/** How one token differs from a valid access token of `user-1` for `CLIENT_ID`. */
type TokenChange = {
	audience?: string;
	issuer?: string;
	/** Expiry in seconds since the epoch. Default: 15 min from now. */
	expiresAt?: number;
	/** Issue time (`iat`) in seconds since the epoch. Default: now. */
	issuedAt?: number;
	/** True signs with a key that the JWKS does not hold. */
	otherKey?: boolean;
	/** Extra claims, for example `cnf`. */
	claims?: JWTPayload;
	scope?: string;
	/** The `typ` header. Default "at+jwt", as the OAuth provider signs access tokens. Null: no `typ`, as an ID token. */
	typ?: string | null;
	/** True leaves out the `kid` header. The jwt() plugin always sets it. */
	withoutKid?: boolean;
};

function signToken(change: TokenChange = {}): Promise<string> {
	const typ = change.typ === undefined ? "at+jwt" : change.typ;
	return new SignJWT({
		azp: CLIENT_ID,
		scope: change.scope ?? "projects:read projects:write offline_access",
		...change.claims,
	})
		.setProtectedHeader({
			alg: "ES256",
			...(change.withoutKid ? {} : { kid: KEY_ID }),
			...(typ === null ? {} : { typ }),
		})
		.setSubject("user-1")
		.setIssuer(change.issuer ?? MCP_ISSUER_URL)
		.setAudience(change.audience ?? MCP_RESOURCE_URL)
		.setIssuedAt(change.issuedAt)
		.setExpirationTime(change.expiresAt ?? Math.floor(Date.now() / 1000) + 900)
		.sign(change.otherKey ? otherKeys.privateKey : signingKeys.privateKey);
}

/** The account state of one case. */
type AccountState = {
	/** Null: the user has no consent row for the client, or revoked it. */
	consentScopes?: string[] | null;
	/** When the user granted the client. Default: the epoch, before every test token. */
	consentCreatedAt?: Date;
	banned?: boolean;
	/** End of the ban. Null: the ban never ends. */
	banExpires?: Date | null;
};

function userRow(state: AccountState): McpUserRow {
	return {
		banExpires: state.banExpires ?? null,
		banReason: null,
		banned: state.banned ?? false,
		createdAt: new Date(0),
		displayEmail: null,
		earlyAccess: false,
		email: "dev@wandit.test",
		emailVerified: true,
		id: "user-1",
		image: null,
		lastSeenAt: null,
		name: "Dev",
		onboardingCompletedAt: new Date(0),
		role: "user",
		updatedAt: new Date(0),
	};
}

function guardFor(state: AccountState = {}): McpTokenGuard {
	return new McpTokenGuard(
		{ api: { getJwks: async () => JWKS } },
		{
			findConsent: async (userId, clientId) => {
				const scopes =
					state.consentScopes === undefined ? ALL_SCOPES : state.consentScopes;
				return userId === "user-1" && clientId === CLIENT_ID && scopes !== null
					? { createdAt: state.consentCreatedAt ?? new Date(0), scopes }
					: null;
			},
			findUser: async (userId) => (userId === "user-1" ? userRow(state) : null),
		},
	);
}

describe("McpTokenGuard.verify", () => {
	const GRANT_SECOND = Math.floor(Date.now() / 1000);
	const CASES: [
		string,
		() => Promise<string>,
		AccountState,
		McpScope[] | null,
	][] = [
		[
			"a valid token keeps the consented scopes and drops offline_access",
			() => signToken(),
			{},
			["projects:read", "projects:write"],
		],
		[
			"a consent that lost a scope after signing limits the token",
			() => signToken(),
			{ consentScopes: ["projects:read"] },
			["projects:read"],
		],
		[
			"a ban that ended no longer blocks",
			() => signToken(),
			{ banExpires: new Date(Date.now() - 60_000), banned: true },
			["projects:read", "projects:write"],
		],
		[
			"a token of another audience",
			() => signToken({ audience: "https://api.wandit.dev/api/auth" }),
			{},
			null,
		],
		[
			"a token of another issuer",
			() => signToken({ issuer: "https://evil.test/api/auth" }),
			{},
			null,
		],
		[
			"an expired token",
			() => signToken({ expiresAt: Math.floor(Date.now() / 1000) - 60 }),
			{},
			null,
		],
		[
			"a token signed by another key",
			() => signToken({ otherKey: true }),
			{},
			null,
		],
		[
			"a JWT of the same key set without the access token typ, such as an ID token",
			() => signToken({ typ: null }),
			{},
			null,
		],
		// With two keys of one alg in the JWKS, such a token makes jose throw JWKSMultipleMatchingKeys.
		[
			"a token without kid, even with a valid signature",
			() => signToken({ withoutKid: true }),
			{},
			null,
		],
		["an opaque token", async () => "opaque-refresh-token-value", {}, null],
		// jose throws a TypeError, not a JOSEError, on this header.
		[
			"a three-part token whose header is not JSON",
			async () => "a.b.c",
			{},
			null,
		],
		[
			"a DPoP-bound token",
			() => signToken({ claims: { cnf: { jkt: "thumbprint" } } }),
			{},
			null,
		],
		["a revoked consent", () => signToken(), { consentScopes: null }, null],
		// A revoke, then a new grant within the 15 min of the old token: the old token stays revoked.
		[
			"a token signed before the current grant",
			() => signToken({ issuedAt: Math.floor(Date.now() / 1000) - 600 }),
			{ consentCreatedAt: new Date(Date.now() - 60_000) },
			null,
		],
		// `iat` is in seconds and createdAt in milliseconds. A token from the grant second stays valid.
		[
			"a token from the same second as the grant",
			() => signToken({ issuedAt: GRANT_SECOND }),
			{ consentCreatedAt: new Date(GRANT_SECOND * 1000 + 999) },
			["projects:read", "projects:write"],
		],
		[
			"a banned user",
			() => signToken(),
			{ banExpires: null, banned: true },
			null,
		],
	];

	it.each(CASES)("%s", async (_label, token, state, scopes) => {
		const caller = await guardFor(state).verify(await token());

		expect(caller?.grant.scopes ?? null).toEqual(scopes);
		if (caller !== null) {
			expect(caller.grant.clientId).toBe(CLIENT_ID);
			expect(caller.user.id).toBe("user-1");
		}
	});

	// A JWKS outage must answer 5xx. A 401 makes every client refresh or log in again for no reason.
	it("throws on a JWKS read timeout instead of refusing the token", async () => {
		const guard = new McpTokenGuard(
			{
				api: {
					getJwks: async () => {
						throw new errors.JWKSTimeout();
					},
				},
			},
			{ findConsent: async () => null, findUser: async () => null },
		);

		await expect(guard.verify(await signToken())).rejects.toBeInstanceOf(
			errors.JWKSTimeout,
		);
	});
});

describe("McpTokenGuard.canActivate", () => {
	it.each([
		// RFC 6750: no error code when the request sent no token.
		["no Authorization header", undefined, ""],
		["a bad token", "Bearer opaque-value", ', error="invalid_token"'],
	])("answers 401 with the login hint for %s", async (_label, authorization, errorPart) => {
		const replyHeaders = new Map<string, string>();
		const request = { headers: { authorization } };
		const reply = {
			header: (name: string, value: string) => {
				replyHeaders.set(name, value);
				return reply;
			},
		};

		await expect(
			guardFor().canActivate(new ExecutionContextHost([request, reply])),
		).rejects.toBeInstanceOf(UnauthorizedException);

		expect(replyHeaders.get("WWW-Authenticate")).toBe(
			`Bearer resource_metadata="${MCP_PROTECTED_RESOURCE_METADATA_URL}"${errorPart}`,
		);
	});
});
