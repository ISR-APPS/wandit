import { createHash, randomUUID } from "node:crypto";

import {
	authorizePromptWithConsent,
	createMcpOAuthPlugins,
	MCP_ISSUER_URL,
	MCP_RESOURCE_URL,
	type McpConsentChange,
} from "@wandit/auth/mcp-oauth-provider";
import { oauthConsentResultSchema } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { betterAuth } from "better-auth";
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory";
import { getAuthTables } from "better-auth/db";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

describe("authorizePromptWithConsent", () => {
	it.each([
		// A client request, or the resume after sign-in, always gets the consent page.
		[undefined, "/api/auth/oauth2/authorize", "consent"],
		["login", "/api/auth/oauth2/authorize", "login consent"],
		["select_account consent", "/api/auth/oauth2/authorize", null],
		["", "/api/auth/sign-in/email", "consent"],
		["", "/api/auth/callback/google", "consent"],
		[undefined, undefined, "consent"],
		// prompt=none plus consent fails the plugin schema: no silent code.
		["none", "/api/auth/oauth2/authorize", "none consent"],
		// The consent endpoint removed "consent" on purpose. Adding it again loops the user.
		[undefined, "/api/auth/oauth2/consent", null],
		["login", "/api/auth/oauth2/consent", null],
		// Any other spelling of the consent path fails closed: the page shows again.
		[undefined, "/api/auth/oauth2/consent/", "consent"],
	])("prompt %s from %s -> %s", (prompt, requestPath, expected) => {
		expect(authorizePromptWithConsent(prompt, requestPath)).toBe(expected);
	});
});

