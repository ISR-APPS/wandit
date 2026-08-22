import { randomBytes } from "node:crypto";
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import {
	MCP_CODE_PARAM,
	MCP_CONNECTED_PARAM,
	MCP_CONNECTOR_PARAM,
	MCP_ERROR_PARAM,
	MCP_STATE_PARAM,
	type McpConnectCompleteRequest,
	type McpConnectorListItem,
	type McpConnectStartResponse,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { FastifyRequest } from "fastify";

import { toWebHeaders } from "../../../../infrastructure/http/fastify-headers";
import { AUTH_INSTANCE } from "../../../auth";
import { deriveStatus } from "../../domain/connection-status";
import { McpDcrClient } from "../../infrastructure/oauth/mcp-dcr.client";
import { PreregOauthClient } from "../../infrastructure/oauth/prereg-oauth.client";
import {
	getProviderAdapter,
	type OAuthTokenResult,
	type PreregProviderAdapter,
} from "../../infrastructure/oauth/provider-adapters";
import {
	type McpConnectionRow,
	McpConnectionsRepository,
} from "../../infrastructure/persistence/mcp-connections.repository";
import {
	type McpConnectorRow,
	McpConnectorsRepository,
} from "../../infrastructure/persistence/mcp-connectors.repository";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1_000;

export type McpCallbackQuery = {
	code?: string;
	error?: string;
	state?: string;
};

@Injectable()
export class McpOauthService {
	private readonly logger = new Logger(McpOauthService.name);

	constructor(
		@Inject(AUTH_INSTANCE) private readonly auth: Auth,
		@Inject(McpConnectorsRepository)
		private readonly connectorsRepository: McpConnectorsRepository,
		@Inject(McpConnectionsRepository)
		private readonly connectionsRepository: McpConnectionsRepository,
		@Inject(McpDcrClient) private readonly dcrClient: McpDcrClient,
		@Inject(PreregOauthClient)
		private readonly preregClient: PreregOauthClient,
	) {}

	async list(userId: string): Promise<McpConnectorListItem[]> {
		const [connectors, connections] = await Promise.all([
			this.connectorsRepository.listEnabled(),
			this.connectionsRepository.listByUser(userId),
		]);
		const connectionsByConnectorId = new Map(
			connections.map((connection) => [connection.connectorId, connection]),
		);

		return connectors.map((connector) =>
			this.toListItem(connector, connectionsByConnectorId.get(connector.id)),
		);
	}

	async disconnect(
		userId: string,
		slug: string,
	): Promise<McpConnectorListItem> {
		const connector = await this.connectorsRepository.findEnabledBySlug(slug);

		if (!connector) {
			throw new NotFoundException("Connector not found");
		}

		await this.connectionsRepository.deleteByUserAndConnector(
			userId,
			connector.id,
		);

		return this.toListItem(connector);
	}

	async startConnect(
		userId: string,
		slug: string,
		returnUrl: string,
	): Promise<McpConnectStartResponse> {
		const connector = await this.connectorsRepository.findEnabledBySlug(slug);

		if (!connector) {
			throw new NotFoundException("Connector not found");
		}

		this.assertAllowedReturnUrl(returnUrl);

		const state = randomBytes(32).toString("base64url");
		const connection = await this.connectionsRepository.upsertPending(
			userId,
			connector.id,
			{
				codeVerifier: null,
				oauthState: state,
				returnUrl,
			},
		);
		const redirectUri = this.callbackUrl();

		if (connector.authKind === "oauth_prereg") {
			const adapter = this.requirePreregAdapter(connector);

			return {
				authorizeUrl: this.preregClient.buildAuthorizeUrl(
					connector,
					adapter,
					state,
					redirectUri,
				),
			};
		}

		const authorization = await this.dcrClient.start(
			connector,
			connection.clientInfo,
			state,
			redirectUri,
		);
		await this.connectionsRepository.saveClientInfoAndCodeVerifier(
			connection.id,
			state,
			{
				clientInfo: authorization.clientInfo,
				codeVerifier: authorization.codeVerifier,
			},
		);

		return { authorizeUrl: authorization.authorizeUrl };
	}

	async handleCallback(
		query: McpCallbackQuery,
		requestHeaders: FastifyRequest["headers"],
	): Promise<string> {
		if (!query.state) {
			return this.redirectUrl(
				new URL("/connect/complete", env.CORS_ORIGIN).toString(),
				{
					[MCP_ERROR_PARAM]: "invalid_state",
				},
			);
		}

		const pending = await this.connectionsRepository.findByState(query.state);

		if (!pending) {
			return this.redirectUrl(
				new URL("/connect/complete", env.CORS_ORIGIN).toString(),
				{
					[MCP_ERROR_PARAM]: "invalid_state",
				},
			);
		}

		const isStale =
			pending.updatedAt.getTime() < Date.now() - OAUTH_STATE_TTL_MS;

		if (isStale) {
			await this.connectionsRepository.clearPendingState(pending.id);
			return this.redirectUrl(pending.returnUrl, {
				[MCP_ERROR_PARAM]: "invalid_state",
			});
		}

		const isMobileReturn = isMobileReturnUrl(pending.returnUrl);

		if (!isMobileReturn) {
			// Web flow: the callback rides the user's browser, so its session must
			// belong to whoever started the connect. A mobile in-app auth browser
			// has no app session — the binding happens in completeConnect instead.
			const sessionUserId = await this.getSessionUserId(requestHeaders);

			if (sessionUserId !== pending.userId) {
				await this.connectionsRepository.clearPendingState(pending.id);
				return this.redirectUrl(pending.returnUrl, {
					[MCP_ERROR_PARAM]: "invalid_state",
				});
			}
		}

		if (query.error) {
			await this.connectionsRepository.clearPendingState(pending.id);
			return this.redirectUrl(pending.returnUrl, {
				[MCP_CONNECTOR_PARAM]: pending.connector.slug,
				[MCP_ERROR_PARAM]: "access_denied",
			});
		}

		const code = query.code;

		if (!code) {
			await this.clearAfterExchangeFailure(pending);
			return this.redirectUrl(pending.returnUrl, {
				[MCP_CONNECTOR_PARAM]: pending.connector.slug,
				[MCP_ERROR_PARAM]: "exchange_failed",
			});
		}

		if (isMobileReturn) {
			// No token exchange here: hand code+state back to the app, which
			// finishes through the session-authenticated POST /complete — that is
			// where completer-must-equal-starter is enforced for mobile. The
			// pending state stays intact for that call to consume.
			return this.redirectUrl(pending.returnUrl, {
				[MCP_CONNECTOR_PARAM]: pending.connector.slug,
				[MCP_STATE_PARAM]: query.state ?? "",
				[MCP_CODE_PARAM]: code,
			});
		}

		try {
			await this.exchangeAndStoreTokens(pending, code);

			return this.redirectUrl(pending.returnUrl, {
				[MCP_CONNECTED_PARAM]: pending.connector.slug,
			});
		} catch (error) {
			this.logger.warn(
				`OAuth exchange failed for MCP connector ${pending.connector.slug}: ${errorName(error)}`,
			);
			await this.clearAfterExchangeFailure(pending);

			return this.redirectUrl(pending.returnUrl, {
				[MCP_CONNECTOR_PARAM]: pending.connector.slug,
				[MCP_ERROR_PARAM]: "exchange_failed",
			});
		}
	}

	/** Mobile twin of the callback's exchange step: the app posts back the
	    code+state it received via its deep link, authenticated with its own
	    session — which must belong to the user who started the connect. */
	async completeConnect(
		userId: string,
		body: McpConnectCompleteRequest,
	): Promise<McpConnectorListItem> {
		const pending = await this.connectionsRepository.findByState(body.state);

		if (!pending) {
			throw new BadRequestException(
				"This connection request is no longer valid",
			);
		}

		// A wrong-user completion rejects WITHOUT clearing: wiping the row here
		// would let any authenticated caller cancel the real owner's in-flight
		// connect. Staleness clears as before (the state is dead either way).
		if (pending.userId !== userId) {
			throw new BadRequestException(
				"This connection request is no longer valid",
			);
		}

		const isStale =
			pending.updatedAt.getTime() < Date.now() - OAUTH_STATE_TTL_MS;

		if (isStale) {
			// Conditional on the state value: an unconditional id-clear here
			// could wipe a FRESH attempt that reused this row between the read
			// above and this write.
			await this.connectionsRepository.claimPendingState(
				pending.id,
				body.state,
			);
			throw new BadRequestException(
				"This connection request is no longer valid",
			);
		}

		// Claim the state ATOMICALLY before exchanging (clear only while the
		// row still carries this exact state): of two concurrent duplicate
		// completions (double deep-link delivery, replayed request) exactly
		// one wins the conditional write; the loser stops here instead of
		// racing the exchange or wiping the winner's clientInfo via its
		// failure path. The in-memory row still carries the connector,
		// clientInfo and codeVerifier the exchange needs.
		const claimed = await this.connectionsRepository.claimPendingState(
			pending.id,
			body.state,
		);
		if (!claimed) {
			throw new BadRequestException(
				"This connection request is no longer valid",
			);
		}

		try {
			await this.exchangeAndStoreTokens(pending, body.code);
		} catch (error) {
			this.logger.warn(
				`OAuth exchange failed for MCP connector ${pending.connector.slug}: ${errorName(error)}`,
			);
			await this.clearAfterExchangeFailure(pending);
			throw new BadRequestException("OAuth exchange failed");
		}

		const connection = await this.connectionsRepository.findByUserAndConnector(
			userId,
			pending.connector.id,
		);

		return this.toListItem(pending.connector, connection ?? undefined);
	}

	private async exchangeAndStoreTokens(
		pending: NonNullable<
			Awaited<ReturnType<McpConnectionsRepository["findByState"]>>
		>,
		code: string,
	): Promise<void> {
		const tokens = await this.exchangeCode(
			pending.connector,
			pending.clientInfo,
			code,
			pending.codeVerifier,
		);
		const now = new Date();

		await this.connectionsRepository.saveTokens(pending.id, {
			accessToken: tokens.accessToken,
			accessTokenExpiresAt:
				tokens.expiresIn === null
					? null
					: new Date(now.getTime() + tokens.expiresIn * 1_000),
			refreshToken: tokens.refreshToken,
			scope: tokens.scope,
		});
	}

	private async clearAfterExchangeFailure(pending: {
		id: string;
		connector: McpConnectorRow;
	}): Promise<void> {
		if (pending.connector.authKind === "mcp_dcr") {
			await this.connectionsRepository.clearPendingState(pending.id, {
				clearClientInfo: true,
			});
		} else {
			await this.connectionsRepository.clearPendingState(pending.id);
		}
	}

	private async exchangeCode(
		connector: McpConnectorRow,
		clientInfo: unknown,
		code: string,
		codeVerifier: string | null,
	): Promise<OAuthTokenResult> {
		const redirectUri = this.callbackUrl();

		if (connector.authKind === "oauth_prereg") {
			return this.preregClient.exchangeCode(
				connector,
				this.requirePreregAdapter(connector),
				code,
				redirectUri,
			);
		}

		if (!codeVerifier) {
			throw new Error("MCP OAuth callback is missing its PKCE verifier");
		}

		return this.dcrClient.exchangeCode(
			connector,
			clientInfo,
			code,
			codeVerifier,
			redirectUri,
		);
	}

	private requirePreregAdapter(
		connector: McpConnectorRow,
	): PreregProviderAdapter {
		const adapter = getProviderAdapter(connector.slug);

		if (!adapter?.credentials()) {
			throw new ServiceUnavailableException(
				`${connector.name} OAuth is not configured`,
			);
		}

		return adapter;
	}

	private assertAllowedReturnUrl(returnUrl: string): void {
		if (isMobileReturnUrl(returnUrl)) {
			return;
		}
		if (new URL(returnUrl).origin !== new URL(env.CORS_ORIGIN).origin) {
			throw new BadRequestException(
				"returnUrl must use the web app origin or the mobile app scheme",
			);
		}
	}

	private callbackUrl(): string {
		return new URL(
			"/api/v1/mcp/connectors/callback",
			env.BETTER_AUTH_URL,
		).toString();
	}

	private async getSessionUserId(
		requestHeaders: FastifyRequest["headers"],
	): Promise<string | null> {
		try {
			const session = await this.auth.api.getSession({
				headers: toWebHeaders(requestHeaders),
			});

			return session?.user.id ?? null;
		} catch {
			return null;
		}
	}

	private redirectUrl(
		returnUrl: string | null | undefined,
		params: Record<string, string>,
	): string {
		const redirect = new URL(this.safeReturnUrl(returnUrl));

		redirect.searchParams.delete(MCP_CONNECTED_PARAM);
		redirect.searchParams.delete(MCP_CONNECTOR_PARAM);
		redirect.searchParams.delete(MCP_ERROR_PARAM);

		for (const [key, value] of Object.entries(params)) {
			redirect.searchParams.set(key, value);
		}

		return redirect.toString();
	}

	private safeReturnUrl(returnUrl: string | null | undefined): string {
		if (!returnUrl) {
			return env.CORS_ORIGIN;
		}

		try {
			if (isMobileReturnUrl(returnUrl)) {
				return returnUrl;
			}
			return new URL(returnUrl).origin === new URL(env.CORS_ORIGIN).origin
				? returnUrl
				: env.CORS_ORIGIN;
		} catch {
			return env.CORS_ORIGIN;
		}
	}

	private toListItem(
		connector: McpConnectorRow,
		connection?: McpConnectionRow,
	): McpConnectorListItem {
		return {
			// Pre-registered providers need app credentials on the server; DCR
			// connectors register themselves. Unavailable = "Coming soon" in
			// the UI, and startConnect would refuse with 503 anyway.
			available:
				connector.authKind !== "oauth_prereg" ||
				getProviderAdapter(connector.slug)?.credentials() != null,
			connectedAt: connection?.connectedAt?.toISOString() ?? null,
			description: connector.description,
			iconUrl: connector.iconUrl,
			name: connector.name,
			slug: connector.slug,
			status: deriveStatus(connection),
		};
	}
}

function errorName(error: unknown): string {
	return error instanceof Error ? error.name : "UnknownError";
}

/** Mirrors the Better Auth trustedOrigins mobile entries (packages/auth):
    the production scheme always; Expo Go dev links and the Metro web origin
    only OUTSIDE production. An exp:// deep link loads whatever bundle its
    host serves (attacker-controlled code in Expo Go), so forwarding the
    OAuth code to arbitrary exp hosts must stay a dev-only convenience —
    wandit: always opens the installed app, whose completeConnect call is
    then bound to the starter's user id. */
function isMobileReturnUrl(returnUrl: string | null | undefined): boolean {
	if (!returnUrl) {
		return false;
	}

	try {
		const url = new URL(returnUrl);
		if (url.protocol === "wandit:") {
			return true;
		}
		return (
			env.NODE_ENV !== "production" &&
			(url.protocol === "exp:" || url.origin === "http://localhost:8081")
		);
	} catch {
		return false;
	}
}
