/**
 * CSRF defence for state-changing WEB billing routes.
 *
 * Session cookies are SameSite=None in the https deploys, so a plain
 * auto-submitting cross-site HTML form reaches these handlers carrying the
 * victim's cookie — no preflight, no CORS check. Browsers always attach an
 * Origin header to POST requests, so requiring the configured web origin
 * blocks that form (its Origin is the attacker's site) without any client
 * change: the web app always calls cross-origin with fetch/XHR.
 *
 * Native has no billing surface; if it ever gains one it must send an
 * allowed Origin header like the web client does.
 */
import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { allowedCorsWebOrigin } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";

import type { MaybeAuthenticatedRequest } from "../../../../auth";

@Injectable()
export class WebOriginWriteGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();

		if (
			!allowedCorsWebOrigin(
				request.headers.origin,
				env.CORS_ORIGIN,
				env.CORS_EXTRA_ORIGINS,
			)
		) {
			throw new ForbiddenException({
				code: "FORBIDDEN",
				message: "This request must originate from the web app",
			});
		}

		return true;
	}
}
