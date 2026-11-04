/**
 * Repository for `github_connections`: the GitHub user connection of one Wandit user.
 * The GitHub account service calls it for the connect, the callback, the token refresh, and the disconnect.
 * It encrypts the tokens with better-auth `symmetricEncrypt` and `BETTER_AUTH_SECRET`, like the `account` table.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq } from "@wandit/db";
import { githubConnections } from "@wandit/db/schema/github";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { GithubUser, GithubUserTokens } from "../github/github-app.client";

/** One connection with its tokens decrypted. */
export type GithubConnection = {
	/** GitHub login saved at the callback, for display; null before the first connect. */
	githubLogin: string | null;
	/** Numeric GitHub user id saved at the callback; null before the first connect. */
	githubUserId: number | null;
	/** Decrypted user access token; null when the user is not connected. */
	accessToken: string | null;
	accessTokenExpiresAt: Date | null;
	/** Decrypted refresh token; null when not connected or when the App does not expire tokens. */
	refreshToken: string | null;
	/**
	 * The stored ciphertext of `refreshToken`. The refresh passes it back to
	 * `updateTokensIfRefreshTokenMatches` and `clearTokensIfRefreshTokenMatches`.
	 */
	encryptedRefreshToken: string | null;
};

/** The pending connect that the callback finds by its state. */
export type GithubPendingConnect = {
	id: string;
	userId: string;
	/** When the authorize route stored the state. The callback refuses one older than 10 minutes. */
	oauthStateCreatedAt: Date | null;
	/** Builder URL to redirect to; checked against `CORS_ORIGIN` when it was stored. */
	returnUrl: string | null;
};

/** Drizzle persistence for `github_connections`. Every token write encrypts first. */
@Injectable()
export class GithubConnectionsRepository {
	private readonly logger = new Logger(GithubConnectionsRepository.name);

	constructor(
		@Inject(DATABASE)
		private readonly db: Database,
	) {}

	/**
	 * The connection of one user, or null when the user never started a connect.
	 * Tokens that do not decrypt come back as null, so the row reads as not connected.
	 */
	async findByUser(userId: string): Promise<GithubConnection | null> {
		const [row] = await this.db
			.select()
			.from(githubConnections)
			.where(eq(githubConnections.userId, userId))
			.limit(1);
		if (row === undefined) {
			return null;
		}
		const connection = {
			githubLogin: row.githubLogin,
			githubUserId: row.githubUserId,
		};
		try {
			return {
				...connection,
				accessToken:
					row.accessToken === null ? null : await decryptToken(row.accessToken),
				accessTokenExpiresAt: row.accessTokenExpiresAt,
				encryptedRefreshToken: row.refreshToken,
				refreshToken:
					row.refreshToken === null
						? null
						: await decryptToken(row.refreshToken),
			};
		} catch (error) {
			// A changed BETTER_AUTH_SECRET makes the decrypt throw. Without tokens the
			// panel offers Connect, and the next `saveTokens` writes new tokens.
			this.logger.warn(
				`GitHub tokens of user ${userId} do not decrypt; the connection reads as not connected: ${getErrorMessage(error)}`,
			);
			return {
				...connection,
				accessToken: null,
				accessTokenExpiresAt: null,
				encryptedRefreshToken: null,
				refreshToken: null,
			};
		}
	}

	/** The pending connect that holds `state`, or null. */
	async findByState(state: string): Promise<GithubPendingConnect | null> {
		const [row] = await this.db
			.select({
				id: githubConnections.id,
				oauthStateCreatedAt: githubConnections.oauthStateCreatedAt,
				returnUrl: githubConnections.returnUrl,
				userId: githubConnections.userId,
			})
			.from(githubConnections)
			.where(eq(githubConnections.oauthState, state))
			.limit(1);
		return row ?? null;
	}

