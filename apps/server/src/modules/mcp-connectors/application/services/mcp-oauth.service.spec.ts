import { ServiceUnavailableException } from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { McpDcrClient } from "../../infrastructure/oauth/mcp-dcr.client";
import type { PreregOauthClient } from "../../infrastructure/oauth/prereg-oauth.client";
import type {
	ConnectionTokensInput,
	McpConnectionsRepository,
	McpConnectionWithConnectorRow,
} from "../../infrastructure/persistence/mcp-connections.repository";
import type { McpConnectorsRepository } from "../../infrastructure/persistence/mcp-connectors.repository";
import { type McpCallbackQuery, McpOauthService } from "./mcp-oauth.service";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_URL: "http://api.test",
	CORS_ORIGIN: "http://web.test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

const NOW = new Date("2026-07-28T12:00:00.000Z");
const USER_ID = "user-1";
const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTOR_ID = "22222222-2222-4222-8222-222222222222";
const STATE = "callback-state";
const RETURN_URL = "http://web.test/p/project-1?tab=chat";
const CALLBACK_URL = "http://api.test/api/v1/mcp/connectors/callback";

function pendingConnection(
	overrides: Partial<McpConnectionWithConnectorRow> = {},
): McpConnectionWithConnectorRow {
	return {
		accessToken: null,
		accessTokenExpiresAt: null,
		clientInfo: null,
		codeVerifier: null,
		connectedAt: null,
		connector: {
			authorizationUrl: "https://oauth.example.com/authorize",
			authKind: "oauth_prereg",
			createdAt: NOW,
			description: "Future pre-registered OAuth connector",
			enabled: true,
			iconUrl: null,
			id: CONNECTOR_ID,
			mcpServerUrl: null,
			name: "Future OAuth",
			scopes: "campaigns.read",
			slug: "future-oauth",
			sortOrder: 0,
			tokenUrl: "https://oauth.example.com/token",
			toolPolicy: null,
			updatedAt: NOW,
		},
		connectorId: CONNECTOR_ID,
		createdAt: NOW,
		id: CONNECTION_ID,
		oauthState: STATE,
		refreshToken: null,
		returnUrl: RETURN_URL,
		scope: null,
		updatedAt: NOW,
		userId: USER_ID,
		...overrides,
	};
}

function dcrPendingConnection(): McpConnectionWithConnectorRow {
	const pending = pendingConnection();

	return pendingConnection({
		clientInfo: {
			client_id: "cached-client-id",
			redirect_uris: [CALLBACK_URL],
		},
		codeVerifier: "dcr-code-verifier",
		connector: {
			...pending.connector,
			authorizationUrl: null,
			authKind: "mcp_dcr",
			mcpServerUrl: "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer",
			name: "TikTok Ads",
			scopes: null,
			slug: "tiktok-ads",
			tokenUrl: null,
		},
	});
}

function buildService({
	pending = pendingConnection(),
	sessionUserId = USER_ID as string | null,
}: {
	pending?: McpConnectionWithConnectorRow | null;
	sessionUserId?: string | null;
} = {}) {
	const auth = {
		api: {
			getSession: vi.fn().mockResolvedValue(
				sessionUserId
					? {
							user: { id: sessionUserId },
						}
					: null,
			),
		},
	};
	const connectorsRepository = {
		findEnabledBySlug: vi.fn(),
		listEnabled: vi.fn(),
	};
	const storedTransientState = {
		codeVerifier: pending?.codeVerifier ?? null,
		oauthState: pending?.oauthState ?? null,
		returnUrl: pending?.returnUrl ?? null,
	};
	const connectionsRepository = {
		clearPendingState: vi.fn().mockImplementation(async (connectionId) => {
			if (pending?.id === connectionId) {
				storedTransientState.codeVerifier = null;
				storedTransientState.oauthState = null;
				storedTransientState.returnUrl = null;
			}
		}),
		deleteByUserAndConnector: vi.fn(),
		findByState: vi.fn().mockResolvedValue(pending),
		listByUser: vi.fn(),
		saveClientInfoAndCodeVerifier: vi.fn(),
		saveTokens: vi
			.fn()
			.mockImplementation(
				async (connectionId: string, _input: ConnectionTokensInput) => {
					if (pending?.id === connectionId) {
						// Mirrors the repository contract: saving tokens consumes the
						// callback state and clears all transient authorization fields.
						storedTransientState.codeVerifier = null;
						storedTransientState.oauthState = null;
						storedTransientState.returnUrl = null;
					}
				},
			),
		upsertPending: vi.fn(),
	};
	const dcrClient = {
		exchangeCode: vi.fn(),
		start: vi.fn(),
	};
	const preregClient = {
		buildAuthorizeUrl: vi.fn(),
		exchangeCode: vi.fn().mockResolvedValue({
			accessToken: "access-token",
			expiresIn: 3600,
			refreshToken: "refresh-token",
			scope: "campaigns.read",
		}),
	};
	const service = new McpOauthService(
		auth as unknown as Auth,
		connectorsRepository as unknown as McpConnectorsRepository,
		connectionsRepository as unknown as McpConnectionsRepository,
		dcrClient as unknown as McpDcrClient,
		preregClient as unknown as PreregOauthClient,
	);

	return {
		auth,
		connectorsRepository,
		connectionsRepository,
		dcrClient,
		pending,
		preregClient,
		service,
		storedTransientState,
	};
}