// The Wandit hooks run inside a real Better Auth with a memory adapter: no Postgres, no network.
describe("MCP OAuth rules", () => {
	const apiOrigin = new URL(MCP_ISSUER_URL).origin;
	const redirectUri = "http://127.0.0.1:54321/callback";
	const consentChanges: McpConsentChange[] = [];
	// Each CIMD document URL that the plugin fetches. The fake answers 404.
	const fetchedUrls: string[] = [];
	const plugins = createMcpOAuthPlugins(
		(change) => {
			consentChanges.push(change);
		},
		async (input) => {
			fetchedUrls.push(new Request(input).url);
			return new Response(null, { status: 404 });
		},
	);
	const memory: MemoryDB = Object.fromEntries(
		Object.values(
			getAuthTables({ emailAndPassword: { enabled: true }, plugins }),
		).map((table) => [table.modelName, []]),
	);
	const auth = betterAuth({
		baseURL: apiOrigin,
		basePath: "/api/auth",
		database: memoryAdapter(memory),
		emailAndPassword: { enabled: true },
		plugins,
		rateLimit: { enabled: false },
	});
	let clientId = "";

	const call = (path: string, init: RequestInit = {}) =>
		auth.handler(new Request(`${apiOrigin}${path}`, init));
	const postJson = (
		path: string,
		body: Record<string, string | boolean | string[]>,
		cookie = "",
	) =>
		call(path, {
			body: JSON.stringify(body),
			headers: {
				"content-type": "application/json",
				cookie,
				origin: apiOrigin,
			},
			method: "POST",
		});
	const postToken = (
		fields: Record<string, string>,
		headers: Record<string, string> = {},
	) =>
		call("/api/auth/oauth2/token", {
			body: new URLSearchParams({ client_id: clientId, ...fields }),
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				...headers,
			},
			method: "POST",
		});

	/** Signs up a new user and returns its session cookie. */
	const signUp = async () => {
		const response = await postJson("/api/auth/sign-up/email", {
			email: `${randomUUID()}@wandit.test`,
			name: "Test",
			password: "test-password-1234",
		});
		return response.headers
			.getSetCookie()
			.map((cookie) => cookie.split(";")[0])
			.join("; ");
	};

	/** Returns the id of the `user` row of a session cookie. */
	const getUserId = async (cookie: string) =>
		z
			.object({ user: z.object({ id: z.string() }) })
			.parse(
				await (
					await call("/api/auth/get-session", { headers: { cookie } })
				).json(),
			).user.id;

	const verifier = "v".repeat(64);
	const authorizeQuery = new URLSearchParams({
		client_id: "",
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
		redirect_uri: redirectUri,
		resource: MCP_RESOURCE_URL,
		response_type: "code",
		scope: "projects:read offline_access",
		state: "state-1",
	});
	const authorize = (cookie: string, query = authorizeQuery) =>
		call(`/api/auth/oauth2/authorize?${query}`, {
			headers: { cookie },
		});

	/** Registers a public client with one redirect URI. Returns the authorize query of that client. */
	const registerClient = async (clientRedirectUri: string) => {
		const registered = await postJson("/api/auth/oauth2/register", {
			client_name: "Spec client",
			redirect_uris: [clientRedirectUri],
			token_endpoint_auth_method: "none",
		});
		const query = new URLSearchParams(authorizeQuery);
		query.set(
			"client_id",
			z.object({ client_id: z.string() }).parse(await registered.json())
				.client_id,
		);
		query.set("redirect_uri", clientRedirectUri);
		return query;
	};

	/** Runs authorize, then accepts or denies on the consent page. Returns the redirect URL to the client. */
	const submitConsent = async (
		cookie: string,
		accept: boolean,
		query = authorizeQuery,
	) => {
		const consentPage = (await authorize(cookie, query)).headers.get(
			"location",
		);
		const consent = await postJson(
			"/api/auth/oauth2/consent",
			{ accept, oauth_query: new URL(consentPage ?? "").search.slice(1) },
			cookie,
		);
		return oauthConsentResultSchema.parse(await consent.json()).url;
	};

	/** Exchanges the code of a consent redirect URL at the token endpoint. */
	const exchangeCode = (
		consentUrl: string,
		query = authorizeQuery,
		grantType = "authorization_code",
	) =>
		postToken({
			client_id: query.get("client_id") ?? "",
			code: new URL(consentUrl).searchParams.get("code") ?? "",
			code_verifier: verifier,
			grant_type: grantType,
			redirect_uri: query.get("redirect_uri") ?? "",
			resource: MCP_RESOURCE_URL,
		});

	/** Runs authorize, consent, and the code exchange. Returns the refresh token. */
	const grantRefreshToken = async (cookie: string, query = authorizeQuery) => {
		const token = await exchangeCode(
			await submitConsent(cookie, true, query),
			query,
		);
		return z.object({ refresh_token: z.string() }).parse(await token.json())
			.refresh_token;
	};

	beforeAll(async () => {
		const registered = await postJson("/api/auth/oauth2/register", {
			client_name: "Spec client",
			redirect_uris: ["http://127.0.0.1/callback"],
			token_endpoint_auth_method: "none",
		});
		clientId = z
			.object({ client_id: z.string() })
			.parse(await registered.json()).client_id;
		authorizeQuery.set("client_id", clientId);
	});

	it("refuses an anonymous registration of a confidential client", async () => {
		const response = await postJson("/api/auth/oauth2/register", {
			redirect_uris: ["https://client.test/callback"],
			token_endpoint_auth_method: "client_secret_basic",
		});
		expect(response.status).toBe(400);
	});

	it("shows the consent page again when a stored consent covers the scopes", async () => {
		const cookie = await signUp();
		await grantRefreshToken(cookie);

		const location = new URL(
			(await authorize(cookie)).headers.get("location") ?? "",
		);
		expect(location.pathname).toBe("/oauth/consent");
		expect(location.searchParams.has("code")).toBe(false);
	});

	// main.ts answers 415 for this form body today. The hook still keeps consent forced without it.
	it("refuses an authorization request sent as a POST form", async () => {
		const cookie = await signUp();
		await grantRefreshToken(cookie);

		const response = await call("/api/auth/oauth2/authorize", {
			body: authorizeQuery,
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				cookie,
				origin: apiOrigin,
			},
			method: "POST",
		});
		expect(response.status).toBe(400);
	});

	/** Deletes the first consent of the owner, with the session of `deleterCookie`. */
	const deleteFirstConsent = async (
		ownerCookie: string,
		deleterCookie: string,
	) => {
		const consents = z.array(z.object({ id: z.string() })).parse(
			await (
				await call("/api/auth/oauth2/get-consents", {
					headers: { cookie: ownerCookie },
				})
			).json(),
		);
		await postJson(
			"/api/auth/oauth2/delete-consent",
			{ id: consents[0]?.id ?? "" },
			deleterCookie,
		);
	};

	// The plugin refresh grant does not read the consent. Only the hook ends the grant.
	// Another user must never end the grant of the owner.
	it.each([
		{ deleter: "the owner", expectedStatus: 400, isOwner: true },
		{ deleter: "another user", expectedStatus: 200, isOwner: false },
	])("a consent delete by $deleter -> refresh answers $expectedStatus", async ({
		expectedStatus,
		isOwner,
	}) => {
		const ownerCookie = await signUp();
		const refreshToken = await grantRefreshToken(ownerCookie);

		await deleteFirstConsent(
			ownerCookie,
			isOwner ? ownerCookie : await signUp(),
		);

		const refresh = await postToken({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		});
		expect(refresh.status).toBe(expectedStatus);
	});

	// The API writes one audit row per record. A missing client id from
	// getOAuthProviderState, or a denial counted as a grant, would corrupt the trail.
	it.each([
		{
			flow: "an accept",
			accept: true,
			isDeleted: false,
			expected: ["mcp.consent_granted"],
		},
		{ flow: "a denial", accept: false, isDeleted: false, expected: [] },
		{
			flow: "an accept and an owner delete",
			accept: true,
			isDeleted: true,
			expected: ["mcp.consent_granted", "mcp.consent_revoked"],
		},
	])("$flow records $expected", async ({ accept, isDeleted, expected }) => {
		const cookie = await signUp();
		const userId = await getUserId(cookie);
		consentChanges.length = 0;

		await submitConsent(cookie, accept);
		if (isDeleted) {
			await deleteFirstConsent(cookie, cookie);
		}

		expect(consentChanges).toEqual(
			expected.map((action) => ({ action, clientId, userId })),
		);
	});

	// A code lives 10 minutes. A revoke in that time must end the grant, so no refresh token comes from it.
	// A new grant of the same client in that time must not bring the old code back.
	it.each([
		{
			after: "a revoke",
			isGrantedAgain: false,
			grantType: "authorization_code",
		},
		{
			after: "a revoke and a new grant",
			isGrantedAgain: true,
			grantType: "authorization_code",
		},
		// The plugin trims grant_type before it dispatches. A space must not skip the check.
		{
			after: "a revoke and a new grant, with spaces in grant_type",
			isGrantedAgain: true,
			grantType: " authorization_code ",
		},
	])("answers invalid_grant for a code exchanged after $after", async ({
		isGrantedAgain,
		grantType,
	}) => {
		// The plugin stores the code and consent times in whole seconds. A real user needs seconds to grant again.
		vi.useFakeTimers({ toFake: ["Date"] });
		try {
			const cookie = await signUp();
			const userId = await getUserId(cookie);
			const consentUrl = await submitConsent(cookie, true);
			await deleteFirstConsent(cookie, cookie);
			if (isGrantedAgain) {
				vi.setSystemTime(Date.now() + 2_000);
				await submitConsent(cookie, true);
			}

			const token = await exchangeCode(consentUrl, authorizeQuery, grantType);

			expect(token.status).toBe(400);
			// The plugin also answers invalid_grant, for other reasons. The text proves that the Wandit rule refused.
			await expect(token.json()).resolves.toMatchObject({
				error: "invalid_grant",
				error_description: "the user revoked this grant",
			});
			const refreshTokens = z
				.array(z.object({ userId: z.string() }))
				.parse(memory.oauthRefreshToken);
			expect(refreshTokens.filter((row) => row.userId === userId)).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});

	// Without `resource`, the token is opaque and the after hook cannot find its consent. It must fail closed.
	it("delivers no token for a code exchange without a resource", async () => {
		const cookie = await signUp();
		const query = new URLSearchParams(authorizeQuery);
		query.delete("resource");
		const consentUrl = await submitConsent(cookie, true, query);

		const token = await postToken({
			code: new URL(consentUrl).searchParams.get("code") ?? "",
			code_verifier: verifier,
			grant_type: "authorization_code",
			redirect_uri: query.get("redirect_uri") ?? "",
		});

		expect(token.status).toBe(400);
		await expect(token.json()).resolves.not.toHaveProperty("refresh_token");
	});

	// A refresh that races a revoke can write its new row after the token delete.
	// That row must stay dead after a new grant of the same client, also with spaces in grant_type.
	it.each([
		"refresh_token",
		" refresh_token ",
	])("answers invalid_grant for a refresh token that outlived a revoke, with grant_type %j", async (grantType) => {
		vi.useFakeTimers({ toFake: ["Date"] });
		try {
			const cookie = await signUp();
			const refreshToken = await grantRefreshToken(cookie);
			const tokenRows = [...(memory.oauthRefreshToken ?? [])];
			await deleteFirstConsent(cookie, cookie);
			// The restore plays the late write of the racing refresh.
			memory.oauthRefreshToken = tokenRows;
			vi.setSystemTime(Date.now() + 2_000);
			await submitConsent(cookie, true);

			const refresh = await postToken({
				grant_type: grantType,
				refresh_token: refreshToken,
			});

			expect(refresh.status).toBe(400);
			await expect(refresh.json()).resolves.toMatchObject({
				error: "invalid_grant",
				error_description: "the user revoked this grant",
			});
		} finally {
			vi.useRealTimers();
		}
	});

	// A second machine that connects the same agent updates the consent row and keeps its creation time.
	// The refresh token of the first machine must keep working.
	it("keeps a refresh token alive after a second grant of the same client", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		try {
			const cookie = await signUp();
			const refreshToken = await grantRefreshToken(cookie);
			vi.setSystemTime(Date.now() + 2_000);
			await grantRefreshToken(cookie);

			const refresh = await postToken({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
			});

			expect(refresh.status).toBe(200);
		} finally {
			vi.useRealTimers();
		}
	});

	// McpTokenGuard reads only Bearer tokens, so the server must not issue a DPoP-bound token.
	it("refuses a token request with a DPoP proof", async () => {
		const response = await postToken(
			{ grant_type: "refresh_token", refresh_token: "any" },
			{ dpop: "proof" },
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: "invalid_request",
		});
	});

	// Cursor registers a cursor: redirect. Registration, authorize, and the exact match at the token step must accept it.
	it("lets a Cursor client finish the code flow", async () => {
		const query = await registerClient(
			"cursor://anysphere.cursor-mcp/oauth/callback",
		);

		await expect(grantRefreshToken(await signUp(), query)).resolves.toEqual(
			expect.any(String),
		);
	});

	// The consent page shows the redirect host. Any user can publish an app on these zones.
	it.each([
		[`https://my-app.${env.SITES_DOMAIN}/callback`, 400],
		[`https://${env.SITES_DOMAIN}/callback`, 400],
		// A trailing dot names the same DNS host.
		[`https://my-app.${env.SITES_DOMAIN}./callback`, 400],
		[`https://my-app.${env.SITES_DOMAIN}.evil.test/callback`, 201],
	])("a registration with redirect_uri %s -> %s", async (clientRedirectUri, expectedStatus) => {
		const response = await postJson("/api/auth/oauth2/register", {
			redirect_uris: [clientRedirectUri],
			token_endpoint_auth_method: "none",
		});

		expect(response.status).toBe(expectedStatus);
	});

	// Only the three agent hosts get a fetch. Every other client_id URL fails as an unknown client.
	it.each([
		["https://claude.ai/oauth/claude-code-client-metadata", true],
		["https://evil.test/client.json", false],
		["http://claude.ai/client.json", false],
		["https://claude.ai:8443/client.json", false],
		["https://user@claude.ai/client.json", false],
		["https://claude.ai.evil.com/client.json", false],
		["https://evilclaude.ai/client.json", false],
	])("CIMD client_id %s -> invalid_client, fetched %s", async (cimdClientId, isFetched) => {
		fetchedUrls.length = 0;

		const response = await postToken({
			client_id: cimdClientId,
			code: "any",
			code_verifier: verifier,
			grant_type: "authorization_code",
			redirect_uri: redirectUri,
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: "invalid_client",
		});
		expect(fetchedUrls).toEqual(isFetched ? [cimdClientId] : []);
	});

	// The plugin counts a fetch before its own URL check, at most 120 a minute for all clients.
	// So strangers must be refused first, or they block Claude Code, Codex, and VS Code.
	it("keeps the CIMD fetch budget for the agent hosts", async () => {
		for (let index = 0; index < 121; index += 1) {
			await postToken({
				client_id: `https://stranger-${index}.evil.test/client.json`,
				grant_type: "refresh_token",
				refresh_token: "any",
			});
		}
		fetchedUrls.length = 0;
		const agentClientId = "https://vscode.dev/oauth/client-metadata.json";

		await postToken({
			client_id: agentClientId,
			grant_type: "refresh_token",
			refresh_token: "any",
		});

		expect(fetchedUrls).toEqual([agentClientId]);
	});
});
