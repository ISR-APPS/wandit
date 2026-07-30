import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";

import {
	McpDcrClient,
	McpRefreshRejectedError,
} from "../../infrastructure/oauth/mcp-dcr.client";
import {
	type McpConnectionRow,
	McpConnectionsRepository,
} from "../../infrastructure/persistence/mcp-connections.repository";
import {
	type McpConnectorRow,
	McpConnectorsRepository,
} from "../../infrastructure/persistence/mcp-connectors.repository";
import { decryptToken } from "../../infrastructure/persistence/token-crypto";

const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30_000;

@Injectable()
export class McpConnectionsService {
	private readonly refreshes = new Map<string, Promise<string>>();

	constructor(
		@Inject(McpConnectorsRepository)
		private readonly connectorsRepository: McpConnectorsRepository,
		@Inject(McpConnectionsRepository)
		private readonly connectionsRepository: McpConnectionsRepository,
		@Inject(McpDcrClient) private readonly dcrClient: McpDcrClient,
	) {}

	async getValidAccessToken(userId: string, slug: string): Promise<string> {
		const connector = await this.connectorsRepository.findEnabledBySlug(slug);

		if (!connector) {
			throw new NotFoundException("Connector not found");
		}

		const connection = await this.connectionsRepository.findByUserAndConnector(
			userId,
			connector.id,
		);

		if (connection?.accessToken && this.hasUsableAccessToken(connection)) {
			return decryptToken(connection.accessToken);
		}

		if (!connection?.refreshToken) {
			throw this.reconnectRequired(connector);
		}

		const expectedEncryptedRefreshToken = connection.refreshToken;
		const inFlight = this.refreshes.get(connection.id);

		if (inFlight) {
			return inFlight;
		}

		const refresh = this.refreshAccessToken(
			userId,
			connector,
			connection,
			expectedEncryptedRefreshToken,
		);
		this.refreshes.set(connection.id, refresh);

		try {
			return await refresh;
		} finally {
			if (this.refreshes.get(connection.id) === refresh) {
				this.refreshes.delete(connection.id);
			}
		}
	}

	private async refreshAccessToken(
		userId: string,
		connector: McpConnectorRow,
		connection: McpConnectionRow,
		expectedEncryptedRefreshToken: string,
	): Promise<string> {
		const refreshToken = await decryptToken(expectedEncryptedRefreshToken);
		let tokens: Awaited<ReturnType<McpDcrClient["refresh"]>>;

		try {
			tokens = await this.dcrClient.refresh(
				connector,
				connection.clientInfo,
				refreshToken,
			);
		} catch (error) {
			if (!(error instanceof McpRefreshRejectedError)) {
				throw error;
			}

			const cleared =
				await this.connectionsRepository.clearRefreshTokenIfMatches(
					connection.id,
					expectedEncryptedRefreshToken,
				);

			if (!cleared) {
				return this.readLatestAccessToken(userId, connector);
			}

			throw this.reconnectRequired(connector);
		}

		const updated =
			await this.connectionsRepository.updateTokensIfRefreshTokenMatches(
				connection.id,
				expectedEncryptedRefreshToken,
				{
					accessToken: tokens.accessToken,
					accessTokenExpiresAt:
						tokens.expiresIn === null
							? null
							: new Date(Date.now() + tokens.expiresIn * 1_000),
					refreshToken: tokens.refreshToken ?? refreshToken,
				},
			);

		if (!updated) {
			return this.readLatestAccessToken(userId, connector);
		}

		return tokens.accessToken;
	}

	private async readLatestAccessToken(
		userId: string,
		connector: McpConnectorRow,
	): Promise<string> {
		const latest = await this.connectionsRepository.findByUserAndConnector(
			userId,
			connector.id,
		);

		if (!latest?.accessToken || !this.hasUsableAccessToken(latest)) {
			throw this.reconnectRequired(connector);
		}

		return decryptToken(latest.accessToken);
	}

	private hasUsableAccessToken(
		connection: Pick<McpConnectionRow, "accessToken" | "accessTokenExpiresAt">,
	): boolean {
		return Boolean(
			connection.accessToken &&
				(!connection.accessTokenExpiresAt ||
					connection.accessTokenExpiresAt.getTime() >
						Date.now() + ACCESS_TOKEN_EXPIRY_SKEW_MS),
		);
	}

	private reconnectRequired(connector: McpConnectorRow): ConflictException {
		return new ConflictException(
			`Could not get ${connector.name} access — reconnect ${connector.name} and try again`,
		);
	}
}
