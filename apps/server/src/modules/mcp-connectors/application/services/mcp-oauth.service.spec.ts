import {
	BadRequestException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
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
		// Mirrors the repository's conditional consume: only the caller that
		// still matches the stored state wins the claim.
		claimPendingState: vi
			.fn()
			.mockImplementation(
				async (connectionId: string, expectedState: string) => {
					if (
						pending?.id === connectionId &&
						storedTransientState.oauthState === expectedState
					) {
						storedTransientState.codeVerifier = null;
						storedTransientState.oauthState = null;
						storedTransientState.returnUrl = null;
						return true;
					}
					return false;
				},
			),
		clearPendingState: vi.fn().mockImplementation(async (connectionId) => {
			if (pending?.id === connectionId) {
				storedTransientState.codeVerifier = null;
				storedTransientState.oauthState = null;
				storedTransientState.returnUrl = null;
			}
		}),
		deleteByUserAndConnector: vi.fn(),
		findByState: vi.fn().mockResolvedValue(pending),
		findByUserAndConnector: vi.fn().mockResolvedValue(null),
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
	const lifecycleEvents = {
		enqueue: vi.fn().mockResolvedValue(null),
	};
	const service = new McpOauthService(
		auth as unknown as Auth,
		connectorsRepository as unknown as McpConnectorsRepository,
		connectionsRepository as unknown as McpConnectionsRepository,
		dcrClient as unknown as McpDcrClient,
		preregClient as unknown as PreregOauthClient,
		lifecycleEvents as unknown as LifecycleEventsService,
	);

	return {
		auth,
		connectorsRepository,
		connectionsRepository,
		dcrClient,
		lifecycleEvents,
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
		expect(redirect.searchParams.get("app_error")).toBe("invalid_state");
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
		expect(redirect.searchParams.get("app_error")).toBe("access_denied");
		expect(redirect.searchParams.get("app_connector")).toBe("future-oauth");
	});

	it("accepts a standard DCR code, persists tokens, and consumes transient state", async () => {
		const pending = dcrPendingConnection();
		const {
			connectionsRepository,
			dcrClient,
			lifecycleEvents,
			service,
			storedTransientState,
		} = buildService({ pending });
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
		expect(lifecycleEvents.enqueue).toHaveBeenCalledWith({
			event: "ads_connected",
			idempotencyKey: `ads_connected:${USER_ID}`,
			payload: { connector: "tiktok-ads" },
			userId: USER_ID,
		});
		expect(
			connectionsRepository.saveTokens.mock.invocationCallOrder[0],
		).toBeLessThan(lifecycleEvents.enqueue.mock.invocationCallOrder[0] ?? 0);
		expect(storedTransientState).toEqual({
			codeVerifier: null,
			oauthState: null,
			returnUrl: null,
		});
		expect(redirect.origin + redirect.pathname).toBe(
			"http://web.test/p/project-1",
		);
		expect(redirect.searchParams.get("app_connected")).toBe("tiktok-ads");
		expect(redirect.searchParams.has("access_token")).toBe(false);
	});

	it("captures Meta Ads connections and ignores non-ads connectors", async () => {
		const metaPending = dcrPendingConnection();
		metaPending.connector = {
			...metaPending.connector,
			name: "Meta Ads",
			slug: "meta-ads",
		};
		const meta = buildService({ pending: metaPending });
		meta.dcrClient.exchangeCode.mockResolvedValue({
			accessToken: "meta-access-token",
			expiresIn: null,
			refreshToken: null,
			scope: "ads_management",
		});

		await meta.service.handleCallback(
			{ code: "authorization-code", state: STATE },
			{ cookie: "better-auth.session=valid" },
		);

		expect(meta.lifecycleEvents.enqueue).toHaveBeenCalledWith({
			event: "ads_connected",
			idempotencyKey: `ads_connected:${USER_ID}`,
			payload: { connector: "meta-ads" },
			userId: USER_ID,
		});

		const otherPending = dcrPendingConnection();
		otherPending.connector = {
			...otherPending.connector,
			name: "Other connector",
			slug: "future-connector",
		};
		const other = buildService({ pending: otherPending });
		other.dcrClient.exchangeCode.mockResolvedValue({
			accessToken: "other-access-token",
			expiresIn: null,
			refreshToken: null,
			scope: null,
		});

		await other.service.handleCallback(
			{ code: "authorization-code", state: STATE },
			{ cookie: "better-auth.session=valid" },
		);

		expect(other.connectionsRepository.saveTokens).toHaveBeenCalledOnce();
		expect(other.lifecycleEvents.enqueue).not.toHaveBeenCalled();
	});

	it("does not capture a connection when token persistence fails", async () => {
		const pending = dcrPendingConnection();
		const { connectionsRepository, dcrClient, lifecycleEvents, service } =
			buildService({ pending });
		dcrClient.exchangeCode.mockResolvedValue({
			accessToken: "dcr-access-token",
			expiresIn: 3600,
			refreshToken: "dcr-refresh-token",
			scope: "mcp:tt4b",
		});
		connectionsRepository.saveTokens.mockRejectedValue(
			new Error("database unavailable"),
		);

		const redirect = parseRedirect(
			await service.handleCallback(
				{ code: "authorization-code", state: STATE },
				{ cookie: "better-auth.session=valid" },
			),
		);

		expect(redirect.searchParams.get("app_error")).toBe("exchange_failed");
		expect(lifecycleEvents.enqueue).not.toHaveBeenCalled();
	});

	it("keeps a successful connection when lifecycle capture fails", async () => {
		const pending = dcrPendingConnection();
		const { dcrClient, lifecycleEvents, service } = buildService({ pending });
		dcrClient.exchangeCode.mockResolvedValue({
			accessToken: "dcr-access-token",
			expiresIn: 3600,
			refreshToken: "dcr-refresh-token",
			scope: "mcp:tt4b",
		});
		lifecycleEvents.enqueue.mockRejectedValue(
			new Error("lifecycle outbox unavailable"),
		);

		const redirect = parseRedirect(
			await service.handleCallback(
				{ code: "authorization-code", state: STATE },
				{ cookie: "better-auth.session=valid" },
			),
		);

		expect(redirect.searchParams.get("app_connected")).toBe("tiktok-ads");
		expect(redirect.searchParams.has("app_error")).toBe(false);
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
		expect(redirect.searchParams.get("app_error")).toBe("exchange_failed");
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
		expect(redirect.searchParams.get("app_error")).toBe("invalid_state");
		expect(redirect.searchParams.has("app_connected")).toBe(false);
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
		expect(redirect.searchParams.get("app_error")).toBe("invalid_state");
	});
});

