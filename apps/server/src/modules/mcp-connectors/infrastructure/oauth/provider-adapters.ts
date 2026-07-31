import { env } from "@wandit/env/server";

const REQUEST_TIMEOUT_MS = 15_000;

export type OAuthTokenResult = {
	accessToken: string;
	refreshToken: string | null;
	expiresIn: number | null;
	scope: string | null;
};

type OAuthCredentials = {
	clientId: string;
	clientSecret: string;
};

type AuthorizationParamsInput = {
	clientId: string;
	redirectUri: string;
	state: string;
};

type ExchangeInput = {
	code: string;
	credentials: OAuthCredentials;
	redirectUri: string;
	tokenUrl: string;
};

type FinalizeExchangeInput = {
	credentials: OAuthCredentials;
	token: OAuthTokenResult;
	tokenUrl: string;
};

export type PreregProviderAdapter = {
	authorizationParams?: (input: AuthorizationParamsInput) => URLSearchParams;
	credentials: () => OAuthCredentials | null;
	defaultTtlSeconds?: number;
	exchange?: (input: ExchangeInput) => Promise<OAuthTokenResult>;
	finalizeExchange?: (
		input: FinalizeExchangeInput,
	) => Promise<OAuthTokenResult>;
};

const providerAdapters: Record<string, PreregProviderAdapter> = {
	"meta-ads": {
		credentials: () => {
			if (!env.META_APP_ID || !env.META_APP_SECRET) {
				return null;
			}

			return {
				clientId: env.META_APP_ID,
				clientSecret: env.META_APP_SECRET,
			};
		},
		defaultTtlSeconds: 5_184_000,
		exchange: ({ code, credentials, redirectUri, tokenUrl }) =>
			requestMetaToken(tokenUrl, {
				client_id: credentials.clientId,
				client_secret: credentials.clientSecret,
				redirect_uri: redirectUri,
				code,
			}),
		finalizeExchange: async ({ credentials, token, tokenUrl }) => {
			try {
				return await requestMetaToken(tokenUrl, {
					grant_type: "fb_exchange_token",
					client_id: credentials.clientId,
					client_secret: credentials.clientSecret,
					fb_exchange_token: token.accessToken,
				});
			} catch {
				return token;
			}
		},
	},
};

export function getProviderAdapter(
	slug: string,
): PreregProviderAdapter | undefined {
	return providerAdapters[slug];
}

async function requestMetaToken(
	tokenUrl: string,
	parameters: Record<string, string>,
): Promise<OAuthTokenResult> {
	const url = new URL(tokenUrl);

	for (const [name, value] of Object.entries(parameters)) {
		url.searchParams.set(name, value);
	}

	const response = await fetch(url.toString(), {
		method: "GET",
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error(`Meta OAuth token exchange failed (${response.status})`);
	}

	const body: unknown = await response.json().catch(() => null);
	if (
		!isRecord(body) ||
		typeof body.access_token !== "string" ||
		body.access_token === ""
	) {
		throw new Error("Meta OAuth token exchange returned an invalid response");
	}

	return {
		accessToken: body.access_token,
		expiresIn: readExpiresIn(body.expires_in),
		refreshToken: null,
		scope: null,
	};
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
