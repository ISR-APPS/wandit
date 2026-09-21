/**
 * The token helpers of the preview proxy: read the preview cookie and
 * answer the `?wt=` exchange.
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
 * does not stay in browser history or logs. No `Domain` and no `Max-Age`:
 * the `__Host-` rules need `Secure`, `Path=/`, and no `Domain`
 * (security.md 9.1). The token carries `exp`.
 */
export function exchangeRedirect(
	url: URL,
	token: string,
	frameAncestors: string,
): Response {
	url.searchParams.delete(PREVIEW_TOKEN_QUERY);
	const headers = securityHeaders(frameAncestors);
	headers.set(
		"set-cookie",
		`${PREVIEW_COOKIE_NAME}=${token}; Secure; HttpOnly; SameSite=None; Path=/`,
	);
	headers.set("location", url.toString());
	return new Response(null, { status: 302, headers });
}
