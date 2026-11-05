/**
 * Pure helpers of the coding-agents pages. They read the signed OAuth query and the URLs of an OAuth client.
 * The login bridge, the consent page, and the connected-agents list call them. No React, no network.
 * A client chooses every input here, so each helper accepts a malformed value.
 */
import { LOOPBACK_HOSTNAMES, mcpConsentScopes } from "@wandit/contracts";
import { z } from "zod";

/** Path of the login bridge. `@wandit/auth` sends the browser here as the `loginPage` of the OAuth provider. */
export const OAUTH_AUTHORIZE_PAGE_PATH = "/oauth/authorize";

/** The scopes that the pages can name in plain words: the list that `@wandit/auth` registers. */
const consentScopeSchema = z.enum(mcpConsentScopes);

/** One scope that the pages can name in plain words. */
export type ConsentScope = z.infer<typeof consentScopeSchema>;

/** One requested scope: a known scope, or the raw text of a scope that this build does not know. */
export type RequestedScope =
	| { kind: "known"; scope: ConsentScope }
	| { kind: "unknown"; name: string };

/**
 * Splits an OAuth `scope` value (space-separated, RFC 6749 section 3.3) into the scopes to show.
 * A repeated scope shows once. An unknown scope keeps its raw text, so the page can warn about it.
 */
export function parseRequestedScopes(scope: string): RequestedScope[] {
	const names = [...new Set(scope.split(" ").filter(Boolean))];
	return names.map((name) => {
		const parsed = consentScopeSchema.safeParse(name);
		return parsed.success
			? { kind: "known", scope: parsed.data }
			: { kind: "unknown", name };
	});
}

/** One address that the pages show for a client. `kind` tells the label: the app id, or the return address. */
export type ClientAddress = {
	kind: "client_id" | "redirect";
	/** Scheme and host, for example `https://claude.ai` or `cursor://anysphere.cursor-retrieval`. */
	address: string;
	/** True for a scheme that is not http or https, like `cursor:`. The system then opens an app on this computer. */
	opensLocalApp: boolean;
};

/** The parsed URL, or null when the text is not a URL. Safari 16 has no `URL.canParse`, so this uses `new URL`. */
function parseUrl(text: string, base?: string): URL | null {
	try {
		return new URL(text, base);
	} catch (error) {
		// new URL throws a TypeError for text that is not a URL.
		if (error instanceof TypeError) return null;
		throw error;
	}
}

/** The address of one URL: its scheme and host. A custom scheme (`cursor://`) has the origin "null", so this builds the text. */
function toClientAddress(kind: ClientAddress["kind"], url: URL): ClientAddress {
	return {
		kind,
		address: url.host ? `${url.protocol}//${url.host}` : url.protocol,
		opensLocalApp: url.protocol !== "http:" && url.protocol !== "https:",
	};
}

/**
 * The addresses that name a client on the consent page and in the agent list.
 * A CIMD client id is an https URL that the API fetched, so its host names the app.
 * The redirect URI shows where the code goes. A CIMD document picks it, so it can be on another host.
 * @param redirectUri The `redirect_uri` of the signed query, or null when the caller has none (the agent list).
 * @returns The client id address first, then the redirect address. Empty when no value is a usable URL.
 */
export function clientAddresses(
	clientId: string,
	redirectUri: string | null,
): ClientAddress[] {
	const idUrl = parseUrl(clientId);
	// CIMD accepts only https ids. Another scheme is not a fetched identity, so it names nothing.
	const cimdUrl = idUrl?.protocol === "https:" ? idUrl : null;
	const addresses = cimdUrl ? [toClientAddress("client_id", cimdUrl)] : [];
	const redirectUrl = redirectUri === null ? null : parseUrl(redirectUri);
	if (redirectUrl === null) {
		return addresses;
	}
	// The code stays on the app origin or on a loopback port of this computer. The app address then names the receiver.
	const isRedirectToClientId =
		cimdUrl !== null &&
		(redirectUrl.origin === cimdUrl.origin ||
			(redirectUrl.protocol === "http:" &&
				LOOPBACK_HOSTNAMES.has(redirectUrl.hostname)));
	return isRedirectToClientId
		? addresses
		: [...addresses, toClientAddress("redirect", redirectUrl)];
}

// Better Auth refuses these schemes for a redirect (`isSafeUrlScheme`). They run code instead of opening a page.
const SCRIPT_URL_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:"]);

/**
 * Parses the `url` of an OAuth answer of the API (`{ redirect: true, url }`) before the page navigates to it.
 * A relative URL resolves against the API origin, because the API wrote it.
 * @returns null for an unparsable URL or a script scheme. The page then shows the invalid-request state.
 */
export function parseOAuthRedirect(url: string, apiOrigin: string): URL | null {
	const parsed = parseUrl(url, apiOrigin);
	return parsed === null || SCRIPT_URL_PROTOCOLS.has(parsed.protocol)
		? null
		: parsed;
}

/**
 * The signed part of an OAuth page query, without "?": `sig`, `ba_param`, and each name that `ba_param` lists.
 * It copies `buildSignedOAuthQuery` of `@better-auth/oauth-provider` 1.7.16. The API refuses a query with an unsigned param.
 * Returns null without `sig` or `ba_param`: the API did not send the browser here.
 */
export function readSignedOAuthQuery(search: string): string | null {
	const params = new URLSearchParams(search);
	const signedNames = new Set(params.getAll("ba_param"));
	if (!params.has("sig") || signedNames.size === 0) {
		return null;
	}
	const signedParams = new URLSearchParams();
	for (const [name, value] of params) {
		if (name === "sig" || name === "ba_param" || signedNames.has(name)) {
			signedParams.append(name, value);
		}
	}
	return signedParams.toString();
}
