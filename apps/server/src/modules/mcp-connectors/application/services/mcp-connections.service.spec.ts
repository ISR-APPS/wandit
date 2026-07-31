import { ConflictException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import {
	type McpDcrClient,
	McpRefreshRejectedError,
} from "../../infrastructure/oauth/mcp-dcr.client";
import type {
	McpConnectionRow,
	McpConnectionsRepository,
} from "../../infrastructure/persistence/mcp-connections.repository";
import type {
	McpConnectorRow,
	McpConnectorsRepository,
} from "../../infrastructure/persistence/mcp-connectors.repository";
import { encryptToken } from "../../infrastructure/persistence/token-crypto";
import { McpConnectionsService } from "./mcp-connections.service";

const NOW = new Date("2026-07-28T12:00:00.000Z");
const USER_ID = "user-1";
const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTOR_ID = "22222222-2222-4222-8222-222222222222";

const connector: McpConnectorRow = {
	authorizationUrl: null,
	authKind: "mcp_dcr",
	createdAt: NOW,
	description: "Example MCP connector",
	enabled: true,
	iconUrl: null,
	id: CONNECTOR_ID,
	mcpServerUrl: "https://mcp.example.com/mcp",
	name: "Example",
	scopes: null,
	slug: "example",
	sortOrder: 0,
	tokenUrl: null,
	toolPolicy: null,
	updatedAt: NOW,
};

function connection(
	overrides: Partial<McpConnectionRow> = {},
): McpConnectionRow {
	return {
		accessToken: "expired-access-token",
		accessTokenExpiresAt: new Date(NOW.getTime() - 1),
		clientInfo: {
			client_id: "client-id",
			redirect_uris: ["http://api.test/api/v1/mcp/connectors/callback"],
		},
		codeVerifier: null,
		connectedAt: NOW,
		connectorId: CONNECTOR_ID,
		createdAt: NOW,
		id: CONNECTION_ID,
		oauthState: null,
		refreshToken: null,
		returnUrl: null,
		scope: null,
		updatedAt: NOW,
		userId: USER_ID,
		...overrides,
	};
}

function buildService(initialConnection: McpConnectionRow) {
	const connectorsRepository = {
		findEnabledBySlug: vi.fn().mockResolvedValue(connector),
	};
	const connectionsRepository = {
		clearRefreshTokenIfMatches: vi.fn().mockResolvedValue(true),
		findByUserAndConnector: vi.fn().mockResolvedValue(initialConnection),
		updateTokensIfRefreshTokenMatches: vi.fn().mockResolvedValue(true),
	};
	const dcrClient = {
		refresh: vi.fn(),
	};
	const service = new McpConnectionsService(
		connectorsRepository as unknown as McpConnectorsRepository,
		connectionsRepository as unknown as McpConnectionsRepository,
		dcrClient as unknown as McpDcrClient,
	);

	return {
		connectionsRepository,
		connectorsRepository,
		dcrClient,
		service,
	};
}

describe("McpConnectionsService.getValidAccessToken", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("refreshes an expired access token and persists a rotated refresh token", async () => {
		const encryptedRefreshToken = await encryptToken("old-refresh-token");
		const expired = connection({ refreshToken: encryptedRefreshToken });
		const { connectionsRepository, dcrClient, service } = buildService(expired);
		dcrClient.refresh.mockResolvedValue({
			accessToken: "new-access-token",
			expiresIn: 3_600,
			refreshToken: "rotated-refresh-token",
			scope: "mcp.read",
		});

		await expect(
			service.getValidAccessToken(USER_ID, connector.slug),
		).resolves.toBe("new-access-token");
		expect(dcrClient.refresh).toHaveBeenCalledWith(
			connector,
			expired.clientInfo,
			"old-refresh-token",
		);
		expect(
			connectionsRepository.updateTokensIfRefreshTokenMatches,
		).toHaveBeenCalledWith(CONNECTION_ID, encryptedRefreshToken, {
			accessToken: "new-access-token",
			accessTokenExpiresAt: new Date("2026-07-28T13:00:00.000Z"),
			refreshToken: "rotated-refresh-token",
		});
	});

	it("refreshes an access token that expires within the 30-second skew", async () => {
		const encryptedRefreshToken = await encryptToken("old-refresh-token");
		const { dcrClient, service } = buildService(
			connection({
				accessToken: await encryptToken("nearly-expired-access-token"),
				accessTokenExpiresAt: new Date(NOW.getTime() + 30_000),
				refreshToken: encryptedRefreshToken,
			}),
		);
		dcrClient.refresh.mockResolvedValue({
			accessToken: "new-access-token",
			expiresIn: 3_600,
			refreshToken: "rotated-refresh-token",
			scope: null,
		});

		await expect(
			service.getValidAccessToken(USER_ID, connector.slug),
		).resolves.toBe("new-access-token");
		expect(dcrClient.refresh).toHaveBeenCalledTimes(1);
	});

	it("preserves the current refresh token when the server omits a replacement", async () => {
		const encryptedRefreshToken = await encryptToken("old-refresh-token");
		const { connectionsRepository, dcrClient, service } = buildService(
			connection({ refreshToken: encryptedRefreshToken }),
		);
		dcrClient.refresh.mockResolvedValue({
			accessToken: "new-access-token",
			expiresIn: null,
			refreshToken: null,
			scope: null,
		});

		await service.getValidAccessToken(USER_ID, connector.slug);

		expect(
			connectionsRepository.updateTokensIfRefreshTokenMatches,
		).toHaveBeenCalledWith(
			CONNECTION_ID,
			encryptedRefreshToken,
			expect.objectContaining({ refreshToken: "old-refresh-token" }),
		);
	});

	it("clears a failed refresh only when the stored refresh token still matches", async () => {
		const encryptedRefreshToken = await encryptToken("old-refresh-token");
		const { connectionsRepository, dcrClient, service } = buildService(
			connection({ refreshToken: encryptedRefreshToken }),
		);
		dcrClient.refresh.mockRejectedValue(
			new McpRefreshRejectedError(new Error("invalid_grant")),
		);

		await expect(
			service.getValidAccessToken(USER_ID, connector.slug),
		).rejects.toBeInstanceOf(ConflictException);
		expect(
			connectionsRepository.clearRefreshTokenIfMatches,
		).toHaveBeenCalledWith(CONNECTION_ID, encryptedRefreshToken);
		expect(
			connectionsRepository.updateTokensIfRefreshTokenMatches,
		).not.toHaveBeenCalled();
	});

	it("preserves the refresh token after a transient refresh failure", async () => {
		const encryptedRefreshToken = await encryptToken("old-refresh-token");
		const { connectionsRepository, dcrClient, service } = buildService(
			connection({ refreshToken: encryptedRefreshToken }),
		);
		const timeout = new Error("token endpoint timed out");
		dcrClient.refresh.mockRejectedValue(timeout);

		await expect(
			service.getValidAccessToken(USER_ID, connector.slug),
		).rejects.toBe(timeout);
		expect(
			connectionsRepository.clearRefreshTokenIfMatches,
		).not.toHaveBeenCalled();
	});

	it("rereads the winner when failed-refresh cleanup loses its CAS", async () => {
		const encryptedRefreshToken = await encryptToken("old-refresh-token");
		const winnerAccessToken = await encryptToken("winner-access-token");
		const expired = connection({ refreshToken: encryptedRefreshToken });
		const winner = connection({
			accessToken: winnerAccessToken,
			accessTokenExpiresAt: new Date(NOW.getTime() + 3_600_000),
			refreshToken: await encryptToken("winner-refresh-token"),
		});
		const { connectionsRepository, dcrClient, service } = buildService(expired);
		connectionsRepository.clearRefreshTokenIfMatches.mockResolvedValue(false);
		connectionsRepository.findByUserAndConnector
			.mockResolvedValueOnce(expired)
			.mockResolvedValueOnce(winner);
		dcrClient.refresh.mockRejectedValue(
			new McpRefreshRejectedError(new Error("invalid_grant")),
		);

		await expect(
			service.getValidAccessToken(USER_ID, connector.slug),
		).resolves.toBe("winner-access-token");
		expect(connectionsRepository.findByUserAndConnector).toHaveBeenCalledTimes(
			2,
		);
	});

	it("single-flights concurrent refreshes for one connection", async () => {
		const encryptedRefreshToken = await encryptToken("old-refresh-token");
		const { promise, resolve } = deferred<{
			accessToken: string;
			expiresIn: number | null;
			refreshToken: string | null;
			scope: string | null;
		}>();
		const { connectionsRepository, dcrClient, service } = buildService(
			connection({ refreshToken: encryptedRefreshToken }),
		);
		dcrClient.refresh.mockReturnValue(promise);

		const first = service.getValidAccessToken(USER_ID, connector.slug);
		await vi.waitFor(() => {
			expect(dcrClient.refresh).toHaveBeenCalledTimes(1);
		});
		const second = service.getValidAccessToken(USER_ID, connector.slug);
		await vi.waitFor(() => {
			expect(
				connectionsRepository.findByUserAndConnector,
			).toHaveBeenCalledTimes(2);
		});

		expect(dcrClient.refresh).toHaveBeenCalledTimes(1);
		resolve({
			accessToken: "shared-access-token",
			expiresIn: 3_600,
			refreshToken: "rotated-refresh-token",
			scope: null,
		});
		await expect(Promise.all([first, second])).resolves.toEqual([
			"shared-access-token",
			"shared-access-token",
		]);
		expect(
			connectionsRepository.updateTokensIfRefreshTokenMatches,
		).toHaveBeenCalledTimes(1);
	});

	it("rereads and returns the winner's access token after losing the token-update CAS", async () => {
		const encryptedRefreshToken = await encryptToken("old-refresh-token");
		const winnerAccessToken = await encryptToken("winner-access-token");
		const expired = connection({ refreshToken: encryptedRefreshToken });
		const winner = connection({
			accessToken: winnerAccessToken,
			accessTokenExpiresAt: new Date(NOW.getTime() + 3_600_000),
			refreshToken: await encryptToken("winner-refresh-token"),
		});
		const { connectionsRepository, dcrClient, service } = buildService(expired);
		connectionsRepository.updateTokensIfRefreshTokenMatches.mockResolvedValue(
			false,
		);
		connectionsRepository.findByUserAndConnector
			.mockResolvedValueOnce(expired)
			.mockResolvedValueOnce(winner);
		dcrClient.refresh.mockResolvedValue({
			accessToken: "loser-access-token",
			expiresIn: 3_600,
			refreshToken: "loser-refresh-token",
			scope: null,
		});

		await expect(
			service.getValidAccessToken(USER_ID, connector.slug),
		).resolves.toBe("winner-access-token");
		expect(connectionsRepository.findByUserAndConnector).toHaveBeenCalledTimes(
			2,
		);
		expect(
			connectionsRepository.clearRefreshTokenIfMatches,
		).not.toHaveBeenCalled();
	});

	it("requires reconnect when an expired access token has no refresh token", async () => {
		const { connectionsRepository, dcrClient, service } = buildService(
			connection(),
		);

		await expect(
			service.getValidAccessToken(USER_ID, connector.slug),
		).rejects.toMatchObject({
			message: "Could not get Example access — reconnect Example and try again",
		});
		expect(dcrClient.refresh).not.toHaveBeenCalled();
		expect(
			connectionsRepository.clearRefreshTokenIfMatches,
		).not.toHaveBeenCalled();
		expect(
			connectionsRepository.updateTokensIfRefreshTokenMatches,
		).not.toHaveBeenCalled();
	});
});

function deferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
} {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});

	return { promise, resolve };
}
