import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreregOauthClient } from "./prereg-oauth.client";
import type { PreregProviderAdapter } from "./provider-adapters";

const CALLBACK_URL = "http://localhost:3000/api/v1/mcp/connectors/callback";
const TOKEN_URL = "https://oauth.example.com/token";

const connector = {
	authorizationUrl: "https://oauth.example.com/authorize",
	scopes: "campaigns.read campaigns.write",
	tokenUrl: TOKEN_URL,
};
const adapter: PreregProviderAdapter = {
	credentials: () => ({
		clientId: "client-id",
		clientSecret: "client-secret",
	}),
};

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

let fetchMock: FetchMock;

beforeEach(() => {
	fetchMock = vi.fn<typeof fetch>();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("PreregOauthClient", () => {
	it("builds a standard authorization URL", () => {
		const client = new PreregOauthClient();

		const authorizeUrl = new URL(
			client.buildAuthorizeUrl(connector, adapter, "oauth-state", CALLBACK_URL),
		);

		expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
			"https://oauth.example.com/authorize",
		);
		expect(Object.fromEntries(authorizeUrl.searchParams)).toEqual({
			client_id: "client-id",
			redirect_uri: CALLBACK_URL,
			response_type: "code",
			scope: "campaigns.read campaigns.write",
			state: "oauth-state",
		});
	});

	it("exchanges a standard authorization code", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({
				access_token: "access-token",
				expires_in: "3600",
				refresh_token: "refresh-token",
				scope: "campaigns.read",
			}),
		);
		const client = new PreregOauthClient();

		const result = await client.exchangeCode(
			connector,
			adapter,
			"authorization-code",
			CALLBACK_URL,
		);

		expect(result).toEqual({
			accessToken: "access-token",
			expiresIn: 3600,
			refreshToken: "refresh-token",
			scope: "campaigns.read",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe(TOKEN_URL);
		expect(init?.method).toBe("POST");
		expect(new Headers(init?.headers).get("Content-Type")).toBe(
			"application/x-www-form-urlencoded",
		);
		expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual(
			{
				client_id: "client-id",
				client_secret: "client-secret",
				code: "authorization-code",
				grant_type: "authorization_code",
				redirect_uri: CALLBACK_URL,
			},
		);
	});

	it("uses an adapter default when expires_in is missing", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({
				access_token: "access-token",
			}),
		);
		const client = new PreregOauthClient();

		const result = await client.exchangeCode(
			connector,
			{ ...adapter, defaultTtlSeconds: 7200 },
			"authorization-code",
			CALLBACK_URL,
		);

		expect(result.expiresIn).toBe(7200);
	});
});
