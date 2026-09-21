/**
 * The security headers and the cookie strip of the preview proxy.
 * Called by src/index.ts and src/token.ts on every response the proxy sends.
 */

/**
 * Sets the five headers every proxy response carries and deletes
 * `X-Frame-Options`. `frame-ancestors` works only as a real header, not as
 * a meta tag (security.md 9.3 item 4); `X-Frame-Options` would contradict it.
 */
export function applySecurityHeaders(
	headers: Headers,
	frameAncestors: string,
): void {
	headers.set("content-security-policy", `frame-ancestors ${frameAncestors}`);
	headers.set("x-robots-tag", "noindex");
	headers.set("referrer-policy", "strict-origin-when-cross-origin");
	headers.set("x-content-type-options", "nosniff");
	headers.set("cache-control", "no-store");
	headers.delete("x-frame-options");
}

/** A fresh `Headers` with the five security headers set. */
export function securityHeaders(frameAncestors: string): Headers {
	const headers = new Headers();
	applySecurityHeaders(headers, frameAncestors);
	return headers;
}

/**
 * Removes the `name` pair from a `Cookie` header value. Returns null when
 * nothing remains, so the caller deletes the header instead of sending an
 * empty one. The signing token must never reach the generated app.
 */
export function stripCookieValue(
	cookieHeader: string,
	name: string,
): string | null {
	const kept = cookieHeader
		.split(";")
		.map((pair) => pair.trim())
		.filter((pair) => pair.length > 0)
		.filter((pair) => {
			const eq = pair.indexOf("=");
			// A pair without `=` is a bare flag value; it is never ours.
			return (eq === -1 ? pair : pair.slice(0, eq)) !== name;
		});
	return kept.length > 0 ? kept.join("; ") : null;
}
