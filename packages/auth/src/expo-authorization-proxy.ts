import { APIError } from "better-auth/api";

/**
 * Guards `GET /api/auth/expo-authorization-proxy`.
 * The `before` hook in index.ts calls `assertTrustedAuthorizationUrl` before the plugin handler.
 *
 * The @better-auth/expo plugin mounts this route so the native app can open
 * the Google consent page in the system browser: the proxy stores the OAuth
 * `state` in a signed cookie and redirects to `authorizationURL`.
 *
 * The native client always sends the exact URL `POST /sign-in/social`
 * returned, so the proxy may only forward to Google's authorization
 * endpoint for OUR client id with OUR callback. Anything else is rejected.
 *
 * This guard does not check `state`, so it does not stop state fixation.
 * Before 1.7.16, the plugin signed any `state` with the auth secret (GHSA-4wq4-2ppv-q3hg).
 * 1.7.16 signs only a `state` that Better Auth issued, also one issued to an attacker.
 * Signatures from before 1.7.16 stay valid until the secret rotates.
 */
export const EXPO_AUTHORIZATION_PROXY_PATH = "/expo-authorization-proxy";

export const GOOGLE_AUTHORIZATION_HOST = "accounts.google.com";

export const UNTRUSTED_AUTHORIZATION_URL_CODE = "UNTRUSTED_AUTHORIZATION_URL";

export type TrustedAuthorizationTarget = {
	/** GOOGLE_CLIENT_ID */
	googleClientId: string;
	/** Absolute URL Better Auth registered as the Google redirect_uri. */
	googleCallbackUrl: string;
};

export function isTrustedAuthorizationUrl(
	rawUrl: unknown,
	target: TrustedAuthorizationTarget,
): boolean {
	if (typeof rawUrl !== "string" || rawUrl.length === 0) {
		return false;
	}

	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return false;
	}

	if (url.protocol !== "https:" || url.hostname !== GOOGLE_AUTHORIZATION_HOST) {
		return false;
	}

	if (url.searchParams.get("client_id") !== target.googleClientId) {
		return false;
	}

	return url.searchParams.get("redirect_uri") === target.googleCallbackUrl;
}

export function assertTrustedAuthorizationUrl(
	rawUrl: unknown,
	target: TrustedAuthorizationTarget,
): void {
	if (!isTrustedAuthorizationUrl(rawUrl, target)) {
		throw APIError.from("BAD_REQUEST", {
			code: UNTRUSTED_AUTHORIZATION_URL_CODE,
			message:
				"authorizationURL must be the Google sign-in URL this API issued.",
		});
	}
}
