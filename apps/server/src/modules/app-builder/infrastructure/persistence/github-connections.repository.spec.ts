import type { githubConnections } from "@wandit/db/schema/github";
import { symmetricEncrypt } from "better-auth/crypto";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { GithubConnectionsRepository } from "./github-connections.repository";

function repositoryReturning(rows: (typeof githubConnections.$inferSelect)[]) {
	const limit = vi.fn(async () => rows);
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// select chain that `findByUser` calls.
	const db = Object.assign(Object.create(null), { select }) as Database;
	return new GithubConnectionsRepository(db);
}

describe("GithubConnectionsRepository.findByUser", () => {
	it("reads a row whose tokens do not decrypt as not connected", async () => {
		const otherSecret = "an-old-better-auth-secret-before-rotation";
		const repository = repositoryReturning([
			{
				accessToken: await symmetricEncrypt({
					data: "ghu_old",
					key: otherSecret,
				}),
				accessTokenExpiresAt: new Date("2026-11-04T18:00:00.000Z"),
				createdAt: new Date("2026-11-01T10:00:00.000Z"),
				githubLogin: "octocat",
				githubUserId: 583231,
				id: "connection-1",
				oauthState: null,
				oauthStateCreatedAt: null,
				refreshToken: await symmetricEncrypt({
					data: "ghr_old",
					key: otherSecret,
				}),
				refreshTokenExpiresAt: new Date("2027-05-01T10:00:00.000Z"),
				returnUrl: null,
				updatedAt: new Date("2026-11-01T10:00:00.000Z"),
				userId: "user-1",
			},
		]);

		await expect(repository.findByUser("user-1")).resolves.toEqual({
			accessToken: null,
			accessTokenExpiresAt: null,
			encryptedRefreshToken: null,
			githubLogin: "octocat",
			githubUserId: 583231,
			refreshToken: null,
		});
	});
});
