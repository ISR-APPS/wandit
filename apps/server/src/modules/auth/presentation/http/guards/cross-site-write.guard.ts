/**
 * CSRF defence for every state-changing route.
 *
 * CORS only stops a third-party page from READING a response. A plain
 * auto-submitting HTML form on any site still reaches this API and, when the
 * session cookie is SameSite=None (cross-site staging) or the browser is
 * lenient, it carries the victim's cookie — no preflight, no CORS check, and
 * the write happens whether or not the attacker can read the reply.
 *
 * Rule for POST / PUT / PATCH / DELETE:
 * - Origin header present: it must be a configured web or admin origin, or a
 *   native app scheme. Browsers always attach Origin to cross-origin form
 *   posts and to every fetch/XHR write; "null" (sandboxed iframe, data: URL,
 *   some redirects) is rejected like any other stranger.
 * - Origin header absent: a non-browser client (native app, Stripe webhook,
 *   curl). Allowed, unless a browser signal remains: Sec-Fetch-Site says
 *   cross-site, or a Referer names a site that is not ours.
 *
 * Routes that are cross-origin by design opt out with @AllowCrossSiteWrite().
 * Better Auth's own /api/auth routes keep their trustedOrigins check as a
 * second layer; this guard runs first and agrees with it.
 */
import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Inject,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { corsWebOrigins, expoDevOrigins } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";
import type { FastifyRequest } from "fastify";

import { ALLOW_CROSS_SITE_WRITE_KEY } from "../decorators/allow-cross-site-write.decorator";

export const CROSS_SITE_WRITE_ERROR_CODE = "CROSS_SITE_WRITE_REJECTED";

// Methods that must never change state (RFC 9110 "safe"). Cross-site GETs
// are how the OAuth callback and magic links arrive, so they stay open.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Custom-scheme origins the native app presents through Better Auth's expo
// plugin. A browser can never put a custom scheme in Origin, so trusting
// the prefix gives an attacker page nothing.
const NATIVE_ORIGIN_PREFIXES = ["wandit://", "exp://"];

export type CrossSiteWriteVerdict =
	| { allowed: true }
	| { allowed: false; reason: "origin" | "referer" | "sec-fetch-site" };

/** Every browser origin that may perform writes with a session cookie. */
export function allowedWriteOrigins(): string[] {
	return [
		...corsWebOrigins(env.CORS_ORIGIN, env.CORS_EXTRA_ORIGINS),
		...(env.ADMIN_ORIGIN ? [env.ADMIN_ORIGIN] : []),
		// Expo web / Metro dev origin, mirrors Better Auth's trustedOrigins.
		...expoDevOrigins(env.BETTER_AUTH_URL),
	];
}

function headerValue(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

function isAllowedOrigin(
	origin: string,
	allowedOrigins: readonly string[],
): boolean {
	return (
		allowedOrigins.includes(origin) ||
		NATIVE_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix))
	);
}

function refererOrigin(referer: string | undefined): string | undefined {
	if (referer === undefined) {
		return undefined;
	}
	try {
		return new URL(referer).origin;
	} catch {
		return "null";
	}
}

export function crossSiteWriteVerdict(input: {
	method: string;
	origin?: string | string[];
	referer?: string | string[];
	secFetchSite?: string | string[];
	allowedOrigins: readonly string[];
}): CrossSiteWriteVerdict {
	if (SAFE_METHODS.has(input.method.toUpperCase())) {
		return { allowed: true };
	}

	const origin = headerValue(input.origin);

	if (origin !== undefined) {
		return isAllowedOrigin(origin, input.allowedOrigins)
			? { allowed: true }
			: { allowed: false, reason: "origin" };
	}

	// No Origin: browsers always send one on writes, so this is a native app,
	// a webhook, or a script. Two browser signals can still give away a
	// cross-site form post from an unusual client or a header-stripping proxy.
	if (headerValue(input.secFetchSite)?.toLowerCase() === "cross-site") {
		return { allowed: false, reason: "sec-fetch-site" };
	}

	const referer = refererOrigin(headerValue(input.referer));

	if (
		referer !== undefined &&
		!isAllowedOrigin(referer, input.allowedOrigins)
	) {
		return { allowed: false, reason: "referer" };
	}

	return { allowed: true };
}

@Injectable()
export class CrossSiteWriteGuard implements CanActivate {
	constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<FastifyRequest>();

		if (SAFE_METHODS.has(request.method.toUpperCase())) {
			return true;
		}

		const allowCrossSite = this.reflector.getAllAndOverride<boolean>(
			ALLOW_CROSS_SITE_WRITE_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (allowCrossSite) {
			return true;
		}

		const verdict = crossSiteWriteVerdict({
			method: request.method,
			origin: request.headers.origin,
			referer: request.headers.referer,
			secFetchSite: request.headers["sec-fetch-site"],
			allowedOrigins: allowedWriteOrigins(),
		});

		if (!verdict.allowed) {
			throw new ForbiddenException({
				code: CROSS_SITE_WRITE_ERROR_CODE,
				message: "This request must come from the Wandit app",
			});
		}

		return true;
	}
}
