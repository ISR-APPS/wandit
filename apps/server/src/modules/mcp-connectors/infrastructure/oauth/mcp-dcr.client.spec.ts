import {
	discoverAuthorizationServerMetadata,
	discoverOAuthProtectedResourceMetadata,
	exchangeAuthorization,
	refreshAuthorization,
	registerClient,
	startAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { encryptToken } from "../persistence/token-crypto";
import { McpDcrClient, McpRefreshRejectedError } from "./mcp-dcr.client";

vi.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
	discoverAuthorizationServerMetadata: vi.fn(),
	discoverOAuthProtectedResourceMetadata: vi.fn(),
	exchangeAuthorization: vi.fn(),
	refreshAuthorization: vi.fn(),
	registerClient: vi.fn(),
	startAuthorization: vi.fn(),
}));

const NOW = new Date("2026-07-28T12:00:00.000Z");
const NOW_EPOCH_SECONDS = NOW.getTime() / 1_000;
const REDIRECT_URI = "http://api.test/api/v1/mcp/connectors/callback";
const connector = {
	mcpServerUrl: "https://mcp.example.com/mcp",
	scopes: null,
};

function clientInfo(
	clientSecretExpiresAt: number,
	clientId = "cached-client-id",
): OAuthClientInformationFull {
	return {
		client_id: clientId,
		client_secret: "client-secret",
		client_secret_expires_at: clientSecretExpiresAt,
		redirect_uris: [REDIRECT_URI],
	};
}

describe("McpDcrClient.start", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(discoverOAuthProtectedResourceMetadata)
			.mockReset()
			.mockRejectedValue(new Error("protected resource metadata unavailable"));
		vi.mocked(discoverAuthorizationServerMetadata)
			.mockReset()
			.mockResolvedValue(undefined);
		vi.mocked(exchangeAuthorization).mockReset().mockResolvedValue({
			access_token: "access-token",
			token_type: "bearer",
		});
		vi.mocked(registerClient)
			.mockReset()
			.mockResolvedValue(clientInfo(0, "new-client-id"));
		vi.mocked(startAuthorization)
			.mockReset()
			.mockResolvedValue({
				authorizationUrl: new URL("https://auth.example.com/authorize"),
				codeVerifier: "code-verifier",
			});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it.each([
		["past", NOW_EPOCH_SECONDS - 1],
		["current", NOW_EPOCH_SECONDS],
	])("re-registers a client whose secret expiry is %s", async (_case, expiry) => {
		const client = new McpDcrClient();

		const result = await client.start(
			connector,
			clientInfo(expiry),
			"oauth-state",
			REDIRECT_URI,
		);

		expect(registerClient).toHaveBeenCalledTimes(1);
		expect(result.clientInfo.client_id).toBe("new-client-id");
	});

	it("requests a public client when registering", async () => {
		const client = new McpDcrClient();

		await client.start(connector, null, "oauth-state", REDIRECT_URI);

		expect(registerClient).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				clientMetadata: expect.objectContaining({
					token_endpoint_auth_method: "none",
				}),
			}),
		);
	});

	it("reuses a client when zero marks its secret as non-expiring", async () => {
		const cached = clientInfo(0);
		const client = new McpDcrClient();

		const result = await client.start(
			connector,
			cached,
			"oauth-state",
			REDIRECT_URI,
		);

		expect(registerClient).not.toHaveBeenCalled();
		expect(result.clientInfo).toEqual(cached);
	});

	it("decrypts a cached client secret before starting authorization", async () => {
		const cached = {
			...clientInfo(0),
			client_secret: await encryptToken("client-secret"),
		};
		const client = new McpDcrClient();

		const result = await client.start(
			connector,
			cached,
			"oauth-state",
			REDIRECT_URI,
		);

		expect(startAuthorization).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				clientInformation: expect.objectContaining({
					client_secret: "client-secret",
				}),
			}),
		);
		expect(result.clientInfo.client_secret).toBe("client-secret");
	});
});

