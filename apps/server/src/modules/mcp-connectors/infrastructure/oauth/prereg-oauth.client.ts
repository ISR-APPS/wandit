import { Injectable } from "@nestjs/common";

import type { McpConnectorRow } from "../persistence/mcp-connectors.repository";
import type {
	OAuthTokenResult,
	PreregProviderAdapter,
} from "./provider-adapters";

const REQUEST_TIMEOUT_MS = 15_000;

type PreregConnector = Pick<
	McpConnectorRow,
	"authorizationUrl" | "scopes" | "tokenUrl"
>;

@Injectable()
export class PreregOauthClient {
	buildAuthorizeUrl(
		connector: PreregConnector,
		adapter: PreregProviderAdapter,
		state: string,
		redirectUri: string,
	): string {
		if (!connector.authorizationUrl) {
			throw new Error("OAuth connector is missing its authorization URL");
		}

		const credentials = requireCredentials(adapter);
		const parameters = adapter.authorizationParams
			? adapter.authorizationParams({
					clientId: credentials.clientId,
					redirectUri,
					state,
				})
			: standardAuthorizationParameters(
					credentials.clientId,
					state,
					redirectUri,
					connector.scopes,
				);
		const authorizeUrl = new URL(connector.authorizationUrl);

		for (const [name, value] of parameters) {
			authorizeUrl.searchParams.set(name, value);
		}

		return authorizeUrl.toString();
	}

	async exchangeCode(
		connector: PreregConnector,
		adapter: PreregProviderAdapter,
		code: string,
		redirectUri: string,
	): Promise<OAuthTokenResult> {
		if (!connector.tokenUrl) {
			throw new Error("OAuth connector is missing its token URL");
		}

		const credentials = requireCredentials(adapter);
		const input = {
			code,
			credentials,
			redirectUri,
			tokenUrl: connector.tokenUrl,
		};
		let token = adapter.exchange
			? await adapter.exchange(input)
			: await exchangeStandardCode(input);

		if (adapter.finalizeExchange) {
			token = await adapter.finalizeExchange({
				credentials,
				token,
				tokenUrl: connector.tokenUrl,
			});
		}

		return {
			...token,
			expiresIn: token.expiresIn ?? adapter.defaultTtlSeconds ?? null,
		};
	}
}

async function exchangeStandardCode({
	code,
	credentials,
	redirectUri,
	tokenUrl,
}: {
	code: string;
	credentials: { clientId: string; clientSecret: string };
	redirectUri: string;
	tokenUrl: string;
}): Promise<OAuthTokenResult> {
	const response = await fetch(tokenUrl, {
		body: new URLSearchParams({
			client_id: credentials.clientId,
			client_secret: credentials.clientSecret,
			code,
			grant_type: "authorization_code",
			redirect_uri: redirectUri,
		}),
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		method: "POST",
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error(`OAuth token exchange failed (${response.status})`);
	}

	const body: unknown = await response.json().catch(() => null);
	if (!isRecord(body) || typeof body.access_token !== "string") {
		throw new Error("OAuth token exchange returned an invalid response");
	}

	return {
		accessToken: body.access_token,
		expiresIn: readExpiresIn(body.expires_in),
		refreshToken:
			typeof body.refresh_token === "string" ? body.refresh_token : null,
		scope: typeof body.scope === "string" ? body.scope : null,
	};
}

function standardAuthorizationParameters(
	clientId: string,
	state: string,
	redirectUri: string,
	scopes: string | null,
): URLSearchParams {
	const parameters = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		state,
	});

	if (scopes) {
		parameters.set("scope", scopes);
	}

	return parameters;
}

function requireCredentials(adapter: PreregProviderAdapter): {
	clientId: string;
	clientSecret: string;
} {
	const credentials = adapter.credentials();
	if (!credentials) {
		throw new Error("OAuth connector is not configured");
	}

	return credentials;
}

function readExpiresIn(value: unknown): number | null {
	const expiresIn =
		typeof value === "string" && value !== "" ? Number(value) : value;
	return typeof expiresIn === "number" &&
		Number.isFinite(expiresIn) &&
		expiresIn >= 0
		? expiresIn
		: null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