describe("McpOauthService.handleCallback (mobile return)", () => {
	const MOBILE_RETURN_URL = "exp://192.168.1.172:8081/--/connect/complete";

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("forwards code+state to the deep link without a session and without exchanging", async () => {
		const pending = pendingConnection({ returnUrl: MOBILE_RETURN_URL });
		const { auth, connectionsRepository, dcrClient, preregClient, service } =
			buildService({ pending, sessionUserId: null });

		const redirect = parseRedirect(
			await service.handleCallback(
				{ code: "authorization-code", state: STATE },
				{},
			),
		);

		// No web session exists in the auth browser — completion authenticates
		// through POST /complete instead, so nothing must be exchanged here.
		expect(auth.api.getSession).not.toHaveBeenCalled();
		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
		expect(dcrClient.exchangeCode).not.toHaveBeenCalled();
		expect(connectionsRepository.saveTokens).not.toHaveBeenCalled();
		expect(connectionsRepository.clearPendingState).not.toHaveBeenCalled();

		expect(redirect.protocol).toBe("exp:");
		expect(redirect.pathname).toBe("/--/connect/complete");
		expect(redirect.searchParams.get("app_connector")).toBe("future-oauth");
		expect(redirect.searchParams.get("mcp_code")).toBe("authorization-code");
		expect(redirect.searchParams.get("mcp_state")).toBe(STATE);
	});

	it("clears state and reports access_denied to the deep link when the user refuses", async () => {
		const pending = pendingConnection({ returnUrl: MOBILE_RETURN_URL });
		const { connectionsRepository, service } = buildService({
			pending,
			sessionUserId: null,
		});

		const redirect = parseRedirect(
			await service.handleCallback(
				{ error: "access_denied", state: STATE },
				{},
			),
		);

		expect(connectionsRepository.clearPendingState).toHaveBeenCalledWith(
			CONNECTION_ID,
		);
		expect(redirect.protocol).toBe("exp:");
		expect(redirect.searchParams.get("app_error")).toBe("access_denied");
		expect(redirect.searchParams.has("mcp_code")).toBe(false);
	});
});

