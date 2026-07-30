import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import type { Database } from "../../../../infrastructure/database/database.constants";
import { McpConnectionsRepository } from "./mcp-connections.repository";
import { decryptToken } from "./token-crypto";

type StoredTokenValues = {
	accessToken: string;
	refreshToken: string | null;
};

type StoredClientInfoValues = {
	clientInfo: unknown;
};

type StoredRefreshedTokenValues = StoredTokenValues & {
	accessTokenExpiresAt: Date | null;
};

describe("McpConnectionsRepository.saveClientInfoAndCodeVerifier", () => {
	it("persists a server-issued client secret encrypted", async () => {
		const where = vi.fn();
		const set = vi.fn<
			(values: StoredClientInfoValues) => { where: typeof where }
		>(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const repository = new McpConnectionsRepository({
			update,
		} as unknown as Database);
		const clientSecret = "raw-client-secret";

		await repository.saveClientInfoAndCodeVerifier(
			"connection-1",
			"oauth-state",
			{
				clientInfo: {
					client_id: "client-id",
					client_secret: clientSecret,
					redirect_uris: ["http://api.test/callback"],
				},
				codeVerifier: "code-verifier",
			},
		);

		const stored = set.mock.calls[0]?.[0];

		if (
			typeof stored?.clientInfo !== "object" ||
			stored.clientInfo === null ||
			!("client_secret" in stored.clientInfo) ||
			typeof stored.clientInfo.client_secret !== "string"
		) {
			throw new Error("Expected clientInfo with a string client secret");
		}

		expect(stored.clientInfo.client_secret).not.toBe(clientSecret);
		await expect(decryptToken(stored.clientInfo.client_secret)).resolves.toBe(
			clientSecret,
		);
	});
});

describe("McpConnectionsRepository.saveTokens", () => {
	it("persists encrypted access and refresh tokens", async () => {
		const where = vi.fn();
		const set = vi.fn<(values: StoredTokenValues) => { where: typeof where }>(
			() => ({ where }),
		);
		const update = vi.fn(() => ({ set }));
		const repository = new McpConnectionsRepository({
			update,
		} as unknown as Database);
		const accessToken = "raw-access-token";
		const refreshToken = "raw-refresh-token";

		await repository.saveTokens("connection-1", {
			accessToken,
			accessTokenExpiresAt: null,
			refreshToken,
			scope: "campaigns.read",
		});

		const stored = set.mock.calls[0]?.[0];

		if (!stored?.refreshToken) {
			throw new Error("Expected saveTokens to persist both tokens");
		}

		expect(stored.accessToken).not.toBe(accessToken);
		expect(stored.refreshToken).not.toBe(refreshToken);
		await expect(decryptToken(stored.accessToken)).resolves.toBe(accessToken);
		await expect(decryptToken(stored.refreshToken)).resolves.toBe(refreshToken);
	});
});

describe("McpConnectionsRepository refresh CAS methods", () => {
	it("encrypts refreshed tokens and reports a matching update", async () => {
		const returning = vi.fn().mockResolvedValue([{ id: "connection-1" }]);
		const where = vi.fn(() => ({ returning }));
		const set = vi.fn<
			(values: StoredRefreshedTokenValues) => { where: typeof where }
		>(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const repository = new McpConnectionsRepository({
			update,
		} as unknown as Database);

		const updated = await repository.updateTokensIfRefreshTokenMatches(
			"connection-1",
			"expected-encrypted-refresh-token",
			{
				accessToken: "new-access-token",
				accessTokenExpiresAt: null,
				refreshToken: "rotated-refresh-token",
			},
		);
		const stored = set.mock.calls[0]?.[0];

		if (!stored?.refreshToken) {
			throw new Error("Expected refreshed tokens to be persisted");
		}

		expect(updated).toBe(true);
		await expect(decryptToken(stored.accessToken)).resolves.toBe(
			"new-access-token",
		);
		await expect(decryptToken(stored.refreshToken)).resolves.toBe(
			"rotated-refresh-token",
		);
	});

	it("reports when guarded refresh-token clearing loses the CAS", async () => {
		const returning = vi.fn().mockResolvedValue([]);
		const where = vi.fn(() => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const repository = new McpConnectionsRepository({
			update,
		} as unknown as Database);

		const cleared = await repository.clearRefreshTokenIfMatches(
			"connection-1",
			"expected-encrypted-refresh-token",
		);

		expect(cleared).toBe(false);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({ refreshToken: null }),
		);
	});
});
