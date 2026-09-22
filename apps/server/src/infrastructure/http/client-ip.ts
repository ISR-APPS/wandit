/**
 * Reads the client IP of one API request for audit rows and rate keys.
 * Controllers call it with the Fastify request. Behind the production
 * proxy the socket address is the proxy itself, so the first
 * `x-forwarded-for` hop wins; the socket address is the fallback.
 */
import type { FastifyRequest } from "fastify";

/**
 * The first `x-forwarded-for` hop, or `request.ip` when the header is
 * absent or empty. The header is spoofable: use the value for an audit
 * trail or a rate key, never for authorization.
 */
export function readClientIp(
	request: Pick<FastifyRequest, "headers" | "ip">,
): string {
	const forwarded = request.headers["x-forwarded-for"];
	const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
	const ip = first?.split(",")[0]?.trim();

	return ip || request.ip;
}