function parseRedirect(value: string): URL {
	return new URL(value);
}

describe("McpOauthService.startConnect", () => {
	it("saves DCR authorization data only for the state that owns the row", async () => {
		const pending = dcrPendingConnection();
		const { connectionsRepository, connectorsRepository, dcrClient, service } =
			buildService({ pending });
		connectorsRepository.findEnabledBySlug.mockResolvedValue(pending.connector);
		connectionsRepository.upsertPending.mockResolvedValue(pending);
		dcrClient.start.mockResolvedValue({
			authorizeUrl: "https://auth.example.com/authorize",
			clientInfo: pending.clientInfo,
			codeVerifier: "new-code-verifier",
		});

		await service.startConnect(USER_ID, pending.connector.slug, RETURN_URL);

		const flowState =
			connectionsRepository.upsertPending.mock.calls[0]?.[2]?.oauthState;
		expect(flowState).toEqual(expect.any(String));
		expect(dcrClient.start).toHaveBeenCalledWith(
			pending.connector,
			pending.clientInfo,
			flowState,
			CALLBACK_URL,
		);
		expect(
			connectionsRepository.saveClientInfoAndCodeVerifier,
		).toHaveBeenCalledWith(CONNECTION_ID, flowState, {
			clientInfo: pending.clientInfo,
			codeVerifier: "new-code-verifier",
		});
	});

	it("returns 503 when an oauth_prereg connector has no adapter", async () => {
		const pending = pendingConnection();
		const {
			connectionsRepository,
			connectorsRepository,
			preregClient,
			service,
		} = buildService({ pending });
		connectorsRepository.findEnabledBySlug.mockResolvedValue(pending.connector);
		connectionsRepository.upsertPending.mockResolvedValue(pending);

		await expect(
			service.startConnect(USER_ID, pending.connector.slug, RETURN_URL),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(preregClient.buildAuthorizeUrl).not.toHaveBeenCalled();
	});
});

describe("McpOauthService.handleCallback", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it.each([
		["missing", {}],
		["unknown", { state: "unknown-state" }],
	] satisfies [
		string,
		McpCallbackQuery,
	][])("redirects a %s state to the completion page as invalid_state", async (_case, query) => {
		const { auth, connectionsRepository, service } = buildService({
			pending: null,
		});

		const redirect = parseRedirect(await service.handleCallback(query, {}));

		expect(redirect.origin).toBe("http://web.test");
		expect(redirect.pathname).toBe("/connect/complete");
		expect(redirect.searchParams.get("mcp_error")).toBe("invalid_state");
		expect(connectionsRepository.clearPendingState).not.toHaveBeenCalled();
		expect(auth.api.getSession).not.toHaveBeenCalled();
	});

	it("clears state and redirects a denied provider callback to its stored returnUrl", async () => {
		const { connectionsRepository, preregClient, service } = buildService();

		const redirect = parseRedirect(
			await service.handleCallback(
				{ error: "access_denied", state: STATE },
				{ cookie: "better-auth.session=valid" },
			),
		);

		expect(connectionsRepository.clearPendingState).toHaveBeenCalledWith(
			CONNECTION_ID,
		);
		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
		expect(redirect.origin + redirect.pathname).toBe(
			"http://web.test/p/project-1",
		);
		expect(redirect.searchParams.get("tab")).toBe("chat");
		expect(redirect.searchParams.get("mcp_error")).toBe("access_denied");
		expect(redirect.searchParams.get("mcp_connector")).toBe("future-oauth");
	});

	it("accepts a standard DCR code, persists tokens, and consumes transient state", async () => {
		const pending = dcrPendingConnection();
		const { connectionsRepository, dcrClient, service, storedTransientState } =
			buildService({ pending });
		dcrClient.exchangeCode.mockResolvedValue({
			accessToken: "dcr-access-token",
			expiresIn: 3600,
			refreshToken: "dcr-refresh-token",
			scope: "mcp:tt4b",
		});

		const redirect = parseRedirect(
			await service.handleCallback(
				{ code: "authorization-code", state: STATE },
				{ cookie: "better-auth.session=valid" },
			),
		);

		expect(dcrClient.exchangeCode).toHaveBeenCalledWith(
			pending.connector,
			pending.clientInfo,
			"authorization-code",
			"dcr-code-verifier",
			CALLBACK_URL,
		);
		expect(connectionsRepository.saveTokens).toHaveBeenCalledWith(
			CONNECTION_ID,
			{
				accessToken: "dcr-access-token",
				accessTokenExpiresAt: new Date("2026-07-28T13:00:00.000Z"),
				refreshToken: "dcr-refresh-token",
				scope: "mcp:tt4b",
			},
		);
		expect(connectionsRepository.clearPendingState).not.toHaveBeenCalled();
		expect(storedTransientState).toEqual({
			codeVerifier: null,
			oauthState: null,
			returnUrl: null,
		});
		expect(redirect.origin + redirect.pathname).toBe(
			"http://web.test/p/project-1",
		);
		expect(redirect.searchParams.get("mcp_connected")).toBe("tiktok-ads");
		expect(redirect.searchParams.has("access_token")).toBe(false);
	});

	it("clears cached client info after a DCR exchange failure", async () => {
		const pending = dcrPendingConnection();
		const { connectionsRepository, dcrClient, service } = buildService({
			pending,
		});
		dcrClient.exchangeCode.mockRejectedValue(new Error("invalid_client"));

		const redirect = parseRedirect(
			await service.handleCallback(
				{ code: "authorization-code", state: STATE },
				{ cookie: "better-auth.session=valid" },
			),
		);

		expect(connectionsRepository.clearPendingState).toHaveBeenCalledWith(
			CONNECTION_ID,
			{ clearClientInfo: true },
		);
		expect(redirect.searchParams.get("mcp_error")).toBe("exchange_failed");
	});

	it("keeps prereg cleanup unchanged when no adapter is available", async () => {
		const { connectionsRepository, preregClient, service } = buildService();

		await service.handleCallback(
			{ code: "authorization-code", state: STATE },
			{ cookie: "better-auth.session=valid" },
		);

		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
		expect(connectionsRepository.clearPendingState).toHaveBeenCalledWith(
			CONNECTION_ID,
		);
		expect(connectionsRepository.clearPendingState.mock.calls[0]).toEqual([
			CONNECTION_ID,
		]);
	});

	it.each([
		["a different user", "user-2"],
		["no session", null],
	])("clears state and rejects %s before exchanging the code", async (_case, sessionUserId) => {
		const { connectionsRepository, dcrClient, preregClient, service } =
			buildService({ sessionUserId });

		const redirect = parseRedirect(
			await service.handleCallback(
				{ code: "must-not-be-exchanged", state: STATE },
				{ cookie: "better-auth.session=invalid" },
			),
		);

		expect(connectionsRepository.clearPendingState).toHaveBeenCalledWith(
			CONNECTION_ID,
		);
		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
		expect(dcrClient.exchangeCode).not.toHaveBeenCalled();
		expect(connectionsRepository.saveTokens).not.toHaveBeenCalled();
		expect(redirect.searchParams.get("mcp_error")).toBe("invalid_state");
		expect(redirect.searchParams.has("mcp_connected")).toBe(false);
	});

	it("clears and rejects a callback state older than ten minutes", async () => {
		const stale = pendingConnection({
			updatedAt: new Date(NOW.getTime() - 10 * 60 * 1_000 - 1),
		});
		const { auth, connectionsRepository, preregClient, service } = buildService(
			{ pending: stale },
		);

		const redirect = parseRedirect(
			await service.handleCallback(
				{ code: "must-not-be-exchanged", state: STATE },
				{ cookie: "better-auth.session=valid" },
			),
		);

		expect(connectionsRepository.clearPendingState).toHaveBeenCalledWith(
			CONNECTION_ID,
		);
		expect(auth.api.getSession).not.toHaveBeenCalled();
		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
		expect(redirect.origin + redirect.pathname).toBe(
			"http://web.test/p/project-1",
		);
		expect(redirect.searchParams.get("tab")).toBe("chat");
		expect(redirect.searchParams.get("mcp_error")).toBe("invalid_state");
	});
});
