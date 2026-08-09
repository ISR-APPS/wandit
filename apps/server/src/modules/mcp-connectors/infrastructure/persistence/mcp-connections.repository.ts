import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "@wandit/db";
import {
	mcpConnections,
	mcpConnectors,
} from "@wandit/db/schema/mcp-connectors";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { McpConnectorRow } from "./mcp-connectors.repository";
import { encryptToken } from "./token-crypto";

export type McpConnectionRow = typeof mcpConnections.$inferSelect;

export type McpConnectionWithConnectorRow = McpConnectionRow & {
	connector: McpConnectorRow;
};

export type PendingConnectionInput = {
	codeVerifier?: string | null;
	oauthState: string;
	returnUrl: string;
};

export type DcrAuthorizationInput = {
	clientInfo: unknown;
	codeVerifier: string;
};

export type ClearPendingStateOptions = {
	clearClientInfo?: boolean;
};

export type ConnectionTokensInput = {
	accessToken: string;
	accessTokenExpiresAt: Date | null;
	refreshToken: string | null;
	scope: string | null;
};

export type RefreshedConnectionTokensInput = {
	accessToken: string;
	accessTokenExpiresAt: Date | null;
	refreshToken: string;
};

@Injectable()
export class McpConnectionsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	listByUser(userId: string): Promise<McpConnectionRow[]> {
		return this.db
			.select()
			.from(mcpConnections)
			.where(eq(mcpConnections.userId, userId));
	}

	async findByUserAndConnector(
		userId: string,
		connectorId: string,
	): Promise<McpConnectionRow | null> {
		const [row] = await this.db
			.select()
			.from(mcpConnections)
			.where(
				and(
					eq(mcpConnections.userId, userId),
					eq(mcpConnections.connectorId, connectorId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async upsertPending(
		userId: string,
		connectorId: string,
		input: PendingConnectionInput,
	): Promise<McpConnectionRow> {
		const transientFields = {
			codeVerifier: input.codeVerifier ?? null,
			oauthState: input.oauthState,
			returnUrl: input.returnUrl,
		};
		const [row] = await this.db
			.insert(mcpConnections)
			.values({
				connectorId,
				userId,
				...transientFields,
			})
			.onConflictDoUpdate({
				set: {
					...transientFields,
					updatedAt: new Date(),
				},
				target: [mcpConnections.userId, mcpConnections.connectorId],
			})
			.returning();

		if (!row) {
			throw new Error("MCP connection upsert did not return a row");
		}

		return row;
	}

	async findByState(
		state: string,
	): Promise<McpConnectionWithConnectorRow | null> {
		const [row] = await this.db
			.select({
				connection: mcpConnections,
				connector: mcpConnectors,
			})
			.from(mcpConnections)
			.innerJoin(
				mcpConnectors,
				eq(mcpConnectors.id, mcpConnections.connectorId),
			)
			.where(eq(mcpConnections.oauthState, state))
			.limit(1);

		return row
			? {
					...row.connection,
					connector: row.connector,
				}
			: null;
	}

	async saveClientInfoAndCodeVerifier(
		connectionId: string,
		oauthState: string,
		input: DcrAuthorizationInput,
	): Promise<void> {
		const clientInfo =
			typeof input.clientInfo === "object" &&
			input.clientInfo !== null &&
			"client_secret" in input.clientInfo &&
			typeof input.clientInfo.client_secret === "string"
				? {
						...input.clientInfo,
						client_secret: await encryptToken(input.clientInfo.client_secret),
					}
				: input.clientInfo;

		await this.db
			.update(mcpConnections)
			.set({
				// Public clients are requested, but encrypt any server-issued secret defensively.
				clientInfo,
				codeVerifier: input.codeVerifier,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(mcpConnections.id, connectionId),
					eq(mcpConnections.oauthState, oauthState),
				),
			);
	}

	async saveTokens(
		connectionId: string,
		input: ConnectionTokensInput,
	): Promise<void> {
		const [accessToken, refreshToken] = await Promise.all([
			encryptToken(input.accessToken),
			input.refreshToken === null ? null : encryptToken(input.refreshToken),
		]);

		await this.db
			.update(mcpConnections)
			.set({
				accessToken,
				accessTokenExpiresAt: input.accessTokenExpiresAt,
				codeVerifier: null,
				connectedAt: new Date(),
				oauthState: null,
				refreshToken,
				returnUrl: null,
				scope: input.scope,
				updatedAt: new Date(),
			})
			.where(eq(mcpConnections.id, connectionId));
	}

	async updateTokensIfRefreshTokenMatches(
		connectionId: string,
		expectedEncryptedRefreshToken: string,
		input: RefreshedConnectionTokensInput,
	): Promise<boolean> {
		const [accessToken, refreshToken] = await Promise.all([
			encryptToken(input.accessToken),
			encryptToken(input.refreshToken),
		]);
		const [row] = await this.db
			.update(mcpConnections)
			.set({
				accessToken,
				accessTokenExpiresAt: input.accessTokenExpiresAt,
				refreshToken,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(mcpConnections.id, connectionId),
					eq(mcpConnections.refreshToken, expectedEncryptedRefreshToken),
				),
			)
			.returning({ id: mcpConnections.id });

		return Boolean(row);
	}

	async clearRefreshTokenIfMatches(
		connectionId: string,
		expectedEncryptedRefreshToken: string,
	): Promise<boolean> {
		const [row] = await this.db
			.update(mcpConnections)
			.set({
				refreshToken: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(mcpConnections.id, connectionId),
					eq(mcpConnections.refreshToken, expectedEncryptedRefreshToken),
				),
			)
			.returning({ id: mcpConnections.id });

		return Boolean(row);
	}

	async clearPendingState(
		connectionId: string,
		options: ClearPendingStateOptions = {},
	): Promise<void> {
		await this.db
			.update(mcpConnections)
			.set({
				...(options.clearClientInfo ? { clientInfo: null } : {}),
				codeVerifier: null,
				oauthState: null,
				returnUrl: null,
				updatedAt: new Date(),
			})
			.where(eq(mcpConnections.id, connectionId));
	}

	async deleteByUserAndConnector(
		userId: string,
		connectorId: string,
	): Promise<void> {
		await this.db
			.delete(mcpConnections)
			.where(
				and(
					eq(mcpConnections.userId, userId),
					eq(mcpConnections.connectorId, connectorId),
				),
			);
	}
}
