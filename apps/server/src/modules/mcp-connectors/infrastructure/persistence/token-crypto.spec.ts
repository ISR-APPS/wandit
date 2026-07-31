import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { decryptToken, encryptToken } from "./token-crypto";

describe("MCP token crypto", () => {
	it("round-trips an encrypted token", async () => {
		const rawToken = "raw-access-token";

		const encryptedToken = await encryptToken(rawToken);

		expect(encryptedToken).not.toBe(rawToken);
		await expect(decryptToken(encryptedToken)).resolves.toBe(rawToken);
	});

	it("passes through a legacy plaintext token", async () => {
		await expect(decryptToken("legacy-plaintext-token")).resolves.toBe(
			"legacy-plaintext-token",
		);
	});
});