describe("McpOauthService.startConnect (mobile return)", () => {
	it.each([
		["wandit://connect/complete"],
		["exp://192.168.1.172:8081/--/connect/complete"],
		["http://localhost:8081/connect/complete"],
	])("accepts the mobile returnUrl %s", async (returnUrl) => {
		const pending = dcrPendingConnection();
		pending.returnUrl = returnUrl;
		const { connectionsRepository, connectorsRepository, dcrClient, service } =
			buildService({ pending });
		connectorsRepository.findEnabledBySlug.mockResolvedValue(pending.connector);
		connectionsRepository.upsertPending.mockResolvedValue(pending);
		dcrClient.start.mockResolvedValue({
			authorizeUrl: "https://auth.example.com/authorize",
			clientInfo: pending.clientInfo,
			codeVerifier: "new-code-verifier",
		});

		await expect(
			service.startConnect(USER_ID, pending.connector.slug, returnUrl),
		).resolves.toEqual({ authorizeUrl: "https://auth.example.com/authorize" });
	});

	it("still rejects a foreign web origin", async () => {
		const pending = pendingConnection();
		const { connectorsRepository, service } = buildService({ pending });
		connectorsRepository.findEnabledBySlug.mockResolvedValue(pending.connector);

		await expect(
			service.startConnect(
				USER_ID,
				pending.connector.slug,
				"http://evil.test/connect/complete",
			),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe("McpOauthService.completeConnect", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("exchanges the code for the pending row's user and returns the connected item", async () => {
		const pending = dcrPendingConnection();
		pending.returnUrl = "wandit://connect/complete";
		const { connectionsRepository, dcrClient, service } = buildService({
			pending,
		});
		dcrClient.exchangeCode.mockResolvedValue({
			accessToken: "dcr-access-token",
			expiresIn: 3600,
			refreshToken: "dcr-refresh-token",
			scope: "mcp:tt4b",
		});
		connectionsRepository.findByUserAndConnector.mockResolvedValue({
			...pending,
			accessToken: "dcr-access-token",
			connectedAt: NOW,
		});

		const item = await service.completeConnect(USER_ID, {
			code: "authorization-code",
			state: STATE,
		});

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
		expect(item).toMatchObject({
			slug: "tiktok-ads",
			status: "connected",
		});
	});

	it("rejects a foreign session user WITHOUT clearing the owner's pending row", async () => {
		const pending = pendingConnection({
			returnUrl: "wandit://connect/complete",
		});
		const { connectionsRepository, dcrClient, preregClient, service } =
			buildService({ pending });

		await expect(
			service.completeConnect("user-2", {
				code: "must-not-be-exchanged",
				state: STATE,
			}),
		).rejects.toBeInstanceOf(BadRequestException);

		// Clearing here would let any authenticated caller cancel the real
		// owner's in-flight connect — the row must survive the rejection.
		expect(connectionsRepository.clearPendingState).not.toHaveBeenCalled();
		expect(connectionsRepository.claimPendingState).not.toHaveBeenCalled();
		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
		expect(dcrClient.exchangeCode).not.toHaveBeenCalled();
		expect(connectionsRepository.saveTokens).not.toHaveBeenCalled();
	});

	it("rejects a duplicate completion that loses the state claim without exchanging", async () => {
		const pending = pendingConnection({
			returnUrl: "wandit://connect/complete",
		});
		const { connectionsRepository, dcrClient, preregClient, service } =
			buildService({ pending });
		// The first completion already consumed the state — the conditional
		// claim reports the loss.
		connectionsRepository.claimPendingState.mockResolvedValue(false);

		await expect(
			service.completeConnect(USER_ID, {
				code: "must-not-be-exchanged",
				state: STATE,
			}),
		).rejects.toBeInstanceOf(BadRequestException);

		expect(connectionsRepository.claimPendingState).toHaveBeenCalledWith(
			CONNECTION_ID,
			STATE,
		);
		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
		expect(dcrClient.exchangeCode).not.toHaveBeenCalled();
		expect(connectionsRepository.saveTokens).not.toHaveBeenCalled();
	});

	it("rejects a stale pending state", async () => {
		const stale = pendingConnection({
			returnUrl: "wandit://connect/complete",
			updatedAt: new Date(NOW.getTime() - 10 * 60 * 1_000 - 1),
		});
		const { connectionsRepository, preregClient, service } = buildService({
			pending: stale,
		});

		await expect(
			service.completeConnect(USER_ID, {
				code: "must-not-be-exchanged",
				state: STATE,
			}),
		).rejects.toBeInstanceOf(BadRequestException);

		// Conditional on the state value so a stale completion can never wipe
		// a fresh attempt that reused the row.
		expect(connectionsRepository.claimPendingState).toHaveBeenCalledWith(
			CONNECTION_ID,
			STATE,
		);
		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
	});

	it("rejects an unknown state", async () => {
		const { preregClient, service } = buildService({ pending: null });

		await expect(
			service.completeConnect(USER_ID, {
				code: "authorization-code",
				state: "unknown-state",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(preregClient.exchangeCode).not.toHaveBeenCalled();
	});
});

describe("McpOauthService.list", () => {
	it("marks prereg connectors without usable credentials as unavailable", async () => {
		const context = buildService({});
		const prereg = pendingConnection().connector;
		const dcr = {
			...prereg,
			authKind: "mcp_dcr" as const,
			id: "22222222-2222-4222-8222-222222222222",
			mcpServerUrl: "https://mcp.example.com/mcp",
			name: "DCR Connector",
			slug: "dcr-connector",
		};
		context.connectorsRepository.listEnabled.mockResolvedValue([prereg, dcr]);
		context.connectionsRepository.listByUser.mockResolvedValue([]);

		const items = await context.service.list(USER_ID);

		expect(items).toMatchObject([
			{ available: false, slug: "future-oauth", status: "not_connected" },
			{ available: true, slug: "dcr-connector", status: "not_connected" },
		]);
	});
});