	/** Stores a new connect state on the user's row and creates the row on the first connect. */
	async upsertPendingState(
		userId: string,
		state: string,
		returnUrl: string,
	): Promise<void> {
		const pending = {
			oauthState: state,
			oauthStateCreatedAt: new Date(),
			returnUrl,
		};
		await this.db
			.insert(githubConnections)
			.values({ userId, ...pending })
			.onConflictDoUpdate({
				set: { ...pending, updatedAt: new Date() },
				target: githubConnections.userId,
			});
	}

	/**
	 * Clears the state only when the row still holds it. False means another
	 * request took the state first, so a replayed callback exchanges no code.
	 */
	async claimState(id: string, state: string): Promise<boolean> {
		const [row] = await this.db
			.update(githubConnections)
			.set({
				oauthState: null,
				oauthStateCreatedAt: null,
				returnUrl: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(githubConnections.id, id),
					eq(githubConnections.oauthState, state),
				),
			)
			.returning({ id: githubConnections.id });
		return row !== undefined;
	}

	/**
	 * Saves the tokens, the login, and the id of the GitHub user of a finished connect.
	 * Creates the row when a disconnect removed it.
	 */
	async saveTokens(
		userId: string,
		githubUser: GithubUser,
		tokens: GithubUserTokens,
	): Promise<void> {
		const columns = {
			githubLogin: githubUser.login,
			githubUserId: githubUser.id,
			...(await encryptTokens(tokens)),
		};
		await this.db
			.insert(githubConnections)
			.values({ userId, ...columns })
			.onConflictDoUpdate({
				set: { ...columns, updatedAt: new Date() },
				target: githubConnections.userId,
			});
	}

	/**
	 * Saves refreshed tokens only when the row still holds the refresh token
	 * that the refresh sent. False means another request refreshed first: read
	 * the row again and use its tokens.
	 */
	async updateTokensIfRefreshTokenMatches(
		userId: string,
		expectedEncryptedRefreshToken: string,
		tokens: GithubUserTokens,
	): Promise<boolean> {
		const [row] = await this.db
			.update(githubConnections)
			.set({ ...(await encryptTokens(tokens)), updatedAt: new Date() })
			.where(
				and(
					eq(githubConnections.userId, userId),
					eq(githubConnections.refreshToken, expectedEncryptedRefreshToken),
				),
			)
			.returning({ id: githubConnections.id });
		return row !== undefined;
	}

	/**
	 * Removes the tokens after GitHub refused a refresh, only when the row
	 * still holds the refused refresh token. The row then reads
	 * as not connected. False means another request saved new tokens.
	 */
	async clearTokensIfRefreshTokenMatches(
		userId: string,
		expectedEncryptedRefreshToken: string,
	): Promise<boolean> {
		const [row] = await this.db
			.update(githubConnections)
			.set({
				accessToken: null,
				accessTokenExpiresAt: null,
				refreshToken: null,
				refreshTokenExpiresAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(githubConnections.userId, userId),
					eq(githubConnections.refreshToken, expectedEncryptedRefreshToken),
				),
			)
			.returning({ id: githubConnections.id });
		return row !== undefined;
	}

	/** Disconnects the user. Project links stay: they use installation tokens, not this row. */
	async deleteByUser(userId: string): Promise<void> {
		await this.db
			.delete(githubConnections)
			.where(eq(githubConnections.userId, userId));
	}
}

// The token columns of one write. The encryption uses a random nonce, so the
// same token gives a new ciphertext on each write.
async function encryptTokens(tokens: GithubUserTokens) {
	return {
		accessToken: await encryptToken(tokens.accessToken),
		accessTokenExpiresAt: tokens.accessTokenExpiresAt,
		refreshToken:
			tokens.refreshToken === null
				? null
				: await encryptToken(tokens.refreshToken),
		refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
	};
}

function encryptToken(token: string): Promise<string> {
	return symmetricEncrypt({ data: token, key: env.BETTER_AUTH_SECRET });
}

// Every stored token went through `encryptToken`. A changed
// BETTER_AUTH_SECRET makes this throw; `findByUser` catches it.
function decryptToken(token: string): Promise<string> {
	return symmetricDecrypt({ data: token, key: env.BETTER_AUTH_SECRET });
}
