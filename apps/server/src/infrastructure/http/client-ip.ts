/**
 * Reads the client IP of one API request for audit rows and rate keys.
 * Controllers and `RedisRateLimitGuard` call it with the Fastify request.
 * It uses the Better Auth rule with `TRUSTED_PROXY_CIDRS`: the last
 * `x-forwarded-for` hop that no trusted proxy appended, so a client cannot
 * choose the value by sending its own header.
 */
import { env } from "@wandit/env/server";
import { getIp } from "better-auth/api";
import type { FastifyRequest } from "fastify";

// The same list as `createBaseAuthOptions` in packages/auth, so the sign-in
// rate limits and these keys see one client IP.
const trustedProxies = (env.TRUSTED_PROXY_CIDRS ?? "")
	.split(",")
	.map((cidr) => cidr.trim())
	.filter((cidr) => cidr.length > 0);

/**
 * The client IP that the trusted proxies vouch for, or null when no hop can
 * be trusted (for example a spoofed hop and no `TRUSTED_PROXY_CIDRS`). In
 * development and test, Better Auth answers 127.0.0.1 in that case.
 */
export function readTrustedClientIp(
	request: Pick<FastifyRequest, "headers">,
): string | null {
	const forwarded = request.headers["x-forwarded-for"];
	const value = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
	return getIp(
		new Headers(value === undefined ? {} : { "x-forwarded-for": value }),
		{ advanced: { ipAddress: { trustedProxies } } },
	);
}

/**
 * The trusted client IP, or the socket address when no hop can be trusted.
 * Use it for an audit trail; a rate key uses `readTrustedClientIp`, so a
 * shared proxy address never becomes one bucket for every user.
 */
export function readClientIp(
	request: Pick<FastifyRequest, "headers" | "ip">,
): string {
	return readTrustedClientIp(request) ?? request.ip;
}
