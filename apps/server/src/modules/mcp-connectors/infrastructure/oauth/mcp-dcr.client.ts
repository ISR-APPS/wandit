import {
	discoverAuthorizationServerMetadata,
	discoverOAuthProtectedResourceMetadata,
	exchangeAuthorization,
	refreshAuthorization,
	registerClient,
	startAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
	type OAuthClientInformationFull,
	OAuthClientInformationFullSchema,
	type OAuthProtectedResourceMetadata,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { Injectable } from "@nestjs/common";

import type { McpConnectorRow } from "../persistence/mcp-connectors.repository";
import { decryptToken } from "../persistence/token-crypto";
import type { OAuthTokenResult } from "./provider-adapters";

const REQUEST_TIMEOUT_MS = 15_000;
const REJECTED_REFRESH_ERROR_CODES = new Set([
	"invalid_client",
	"invalid_grant",
	"unauthorized_client",
]);

type DcrConnector = Pick<McpConnectorRow, "mcpServerUrl" | "scopes">;

export class McpRefreshRejectedError extends Error {
	constructor(cause: unknown) {
		super("MCP OAuth refresh was rejected", { cause });
		this.name = McpRefreshRejectedError.name;
	}
}

@Injectable()
export class McpDcrClient {
	async start(
		connector: DcrConnector,
		cachedClientInfo: unknown,
		state: string,
		redirectUri: string,
	): Promise<{
		authorizeUrl: string;
		clientInfo: OAuthClientInformationFull;
		codeVerifier: string;
	}> {
		const discovery = await this.discover(connector);
		const parsedCached =
			OAuthClientInformationFullSchema.safeParse(cachedClientInfo);
		const cached = parsedCached.success
			? {
					...parsedCached.data,
					...(parsedCached.data.client_secret === undefined
						? {}
						: {
								client_secret: await decryptToken(
									parsedCached.data.client_secret,
								),
							}),
				}
			: undefined;
		const clientSecretExpiresAt = cached?.client_secret_expires_at;
		const hasExpiredClientSecret =
			clientSecretExpiresAt !== undefined &&
			clientSecretExpiresAt > 0 &&
			clientSecretExpiresAt <= Date.now() / 1_000;
		const clientInfo =
			cached?.redirect_uris.includes(redirectUri) && !hasExpiredClientSecret
				? cached
				: await registerClient(discovery.authorizationServerUrl, {
						clientMetadata: {
							client_name: "Wandit",
							grant_types: ["authorization_code", "refresh_token"],
							redirect_uris: [redirectUri],
							response_types: ["code"],
							token_endpoint_auth_method: "none",
						},
						fetchFn: fetchWithTimeout,
						metadata: discovery.metadata,
						scope: discovery.scope,
					});

		const authorization = await startAuthorization(
			discovery.authorizationServerUrl,
			{
				clientInformation: clientInfo,
				metadata: discovery.metadata,
				redirectUrl: redirectUri,
				resource: discovery.resource,
				scope: discovery.scope,
				state,
			},
		);

		return {
			authorizeUrl: authorization.authorizationUrl.toString(),
			clientInfo,
			codeVerifier: authorization.codeVerifier,
		};
	}

	async exchangeCode(
		connector: DcrConnector,
		storedClientInfo: unknown,
		code: string,
		codeVerifier: string,
		redirectUri: string,
	): Promise<OAuthTokenResult> {
		const stored = OAuthClientInformationFullSchema.parse(storedClientInfo);
		const clientInfo =
			stored.client_secret === undefined
				? stored
				: {
						...stored,
						client_secret: await decryptToken(stored.client_secret),
					};
		const discovery = await this.discover(connector);
		const tokens = await exchangeAuthorization(
			discovery.authorizationServerUrl,
			{
				authorizationCode: code,
				clientInformation: clientInfo,
				codeVerifier,
				fetchFn: fetchWithTimeout,
				metadata: discovery.metadata,
				redirectUri,
				resource: discovery.resource,
			},
		);

		return {
			accessToken: tokens.access_token,
			expiresIn: tokens.expires_in ?? null,
			refreshToken: tokens.refresh_token ?? null,
			scope: tokens.scope ?? null,
		};
	}

	async refresh(
		connector: DcrConnector,
		storedClientInfo: unknown,
		refreshToken: string,
	): Promise<OAuthTokenResult> {
		const stored = OAuthClientInformationFullSchema.parse(storedClientInfo);
		const clientInfo =
			stored.client_secret === undefined
				? stored
				: {
						...stored,
						client_secret: await decryptToken(stored.client_secret),
					};
		const discovery = await this.discover(connector);
		let refreshWasRejected = false;
		let tokens: Awaited<ReturnType<typeof refreshAuthorization>>;

		try {
			tokens = await refreshAuthorization(discovery.authorizationServerUrl, {
				clientInformation: clientInfo,
				fetchFn: async (url, init) => {
					const response = await fetchWithTimeout(url, init);
					refreshWasRejected = await isRejectedRefreshResponse(response);
					return response;
				},
				metadata: discovery.metadata,
				refreshToken,
				resource: discovery.resource,
			});
		} catch (error) {
			if (refreshWasRejected) {
				throw new McpRefreshRejectedError(error);
			}

			throw error;
		}

		return {
			accessToken: tokens.access_token,
			expiresIn: tokens.expires_in ?? null,
			refreshToken: tokens.refresh_token ?? refreshToken,
			scope: tokens.scope ?? null,
		};
	}

	private async discover(connector: DcrConnector) {
		if (!connector.mcpServerUrl) {
			throw new Error("MCP connector is missing its server URL");
		}

		let resourceMetadata: OAuthProtectedResourceMetadata | undefined;

		try {
			resourceMetadata = await discoverOAuthProtectedResourceMetadata(
				connector.mcpServerUrl,
				undefined,
				fetchWithTimeout,
			);
		} catch {
			// Older MCP OAuth servers predate protected-resource metadata.
		}

		const authorizationServerUrl =
			resourceMetadata?.authorization_servers?.[0] ??
			new URL("/", connector.mcpServerUrl).toString();
		const metadata = await discoverAuthorizationServerMetadata(
			authorizationServerUrl,
			{ fetchFn: fetchWithTimeout },
		);

		return {
			authorizationServerUrl,
			metadata,
			resource: resourceMetadata
				? new URL(resourceMetadata.resource)
				: undefined,
			scope:
				connector.scopes ??
				resourceMetadata?.scopes_supported?.join(" ") ??
				undefined,
		};
	}
}

function fetchWithTimeout(
	url: string | URL,
	init?: RequestInit,
): Promise<Response> {
	return fetch(url, {
		...init,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
}

async function isRejectedRefreshResponse(response: Response): Promise<boolean> {
	if (response.status !== 400 && response.status !== 401) {
		return false;
	}

	try {
		const body: unknown = await response.clone().json();
		return (
			typeof body === "object" &&
			body !== null &&
			"error" in body &&
			typeof body.error === "string" &&
			REJECTED_REFRESH_ERROR_CODES.has(body.error)
		);
	} catch {
		return true;
	}
}
