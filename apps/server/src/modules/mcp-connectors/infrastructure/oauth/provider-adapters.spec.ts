import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(
	(): {
		META_APP_ID?: string;
		META_APP_SECRET?: string;
	} => ({}),
);

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { getProviderAdapter } from "./provider-adapters";

const TOKEN_URL = "https://graph.example.com/oauth/access_token";
const REDIRECT_URI = "https://api.example.com/mcp/connectors/callback";
const credentials = {
	clientId: "fake-meta-app-id",
	clientSecret: "fake-meta-app-secret",
};
const originalToken = {
	accessToken: "short-lived-access-token",
	expiresIn: 3600,
	refreshToken: null,
	scope: null,
};

const metaAdapter = getProviderAdapter("meta-ads");
if (!metaAdapter?.exchange || !metaAdapter.finalizeExchange) {
	throw new Error("Meta Ads provider adapter is not fully configured");
}

const { exchange, finalizeExchange } = metaAdapter;
type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

let fetchMock: FetchMock;

beforeEach(() => {
	delete mockEnv.META_APP_ID;
	delete mockEnv.META_APP_SECRET;
	fetchMock = vi.fn<typeof fetch>();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Meta Ads provider adapter", () => {
	describe("credentials", () => {
		it.each([
			["app ID", undefined, "fake-meta-app-secret"],
			["app secret", "fake-meta-app-id", undefined],
		])("returns null when the %s is missing", (_missing, appId, appSecret) => {
			mockEnv.META_APP_ID = appId;
			mockEnv.META_APP_SECRET = appSecret;

			expect(metaAdapter.credentials()).toBeNull();
		});

		it("returns both configured credentials", () => {
			mockEnv.META_APP_ID = credentials.clientId;
			mockEnv.META_APP_SECRET = credentials.clientSecret;

			expect(metaAdapter.credentials()).toEqual(credentials);
		});
	});

	describe("exchange", () => {
		it("exchanges a code with a GET request and parses the token", async () => {
			fetchMock.mockResolvedValueOnce(
				Response.json({
					access_token: "short-lived-access-token",
					expires_in: 3600,
					token_type: "bearer",
				}),
			);

			const result = await exchange({
				code: "authorization-code",
				credentials,
				redirectUri: REDIRECT_URI,
				tokenUrl: TOKEN_URL,
			});

			expect(result).toEqual(originalToken);
			expect(fetchMock).toHaveBeenCalledTimes(1);

			const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
			const url = new URL(String(requestUrl));
			expect(url.origin + url.pathname).toBe(TOKEN_URL);
			expect(Object.fromEntries(url.searchParams)).toEqual({
				client_id: credentials.clientId,
				client_secret: credentials.clientSecret,
				code: "authorization-code",
				redirect_uri: REDIRECT_URI,
			});
			expect(init?.method).toBe("GET");
		});

		it("throws when Meta returns a non-OK response", async () => {
			fetchMock.mockResolvedValueOnce(
				Response.json({ error: "invalid_grant" }, { status: 400 }),
			);

			await expect(
				exchange({
					code: "invalid-authorization-code",
					credentials,
					redirectUri: REDIRECT_URI,
					tokenUrl: TOKEN_URL,
				}),
			).rejects.toThrow("Meta OAuth token exchange failed (400)");
		});
	});

	describe("finalizeExchange", () => {
		it("returns the long-lived token when the exchange succeeds", async () => {
			fetchMock.mockResolvedValueOnce(
				Response.json({
					access_token: "long-lived-access-token",
					expires_in: 5_184_000,
					token_type: "bearer",
				}),
			);

			const result = await finalizeExchange({
				credentials,
				token: originalToken,
				tokenUrl: TOKEN_URL,
			});

			expect(result).toEqual({
				accessToken: "long-lived-access-token",
				expiresIn: 5_184_000,
				refreshToken: null,
				scope: null,
			});

			const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
			const url = new URL(String(requestUrl));
			expect(Object.fromEntries(url.searchParams)).toEqual({
				client_id: credentials.clientId,
				client_secret: credentials.clientSecret,
				fb_exchange_token: originalToken.accessToken,
				grant_type: "fb_exchange_token",
			});
			expect(init?.method).toBe("GET");
		});

		it.each([
			[
				"a non-OK response",
				() =>
					Promise.resolve(
						Response.json({ error: "exchange_failed" }, { status: 500 }),
					),
			],
			[
				"a network error",
				() => Promise.reject(new Error("simulated network failure")),
			],
			[
				"an invalid response body",
				() => Promise.resolve(Response.json({ expires_in: 5_184_000 })),
			],
		])("returns the original token after %s", async (_case, response) => {
			fetchMock.mockImplementationOnce(response);

			const result = await finalizeExchange({
				credentials,
				token: originalToken,
				tokenUrl: TOKEN_URL,
			});

			expect(result).toBe(originalToken);
		});
	});

	it("uses 60 days as the default token lifetime", () => {
		expect(metaAdapter.defaultTtlSeconds).toBe(5_184_000);
	});
});
