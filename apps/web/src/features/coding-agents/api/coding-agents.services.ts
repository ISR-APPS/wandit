/**
 * HTTP calls of the coding-agents feature to the OAuth endpoints of Better Auth on the API.
 * The pages, queries, and mutations of this feature call these. Each answer goes through zod.
 * The `@better-auth/oauth-provider` plugin serves the paths. They exist only when the API runs V2.
 */
import {
	oauthConsentListSchema,
	oauthConsentResultSchema,
	oauthPublicClientSchema,
} from "@wandit/contracts";
import type { z } from "zod";

import { apiClient, isApiClientError } from "@/lib/api-client";

// These calls use apiClient, not authClient. The auth client follows a `{ redirect, url }` answer by itself.
// The pages must check the URL first. apiClient keeps an `/api/` path as it is.
const OAUTH_PATHS = {
	continue: "/api/auth/oauth2/continue",
	consent: "/api/auth/oauth2/consent",
	publicClient: "/api/auth/oauth2/public-client",
	consents: "/api/auth/oauth2/get-consents",
	deleteConsent: "/api/auth/oauth2/delete-consent",
} as const;

/** One connected coding agent: a consent row plus the client name for the list. */
export type ConnectedAgent = z.infer<typeof oauthConsentListSchema>[number] & {
	/** Name that the client gave itself. Undefined when it gave none or the API no longer knows the client. */
	clientName: string | undefined;
};

/**
 * True when the API refused the OAuth request itself.
 * A 400 means an expired or changed signed query. A 404 means an unknown or disabled client.
 * A 401 opens the sign-in modal instead (apiClient).
 */
export function isRefusedOAuthRequest(error: unknown): boolean {
	return (
		isApiClientError(error) &&
		(error.statusCode === 400 || error.statusCode === 404)
	);
}

/**
 * Resumes the authorization after the sign-in and onboarding gates, with the plugin endpoint `/oauth2/continue`.
 * The API checks the signature of `signedQuery`, then runs authorize again. Wandit forces the consent page there.
 * `postLogin` is the plugin resume flag. No post-login page is configured, so it only runs authorize again.
 * @returns The next URL. It is the consent page, or the client redirect URI with an error.
 */
export async function continueAuthorization(
	signedQuery: string,
): Promise<string> {
	const data = await apiClient.post<unknown>(OAUTH_PATHS.continue, {
		oauth_query: signedQuery,
		postLogin: true,
	});
	return oauthConsentResultSchema.parse(data).url;
}

/**
 * Sends the Allow or Deny choice of the consent page to `/oauth2/consent`. The API checks the signature of `signedQuery`.
 * @returns The client redirect URI, with `code` on Allow and `error=access_denied` on Deny.
 */
export async function submitConsent(input: {
	/** The consent page query, as the API signed it. */
	signedQuery: string;
	/** True for Allow. Allow grants every requested scope. */
	accept: boolean;
}): Promise<string> {
	const data = await apiClient.post<unknown>(OAUTH_PATHS.consent, {
		accept: input.accept,
		oauth_query: input.signedQuery,
	});
	return oauthConsentResultSchema.parse(data).url;
}

/** Loads the public fields of one OAuth client. Answers 404 for an unknown or disabled client. */
export async function getPublicClient(clientId: string) {
	const data = await apiClient.get<unknown>(OAUTH_PATHS.publicClient, {
		query: { client_id: clientId },
	});
	return oauthPublicClientSchema.parse(data);
}

/** Lists the coding agents of the signed-in user, with the name of each client. One failed name request fails the list. */
export async function listConnectedAgents(): Promise<ConnectedAgent[]> {
	const consents = oauthConsentListSchema.parse(
		await apiClient.get<unknown>(OAUTH_PATHS.consents),
	);
	// LIMIT: one name request per agent, and a user connects a few agents. Upgrade: one API route with a join.
	return Promise.all(
		consents.map(async (consent) => {
			try {
				const client = await getPublicClient(consent.clientId);
				return { ...consent, clientName: client.client_name };
			} catch (error) {
				// A deleted or disabled client keeps its consent row. The row must stay listed, so the user can revoke it.
				if (isApiClientError(error) && error.statusCode === 404) {
					return { ...consent, clientName: undefined };
				}
				throw error;
			}
		}),
	);
}

/**
 * Revokes one coding agent: the `@wandit/auth` hook deletes its tokens, then the plugin deletes the consent.
 * The next MCP request of the agent fails at once.
 */
export async function revokeConnectedAgent(consentId: string): Promise<void> {
	await apiClient.post<unknown>(OAUTH_PATHS.deleteConsent, { id: consentId });
}