describe("McpDcrClient.exchangeCode", () => {
	beforeEach(() => {
		vi.mocked(discoverOAuthProtectedResourceMetadata)
			.mockReset()
			.mockRejectedValue(new Error("protected resource metadata unavailable"));
		vi.mocked(discoverAuthorizationServerMetadata)
			.mockReset()
			.mockResolvedValue(undefined);
		vi.mocked(exchangeAuthorization).mockReset().mockResolvedValue({
			access_token: "access-token",
			token_type: "bearer",
		});
	});

	it("decrypts a stored client secret before exchanging the code", async () => {
		const stored = {
			...clientInfo(0),
			client_secret: await encryptToken("client-secret"),
		};
		const client = new McpDcrClient();

		await client.exchangeCode(
			connector,
			stored,
			"authorization-code",
			"code-verifier",
			REDIRECT_URI,
		);

		expect(exchangeAuthorization).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				clientInformation: expect.objectContaining({
					client_secret: "client-secret",
				}),
			}),
		);
	});
});

describe("McpDcrClient.refresh", () => {
	beforeEach(() => {
		vi.mocked(discoverOAuthProtectedResourceMetadata)
			.mockReset()
			.mockRejectedValue(new Error("protected resource metadata unavailable"));
		vi.mocked(discoverAuthorizationServerMetadata)
			.mockReset()
			.mockResolvedValue(undefined);
		vi.mocked(refreshAuthorization).mockReset().mockResolvedValue({
			access_token: "refreshed-access-token",
			refresh_token: "rotated-refresh-token",
			token_type: "bearer",
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("decrypts a stored client secret before refreshing authorization", async () => {
		const stored = {
			...clientInfo(0),
			client_secret: await encryptToken("client-secret"),
		};
		const client = new McpDcrClient();

		const result = await client.refresh(
			connector,
			stored,
			"current-refresh-token",
		);

		expect(refreshAuthorization).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				clientInformation: expect.objectContaining({
					client_secret: "client-secret",
				}),
				refreshToken: "current-refresh-token",
			}),
		);
		expect(result).toMatchObject({
			accessToken: "refreshed-access-token",
			refreshToken: "rotated-refresh-token",
		});
	});

	it.each([
		[400, "invalid_grant"],
		[401, "invalid_client"],
		[401, "unauthorized_client"],
	])("marks token-endpoint status %i with %s as a rejected refresh", async (status, errorCode) => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						error: errorCode,
						error_description: "Refresh rejected",
					}),
					{ status },
				),
			),
		);
		vi.mocked(refreshAuthorization).mockImplementation(
			async (_authorizationServerUrl, options) => {
				await options.fetchFn?.("https://auth.example.com/token");
				throw new Error(errorCode);
			},
		);
		const client = new McpDcrClient();

		await expect(
			client.refresh(connector, clientInfo(0), "current-refresh-token"),
		).rejects.toBeInstanceOf(McpRefreshRejectedError);
	});

	it.each([
		400, 401,
	])("marks an unreadable token-endpoint status %i as a rejected refresh", async (status) => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("Not JSON", { status })),
		);
		vi.mocked(refreshAuthorization).mockImplementation(
			async (_authorizationServerUrl, options) => {
				await options.fetchFn?.("https://auth.example.com/token");
				throw new Error("refresh rejected");
			},
		);
		const client = new McpDcrClient();

		await expect(
			client.refresh(connector, clientInfo(0), "current-refresh-token"),
		).rejects.toBeInstanceOf(McpRefreshRejectedError);
	});

	it.each([
		[400, "temporarily_unavailable"],
		[401, "server_error"],
		[403, "invalid_grant"],
		[408, "invalid_grant"],
		[429, "invalid_grant"],
		[503, "temporarily_unavailable"],
	])("leaves token-endpoint status %i with %s retryable", async (status, errorCode) => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ error: errorCode }), { status }),
				),
		);
		const transient = new Error(errorCode);
		vi.mocked(refreshAuthorization).mockImplementation(
			async (_authorizationServerUrl, options) => {
				await options.fetchFn?.("https://auth.example.com/token");
				throw transient;
			},
		);
		const client = new McpDcrClient();

		await expect(
			client.refresh(connector, clientInfo(0), "current-refresh-token"),
		).rejects.toBe(transient);
	});

	it("leaves a successful token response untouched", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						access_token: "refreshed-access-token",
						token_type: "bearer",
					}),
					{ status: 200 },
				),
			),
		);
		vi.mocked(refreshAuthorization).mockImplementation(
			async (_authorizationServerUrl, options) => {
				await options.fetchFn?.("https://auth.example.com/token");
				return {
					access_token: "refreshed-access-token",
					token_type: "bearer",
				};
			},
		);
		const client = new McpDcrClient();

		await expect(
			client.refresh(connector, clientInfo(0), "current-refresh-token"),
		).resolves.toMatchObject({ accessToken: "refreshed-access-token" });
	});
});
