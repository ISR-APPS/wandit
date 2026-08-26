import { APIError } from "better-auth/api";

/**
 * Guards `GET /api/auth/expo-authorization-proxy`.
 *
 * The @better-auth/expo plugin mounts this route so the native app can open
 * the Google consent page in the system browser: the proxy stores the OAuth
 * `state` in a signed cookie and redirects to `authorizationURL`. The plugin
 * only checks that the URL is https and not our own origin, which makes the
 * route an open redirect and, worse, lets an attacker plant a state cookie
 * of their choice in a victim's browser (state fixation -> login CSRF: the
 * victim ends up signed in to the attacker's account).
 *
 * The native client always sends the exact URL `POST /sign-in/social`
 * returned, so the proxy may only forward to Google's authorization
 * endpoint for OUR client id with OUR callback. Anything else is rejected.
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
