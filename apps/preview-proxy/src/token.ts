/**
 * The token helpers of the preview proxy: read the preview cookie and
 * answer the `?wt=` exchange of a run host or a frame host.
 * Called by src/index.ts; reads the shared constants of @wandit/contracts.
 */
import { PREVIEW_COOKIE_NAME, PREVIEW_TOKEN_QUERY } from "@wandit/contracts";

import { securityHeaders } from "./headers";

/**
 * Reads the value of cookie `name` from a `Cookie` header. Returns null
 * when the pair is absent or has no `=`.
 */
export function readCookieValue(
	cookieHeader: string | null,
	name: string,
): string | null {
	if (cookieHeader === null) {
		return null;
	}
	for (const pair of cookieHeader.split(";")) {
		const trimmed = pair.trim();
		const eq = trimmed.indexOf("=");
		if (eq > 0 && trimmed.slice(0, eq) === name) {
			return trimmed.slice(eq + 1);
		}
	}
	return null;
}

/**
 * Answers a valid `?wt=` request. It stores the token in the `__Host-`
 * cookie and redirects (302) to the same URL without `wt`. So the token
 * does not stay in browser history or logs. The token cookie has no
 * `Domain` and no `Max-Age`: the `__Host-` rules need `Secure`, `Path=/`,
 * and no `Domain` (security.md 9.1). The token carries `exp`.
 * `Partitioned` (CHIPS) keys the cookie to the top-level site: the builder
 * in the frame, the preview host in a new tab.
 */
export function exchangeRedirect(
	url: URL,
	token: string,
	frameAncestors: string,
): Response {
	const response = redirectWithoutToken(url, frameAncestors);
	// Chrome keeps an old unpartitioned cookie next to the partitioned one and sends the old, stale one first.
	// readCookieValue reads the first match, so this header deletes the old cookie.
	// It comes first: a browser that keeps both cookies in one jar then still keeps the new token.
	response.headers.append(
		"set-cookie",
		`${PREVIEW_COOKIE_NAME}=; Secure; HttpOnly; SameSite=None; Path=/; Max-Age=0`,
	);
	// The builder frames this host from another site. Safari, iOS, and Chrome Incognito drop such a cookie without Partitioned.
	response.headers.append(
		"set-cookie",
		`${PREVIEW_COOKIE_NAME}=${token}; Secure; HttpOnly; SameSite=None; Path=/; Partitioned`,
	);
	return response;
}

/**
 * 302 to the same URL without `wt`, so the token leaves the address bar,
 * the history, and the app. The frame host answers its `?wt=` with it,
 * after it stores the claims in its `PreviewFrame` object.
 */
export function redirectWithoutToken(
	url: URL,
	frameAncestors: string,
): Response {
	url.searchParams.delete(PREVIEW_TOKEN_QUERY);
	const headers = securityHeaders(frameAncestors);
	headers.set("location", url.toString());
	return new Response(null, { status: 302, headers });
}
